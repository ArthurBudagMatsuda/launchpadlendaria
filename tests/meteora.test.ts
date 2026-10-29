import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type AccountInfo,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { DynamicBondingCurveIdl, MigrationFeeOption } from "@/lib/meteora/sdk";
import {
  configMismatches,
  curveSummary,
  RETRY_LAUNCH,
  retryCurve,
} from "@/lib/meteora/curve";
import { userMessage } from "@/lib/meteora/errors";
import { feeSchedule, splitTradingFee } from "@/lib/meteora/fees";
import {
  parseSol,
  parseTokens,
  sol,
  solInput,
  supplyShare,
} from "@/lib/meteora/format";
import {
  decodeMetadata,
  isTrustedUrl,
  metadataAddress,
  parseOffchainMetadata,
} from "@/lib/meteora/metadata";
import {
  memoryStore,
  pendingCreate,
  type OperationRecord,
} from "@/lib/meteora/operations";
import {
  assertSdkProgramIds,
  DBC_PROGRAM,
  dammV2ConfigFor,
  LIGHTHOUSE_PROGRAM,
  METAPLEX_PROGRAM,
  WSOL_MINT,
} from "@/lib/meteora/programs";
import {
  isQuoteFresh,
  QuoteError,
  validateSlippage,
  type TradeQuote,
} from "@/lib/meteora/quotes";
import {
  execute,
  reconcile,
  TransactionValidationError,
  validateSigned,
  validateTransaction,
  type TxExpectation,
} from "@/lib/meteora/transactions";
import { supportsSigning, walletSigner } from "@/lib/meteora/wallet-signer";
import { assertCluster, customContext } from "@/lib/meteora/client";
import { prepareCreateToken } from "@/lib/meteora/create-token";
import { CLUSTERS } from "@/config/solana";
import type { Wallet, WalletAccount } from "@wallet-standard/base";

const owner = Keypair.generate().publicKey;
const pool = Keypair.generate().publicKey;
const config = Keypair.generate().publicKey;
const mint = Keypair.generate().publicKey;
const attacker = Keypair.generate().publicKey;
const swap2 = DynamicBondingCurveIdl.instructions.find(
  (ix) => ix.name === "swap2",
)!;
const claim = DynamicBondingCurveIdl.instructions.find(
  (ix) => ix.name === "claim_trading_fee",
)!;
const wsolAta = getAssociatedTokenAddressSync(WSOL_MINT, owner, true);
const baseAta = getAssociatedTokenAddressSync(mint, owner, true);

/** A swap2 instruction laid out like the IDL, with chosen account keys. */
function swapIx(overrides: Record<string, PublicKey> = {}) {
  const keys: Record<string, PublicKey> = {
    config,
    pool,
    input_token_account: wsolAta,
    output_token_account: baseAta,
    base_mint: mint,
    quote_mint: WSOL_MINT,
    payer: owner,
    referral_token_account: DBC_PROGRAM,
    ...overrides,
  };
  return new TransactionInstruction({
    programId: DBC_PROGRAM,
    data: Buffer.concat([Buffer.from(swap2.discriminator), Buffer.alloc(25)]),
    keys: swap2.accounts.map((account) => ({
      pubkey: keys[account.name] ?? Keypair.generate().publicKey,
      isSigner: account.name === "payer",
      isWritable: true,
    })),
  });
}

const expectation: TxExpectation = {
  owner,
  dbc: ["swap2"],
  accounts: {
    pool,
    config,
    base_mint: mint,
    quote_mint: WSOL_MINT,
    input_token_account: wsolAta,
    output_token_account: baseAta,
    payer: owner,
    referral_token_account: DBC_PROGRAM,
  },
  ataMints: [mint, WSOL_MINT],
};

function buyTx(...extra: TransactionInstruction[]) {
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = Keypair.generate().publicKey.toBase58();
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      owner,
      baseAta,
      owner,
      mint,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      owner,
      wsolAta,
      owner,
      WSOL_MINT,
    ),
    SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: wsolAta,
      lamports: 1_000,
    }),
    createSyncNativeInstruction(wsolAta),
    swapIx(),
    createCloseAccountInstruction(wsolAta, owner, owner),
    ...extra,
  );
  return tx;
}

describe("transaction allowlist (adversarial)", () => {
  it("accepts the swap transaction RETRY builds", () => {
    expect(() => validateTransaction(buyTx(), expectation)).not.toThrow();
  });

  it.each([
    ["pool", { pool: attacker }],
    ["config", { config: attacker }],
    ["base_mint", { base_mint: attacker }],
    ["output_token_account", { output_token_account: attacker }],
    ["referral_token_account", { referral_token_account: attacker }],
  ])("rejects a substituted %s account", (_, override) => {
    const tx = buyTx();
    tx.instructions[4] = swapIx(override);
    expect(() => validateTransaction(tx, expectation)).toThrow(
      TransactionValidationError,
    );
  });

  it("rejects a DBC instruction the operation does not need (fee claim)", () => {
    const tx = buyTx(
      new TransactionInstruction({
        programId: DBC_PROGRAM,
        data: Buffer.from(claim.discriminator),
        keys: [],
      }),
    );
    expect(() => validateTransaction(tx, expectation)).toThrow(
      /Unexpected Meteora instruction/,
    );
  });

  it("rejects SOL sent anywhere but the owner's own WSOL account", () => {
    const tx = buyTx(
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: attacker,
        lamports: 1,
      }),
    );
    expect(() => validateTransaction(tx, expectation)).toThrow(
      /unexpected account/,
    );
  });

  it("rejects closing the WSOL account to someone else", () => {
    const tx = buyTx(createCloseAccountInstruction(wsolAta, attacker, owner));
    expect(() => validateTransaction(tx, expectation)).toThrow(/SPL Token/);
  });

  it("rejects token accounts for other mints or other owners", () => {
    const other = Keypair.generate().publicKey;
    expect(() =>
      validateTransaction(
        buyTx(
          createAssociatedTokenAccountIdempotentInstruction(
            owner,
            getAssociatedTokenAddressSync(other, owner, true),
            owner,
            other,
          ),
        ),
        expectation,
      ),
    ).toThrow(/token account creation/);
    expect(() =>
      validateTransaction(
        buyTx(
          createAssociatedTokenAccountIdempotentInstruction(
            owner,
            getAssociatedTokenAddressSync(mint, attacker, true),
            attacker,
            mint,
          ),
        ),
        expectation,
      ),
    ).toThrow(/token account creation/);
  });

  it("rejects unknown programs, priority fees, foreign signers and a foreign fee payer", () => {
    expect(() =>
      validateTransaction(
        buyTx(
          new TransactionInstruction({
            programId: attacker,
            data: Buffer.alloc(0),
            keys: [],
          }),
        ),
        expectation,
      ),
    ).toThrow(/Unexpected program/);
    expect(() =>
      validateTransaction(
        buyTx(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 1_000_000,
          }),
        ),
        expectation,
      ),
    ).toThrow(/compute budget/);
    const signer = buyTx();
    signer.instructions[4].keys[0] = {
      pubkey: attacker,
      isSigner: true,
      isWritable: false,
    };
    expect(() => validateTransaction(signer, expectation)).toThrow(
      /unexpected signer/,
    );
    const payer = buyTx();
    payer.feePayer = attacker;
    expect(() => validateTransaction(payer, expectation)).toThrow(/Fee payer/);
  });

  it("accepts a compute unit limit (Meteora's migration sets one)", () => {
    expect(() =>
      validateTransaction(
        buyTx(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })),
        expectation,
      ),
    ).not.toThrow();
  });
});

describe("what the wallet returns (adversarial)", () => {
  const copy = (tx: Transaction) =>
    Transaction.from(
      tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
    );

  it("accepts the same transaction, or one with compute budget and Lighthouse guards added", () => {
    const original = buyTx();
    expect(() => validateSigned(original, copy(original))).not.toThrow();
    const guarded = copy(original);
    guarded.instructions.unshift(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10 }),
    );
    guarded.instructions.push(
      new TransactionInstruction({
        programId: LIGHTHOUSE_PROGRAM,
        data: Buffer.alloc(1),
        keys: [],
      }),
    );
    expect(() => validateSigned(original, guarded)).not.toThrow();
  });

  it("rejects a changed fee payer, blockhash, instruction, or an added transfer", () => {
    const original = buyTx();
    const payer = copy(original);
    payer.feePayer = attacker;
    expect(() => validateSigned(original, payer)).toThrow(/fee payer/);
    const hash = copy(original);
    hash.recentBlockhash = Keypair.generate().publicKey.toBase58();
    expect(() => validateSigned(original, hash)).toThrow(/blockhash/);
    const changed = copy(original);
    changed.instructions[4] = swapIx({ output_token_account: attacker });
    expect(() => validateSigned(original, changed)).toThrow();
    const drained = copy(original);
    drained.instructions.push(
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: attacker,
        lamports: 1,
      }),
    );
    expect(() => validateSigned(original, drained)).toThrow(
      /unexpected instruction/,
    );
    const removed = copy(original);
    removed.instructions.pop();
    expect(() => validateSigned(original, removed)).toThrow(
      /removed or changed/,
    );
  });
});

describe("Wallet Standard signer", () => {
  const key = Keypair.generate();
  const account: WalletAccount = {
    address: key.publicKey.toBase58(),
    publicKey: key.publicKey.toBytes(),
    chains: ["solana:devnet"],
    features: [],
  };
  const wallet = (sign?: (bytes: Uint8Array) => Uint8Array) =>
    ({
      name: "Test",
      version: "1.0.0",
      icon: "data:image/png;base64,",
      chains: ["solana:devnet"],
      accounts: [account],
      features: sign
        ? {
            "solana:signTransaction": {
              version: "1.0.0",
              signTransaction: async (
                ...inputs: { transaction: Uint8Array; chain?: string }[]
              ) =>
                inputs.map((input) => {
                  expect(input.chain).toBe("solana:devnet");
                  return { signedTransaction: sign(input.transaction) };
                }),
            },
          }
        : {},
    }) as unknown as Wallet;

  it("signs through solana:signTransaction on the selected chain", async () => {
    const signer = walletSigner(
      wallet((bytes) => {
        const tx = Transaction.from(bytes);
        tx.partialSign(key);
        return tx.serialize();
      }),
      account,
      "devnet",
    );
    const tx = new Transaction({
      feePayer: key.publicKey,
      recentBlockhash: owner.toBase58(),
    }).add(
      SystemProgram.transfer({
        fromPubkey: key.publicKey,
        toPubkey: key.publicKey,
        lamports: 1,
      }),
    );
    const signed = await signer.signTransaction(tx);
    expect(signed.verifySignatures()).toBe(true);
  });

  it("refuses wallets without signing and garbage responses", async () => {
    expect(supportsSigning(wallet())).toBe(false);
    expect(() => walletSigner(wallet(), account, "devnet")).toThrow();
    const signer = walletSigner(
      wallet(() => new Uint8Array([1, 2, 3])),
      account,
      "devnet",
    );
    const tx = new Transaction({
      feePayer: key.publicKey,
      recentBlockhash: owner.toBase58(),
    }).add(
      SystemProgram.transfer({
        fromPubkey: key.publicKey,
        toPubkey: key.publicKey,
        lamports: 1,
      }),
    );
    await expect(signer.signTransaction(tx)).rejects.toThrow(/cannot read/);
  });
});

describe("RETRY curve and config", () => {
  it("pins program IDs and the graduated pool config", () => {
    expect(() => assertSdkProgramIds()).not.toThrow();
    expect(dammV2ConfigFor(MigrationFeeOption.FixedBps100).toBase58()).toBe(
      "Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp",
    );
    expect(() => dammV2ConfigFor(MigrationFeeOption.Customizable)).toThrow();
  });

  it("builds the reviewed economics deterministically", () => {
    const curve = retryCurve();
    expect(curve.migrationQuoteThreshold.toString()).toBe("10000000000");
    expect(curve.tokenSupply?.preMigrationTokenSupply.toString()).toBe(
      "1000000000000000000",
    );
    expect(curve.tokenSupply?.postMigrationTokenSupply.toString()).toBe(
      "1000000000000000000",
    );
    expect(curve.creatorTradingFeePercentage).toBe(50);
    expect(curve.poolCreationFee.toString()).toBe("0");
    expect(
      curve.partnerPermanentLockedLiquidityPercentage +
        curve.creatorPermanentLockedLiquidityPercentage,
    ).toBe(100);
    expect(
      curve.partnerLiquidityPercentage + curve.creatorLiquidityPercentage,
    ).toBe(0);
    const summary = curveSummary();
    expect(Number(summary.startFdvSol)).toBeGreaterThan(3);
    expect(Number(summary.graduationFdvSol)).toBeCloseTo(50, 0);
  });

  it("flags any on-chain config that differs from the reviewed parameters", () => {
    const expected = retryCurve();
    const onchain = {
      ...expected,
      poolFees: { ...expected.poolFees, dynamicFee: { initialized: 0 } },
      tokenDecimal: expected.tokenDecimal,
      transferFeeFlag: 0,
      preMigrationTokenSupply: expected.tokenSupply!.preMigrationTokenSupply,
      postMigrationTokenSupply: expected.tokenSupply!.postMigrationTokenSupply,
      migrationFeePercentage: expected.migrationFee.feePercentage,
    };
    const as = (value: object) =>
      value as unknown as Parameters<typeof configMismatches>[0];
    expect(configMismatches(as(onchain))).toEqual([]);
    expect(
      configMismatches(as({ ...onchain, creatorTradingFeePercentage: 100 })),
    ).toEqual(["creatorTradingFeePercentage"]);
    // Slot activation would make "launched in the last 24 hours" meaningless.
    expect(configMismatches(as({ ...onchain, activationType: 0 }))).toEqual([
      "activationType",
    ]);
    expect(
      configMismatches(
        as({
          ...onchain,
          curve: expected.curve.map((point) => ({
            ...point,
            liquidity: point.liquidity.addn(1),
          })),
        }),
      ),
    ).toContain("curve");
  });

  it("splits trading fees exactly and documents the schedule", () => {
    const split = splitTradingFee(5_000_000n);
    expect(split).toEqual({
      protocol: 1_000_000n,
      creator: 2_000_000n,
      partner: 2_000_000n,
    });
    const odd = splitTradingFee(7n);
    expect(odd.protocol + odd.creator + odd.partner).toBe(7n);
    expect(feeSchedule()).toMatchObject({
      tradingPct: 1,
      protocolPct: 0.2,
      creatorPct: 0.4,
      partnerPct: 0.4,
      poolCreationSol: 0,
      graduatedLpPct: 1,
    });
    expect(RETRY_LAUNCH.totalSupply).toBe(1_000_000_000);
  });
});

describe("quotes, amounts and errors", () => {
  it("bounds slippage and expires quotes", () => {
    expect(validateSlippage(100)).toBe(100);
    for (const bad of [0, 9, 1001, 1.5, Number.NaN])
      expect(() => validateSlippage(bad)).toThrow(QuoteError);
    const quote = { quotedAt: 1_000 } as TradeQuote;
    expect(isQuoteFresh(quote, 30_999)).toBe(true);
    expect(isQuoteFresh(quote, 31_001)).toBe(false);
  });

  it("parses SOL and token amounts exactly, without floating point", () => {
    expect(parseSol("0.5")).toBe(500_000_000n);
    expect(parseSol("1.000000001")).toBe(1_000_000_001n);
    for (const bad of ["", ".", "1e3", "-1", "0.0000000001", "abc", "1,5"])
      expect(parseSol(bad)).toBeNull();
    expect(parseTokens("1000")).toBe(1_000_000_000_000n);
    expect(sol(-127_038_080n, 6)).toBe("-0.127038 SOL");
    expect(solInput(1_500_000_000n)).toBe("1.5");
    expect(supplyShare(130_564_541_249_646_396n)).toBe("13.05%");
    expect(supplyShare(10n ** 18n)).toBe("100%");
  });

  it("maps program, wallet and RPC failures to plain messages", () => {
    expect(
      userMessage(new Error('{"InstructionError":[2,{"Custom":6002}]}')),
    ).toMatch(/slippage/);
    expect(userMessage(new Error("custom program error: 0x177d"))).toMatch(
      /curve just completed/,
    );
    expect(userMessage(new Error("User rejected the request."))).toMatch(
      /cancelled/,
    );
    expect(
      userMessage(
        new Error(
          "Attempt to debit an account but found no record of a prior credit.",
        ),
      ),
    ).toMatch(/Not enough SOL/);
    expect(userMessage(new Error("Blockhash not found"))).toMatch(/expired/);
    expect(userMessage(new Error("429 Too Many Requests"))).toMatch(
      /did not answer/,
    );
    expect(userMessage(new Error("weird"))).not.toMatch(/weird/);
  });
});

describe("Metaplex metadata", () => {
  function metadataAccount(
    target: PublicKey,
    fields: { name: string; symbol: string; uri: string; mutable: boolean },
  ) {
    const text = (value: string, max: number) => {
      const bytes = Buffer.alloc(max);
      bytes.write(value);
      const length = Buffer.alloc(4);
      length.writeUInt32LE(max);
      return Buffer.concat([length, bytes]);
    };
    const data = Buffer.concat([
      Buffer.from([4]),
      new PublicKey("11111111111111111111111111111111").toBuffer(),
      target.toBuffer(),
      text(fields.name, 32),
      text(fields.symbol, 10),
      text(fields.uri, 200),
      Buffer.from([0, 0]),
      Buffer.from([0]),
      Buffer.from([0]),
      Buffer.from([fields.mutable ? 1 : 0]),
    ]);
    return {
      data,
      owner: METAPLEX_PROGRAM,
      lamports: 1,
      executable: false,
    } as AccountInfo<Buffer>;
  }
  const fields = {
    name: "Orbit Cat",
    symbol: "ORBIT",
    uri: "https://x.test/m.json",
    mutable: false,
  };

  it("decodes the padded Metaplex layout and its immutability", () => {
    expect(decodeMetadata(mint, metadataAccount(mint, fields))).toMatchObject({
      name: "Orbit Cat",
      symbol: "ORBIT",
      uri: "https://x.test/m.json",
      isMutable: false,
      updateAuthority: "11111111111111111111111111111111",
    });
    expect(metadataAddress(mint)).toBeInstanceOf(PublicKey);
  });

  it("ignores accounts of another owner, another mint, or with a broken length", () => {
    const account = metadataAccount(mint, fields);
    expect(decodeMetadata(mint, { ...account, owner: attacker })).toBeNull();
    expect(decodeMetadata(attacker, account)).toBeNull();
    const broken = Buffer.from(account.data);
    broken.writeUInt32LE(10_000, 65);
    expect(decodeMetadata(mint, { ...account, data: broken })).toBeNull();
  });

  it("trusts only RETRY's hosts and validates the off-chain JSON against the chain", () => {
    const hosts = ["raw.githubusercontent.com", "meta.retry.test"];
    expect(isTrustedUrl("https://meta.retry.test/v1/m/a.json", hosts)).toBe(
      true,
    );
    expect(isTrustedUrl("http://meta.retry.test/v1/m/a.json", hosts)).toBe(
      false,
    );
    expect(isTrustedUrl("https://user:pw@meta.retry.test/x", hosts)).toBe(
      false,
    );
    expect(isTrustedUrl("https://evil.test/x", hosts)).toBe(false);
    expect(
      isTrustedUrl("https://raw.githubusercontent.com/evil/repo/x.json", hosts),
    ).toBe(false);
    expect(
      isTrustedUrl(
        "https://raw.githubusercontent.com/ArthurBudagMatsuda/launchpadlendaria/x.json",
        hosts,
      ),
    ).toBe(true);
    const json = {
      name: "Orbit Cat",
      symbol: "ORBIT",
      description: "d",
      image: "https://evil.test/pixel.png",
      extensions: {
        twitter: "https://evil.test/x",
        telegram: "https://t.me/orbit",
        website: "https://orbit.example",
      },
    };
    expect(
      parseOffchainMetadata({ ...json, name: "Other" }, fields, hosts),
    ).toBeNull();
    expect(parseOffchainMetadata(json, fields, hosts)).toEqual({
      description: "d",
      image: null,
      website: "https://orbit.example/",
      twitter: null,
      telegram: "https://t.me/orbit",
    });
  });
});

describe("operations and reconciliation", () => {
  const record = (
    signature: string,
    status: OperationRecord["status"],
    height = 100,
  ): OperationRecord => ({
    signature,
    cluster: "devnet",
    kind: "create",
    owner: owner.toBase58(),
    pool: pool.toBase58(),
    mint: mint.toBase58(),
    summary: "Launch",
    lastValidBlockHeight: height,
    status,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const sig = (char: string) => char.repeat(88);

  it("blocks a second launch while one is waiting", () => {
    const store = memoryStore([record(sig("2"), "sent")]);
    expect(pendingCreate(store, "devnet", owner.toBase58())?.signature).toBe(
      sig("2"),
    );
    expect(
      pendingCreate(store, "mainnet-beta", owner.toBase58()),
    ).toBeUndefined();
  });

  it("settles sent operations from chain state only", async () => {
    const store = memoryStore([
      record(sig("3"), "sent"),
      record(sig("4"), "sent"),
      record(sig("5"), "sent", 500),
      record(sig("6"), "sent", 50),
    ]);
    // A test double of the two RPC calls reconcile makes.
    const connection = {
      getSignatureStatuses: async () => ({
        value: [
          { confirmationStatus: "confirmed", slot: 9, err: null },
          {
            confirmationStatus: "confirmed",
            slot: 9,
            err: { InstructionError: [0, { Custom: 6002 }] },
          },
          null,
          null,
        ],
      }),
      getBlockHeight: async () => 200,
    };
    // memoryStore lists newest first; all were created in the same ms, so order by signature.
    const ordered = memoryStore(
      store.list().sort((a, b) => a.signature.localeCompare(b.signature)),
    );
    ordered.list = () =>
      [...store.list()].sort((a, b) => a.signature.localeCompare(b.signature));
    const originalPut = store.put;
    ordered.put = (op) => originalPut(op);
    const context = customContext(connection as never, null, "x");
    await reconcile(context, ordered);
    const byId = Object.fromEntries(
      store.list().map((op) => [op.signature, op.status]),
    );
    expect(byId).toEqual({
      [sig("3")]: "confirmed",
      [sig("4")]: "failed",
      [sig("5")]: "sent",
      [sig("6")]: "expired",
    });
  });
});

describe("execution (adversarial)", () => {
  const payer = Keypair.generate();
  const payerWsol = getAssociatedTokenAddressSync(
    WSOL_MINT,
    payer.publicKey,
    true,
  );
  /** Wrap 0.001 SOL into the payer's own WSOL account: allowed as is. */
  const wrapTx = () =>
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: payerWsol,
        lamports: 1_000_000,
      }),
      createSyncNativeInstruction(payerWsol),
    );
  const wrapExpectation: TxExpectation = {
    owner: payer.publicKey,
    dbc: [],
    accounts: {},
    ataMints: [],
  };
  /** A test double of the RPC calls execute makes; it records each send. */
  function rpc(store: ReturnType<typeof memoryStore>) {
    const sent: { stored: string[] }[] = [];
    const connection = {
      getLatestBlockhash: async () => ({
        blockhash: Keypair.generate().publicKey.toBase58(),
        lastValidBlockHeight: 100,
      }),
      getBalance: async () => 1_000_000_000,
      getFeeForMessage: async () => ({ value: 5_000 }),
      simulateTransaction: async () => ({
        value: {
          err: null,
          logs: [],
          unitsConsumed: 450,
          accounts: [{ lamports: 1_000_000_000 - 1_005_000 }],
        },
      }),
      sendRawTransaction: async () => {
        sent.push({ stored: store.list().map((op) => op.status) });
        return "sent";
      },
      getSignatureStatuses: async () => ({
        value: [{ confirmationStatus: "confirmed", slot: 7, err: null }],
      }),
      getBlockHeight: async () => 50,
    };
    return { connection, sent };
  }
  const record = {
    cluster: "devnet" as const,
    kind: "buy" as const,
    owner: payer.publicKey.toBase58(),
    pool: pool.toBase58(),
    mint: mint.toBase58(),
    summary: "Wrap",
  };
  const copy = (tx: Transaction) =>
    Transaction.from(
      tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
    );

  it("stores the signature before sending, then confirms from chain state", async () => {
    const store = memoryStore();
    const { connection, sent } = rpc(store);
    const { result, preview } = await execute({
      context: customContext(connection as never, null, "x"),
      tx: wrapTx(),
      signer: {
        publicKey: payer.publicKey,
        signTransaction: async (tx) => {
          const signed = copy(tx);
          signed.partialSign(payer);
          return signed;
        },
      },
      expect: wrapExpectation,
      record,
      store,
    });
    expect(sent).toEqual([{ stored: ["sent"] }]);
    expect(result).toEqual({ status: "confirmed", slot: 7 });
    expect(preview.balanceChange).toBe(-1_000_000n);
    expect(store.list().map((op) => op.status)).toEqual(["confirmed"]);
  });

  it("sends nothing when the wallet signs with another account (account switched while signing)", async () => {
    const store = memoryStore();
    const { connection, sent } = rpc(store);
    // A real Ed25519 signature, by a key that is not the fee payer's.
    const other = generateKeyPairSync("ed25519");
    await expect(
      execute({
        context: customContext(connection as never, null, "x"),
        tx: wrapTx(),
        signer: {
          publicKey: payer.publicKey,
          signTransaction: async (tx) => {
            const signed = copy(tx);
            signed.addSignature(
              payer.publicKey,
              sign(null, signed.serializeMessage(), other.privateKey),
            );
            return signed;
          },
        },
        expect: wrapExpectation,
        record,
        store,
      }),
    ).rejects.toThrow("A required signature is missing.");
    expect(sent).toEqual([]);
    expect(store.list()).toEqual([]);
  });

  it("names the failing program's own error when the RPC preflight refuses a send", async () => {
    const store = memoryStore();
    const { connection } = rpc(store);
    // DAMM v2's PoolDisabled is 6003; the same number is another DBC error.
    connection.sendRawTransaction = async () => {
      throw new SendTransactionError({
        action: "send",
        signature: "",
        transactionMessage:
          "Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1773",
        logs: [
          "Program cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG invoke [1]",
          "Program log: AnchorError occurred. Error Code: PoolDisabled. Error Number: 6003. Error Message: Pool disabled.",
        ],
      });
    };
    const error = await execute({
      context: customContext(connection as never, null, "x"),
      tx: wrapTx(),
      signer: {
        publicKey: payer.publicKey,
        signTransaction: async (tx) => {
          const signed = copy(tx);
          signed.partialSign(payer);
          return signed;
        },
      },
      expect: wrapExpectation,
      record,
      store,
    }).catch((cause: unknown) => cause);
    expect(userMessage(error)).toBe("Trading is paused on this DAMM v2 pool.");
    expect(store.list().map((op) => op.status)).toEqual(["failed"]);
  });
});

describe("cluster guard (adversarial)", () => {
  /** An RPC double that answers getGenesisHash and records every call. */
  const rpcAnswering = (genesis: string) => {
    const calls: string[] = [];
    const connection = new Proxy(
      {},
      {
        get: (_, method: string) => async () => {
          calls.push(method);
          if (method === "getGenesisHash") return genesis;
          throw new Error(`unexpected ${method}`);
        },
      },
    );
    return { connection, calls };
  };

  it("builds nothing when the RPC answers for another cluster", async () => {
    const { connection, calls } = rpcAnswering(
      CLUSTERS["mainnet-beta"].genesis,
    );
    const context = customContext(
      connection as never,
      config,
      CLUSTERS.devnet.genesis,
    );
    await expect(assertCluster(context)).rejects.toThrow(
      "RPC cluster does not match the selected environment.",
    );
    await expect(
      prepareCreateToken(context, {
        name: "Orbit",
        symbol: "ORBIT",
        uri: "https://raw.githubusercontent.com/ArthurBudagMatsuda/launchpadlendaria/feat/retry-meteora-dbc-mvp/docs/meteora/devnet-metadata/retry-devnet-test.json",
        creator: owner,
        initialBuyLamports: 0n,
        slippageBps: 100,
      }),
    ).rejects.toThrow("RPC cluster does not match");
    // The genesis hash is the only thing asked: no account was read.
    expect(new Set(calls)).toEqual(new Set(["getGenesisHash"]));
    expect(
      userMessage(
        new Error("RPC cluster does not match the selected environment."),
      ),
    ).toMatch(/different Solana cluster/);
  });

  it("goes on when the RPC answers with the selected cluster's genesis", async () => {
    const { connection } = rpcAnswering(CLUSTERS.devnet.genesis);
    await expect(
      assertCluster(
        customContext(connection as never, config, CLUSTERS.devnet.genesis),
      ),
    ).resolves.toBeUndefined();
  });
});
