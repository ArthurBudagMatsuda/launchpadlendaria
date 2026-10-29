import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  type VersionedTransactionResponse,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getBase58Decoder } from "@solana/kit";
import { CpAmmIdl, cpAmmCoder } from "@/lib/meteora/damm-sdk";
import {
  ANCHOR_EVENT_IX_TAG,
  DAMM_V2_EVENTS,
  DAMM_V2_INSTRUCTIONS,
  type DammInstructionLayout,
} from "@/lib/meteora/damm-layout";
import {
  checkLock,
  DAMM_V2_EVENT_AUTHORITY,
  DAMM_V2_POOL_AUTHORITY,
  graduationPriceGap,
  prepareDammTrade,
  type LockedPosition,
} from "@/lib/meteora/damm-v2";
import {
  candlesFromTrades,
  decodeActivity,
  decodeDammSwap,
  priceFromSqrt,
  type PoolActivity,
} from "@/lib/meteora/history";
import { customContext } from "@/lib/meteora/client";
import {
  DAMM_V2_PROGRAM,
  DBC_PROGRAM,
  SPL_TOKEN_PROGRAM,
  WSOL_MINT,
} from "@/lib/meteora/programs";
import { QuoteError, type TradeQuote } from "@/lib/meteora/quotes";
import { prepareTrade } from "@/lib/meteora/trade";
import {
  TransactionValidationError,
  validateTransaction,
  type TxExpectation,
} from "@/lib/meteora/transactions";

const owner = Keypair.generate().publicKey;
const dammPool = Keypair.generate().publicKey;
const dbcPool = Keypair.generate().publicKey;
const mint = Keypair.generate().publicKey;
const attacker = Keypair.generate().publicKey;
const vaultA = Keypair.generate().publicKey;
const vaultB = Keypair.generate().publicKey;
const baseAta = getAssociatedTokenAddressSync(mint, owner, true);
const wsolAta = getAssociatedTokenAddressSync(WSOL_MINT, owner, true);
const context = customContext(
  new Connection("http://127.0.0.1:1"),
  Keypair.generate().publicKey,
  "x",
);

describe("DAMM v2 layouts RETRY reads without the SDK", () => {
  it("match the official cp_amm IDL (0.2.5) instruction by instruction", () => {
    expect(CpAmmIdl.address).toBe(DAMM_V2_PROGRAM.toBase58());
    expect(CpAmmIdl.metadata.version).toBe("0.2.5");
    for (const layout of Object.values(DAMM_V2_INSTRUCTIONS)) {
      const ix = CpAmmIdl.instructions.find((i) => i.name === layout.name);
      expect(ix, layout.name).toBeDefined();
      expect([...ix!.discriminator]).toEqual([...layout.discriminator]);
      expect(ix!.accounts.map((account) => account.name)).toEqual([
        ...layout.accounts,
      ]);
    }
    for (const [name, discriminator] of Object.entries(DAMM_V2_EVENTS))
      expect(
        CpAmmIdl.events?.find((event) => event.name === name)?.discriminator,
      ).toEqual([...discriminator]);
    // anchor-lang's EVENT_IX_TAG: sha256("anchor:event")[..8] as a
    // big-endian u64, written little-endian.
    expect(ANCHOR_EVENT_IX_TAG).toEqual([
      ...createHash("sha256")
        .update("anchor:event")
        .digest()
        .subarray(0, 8)
        .reverse(),
    ]);
  });

  const swapEvent = (direction: number, sqrt: bigint, pool = dammPool) => ({
    pool,
    trade_direction: direction,
    collect_fee_mode: 1,
    has_referral: false,
    params: {
      amount_0: new BN(200_000_000),
      amount_1: new BN(1),
      swap_mode: 0,
    },
    swap_result: {
      included_fee_input_amount: new BN(200_000_000),
      excluded_fee_input_amount: new BN(198_000_000),
      amount_left: new BN(0),
      output_amount: new BN("3882963332725380"),
      next_sqrt_price: new BN(sqrt.toString()),
      claiming_fee: new BN(1_600_000),
      protocol_fee: new BN(400_000),
      compounding_fee: new BN(3),
      referral_fee: new BN(0),
    },
    included_transfer_fee_amount_in: new BN(200_000_000),
    included_transfer_fee_amount_out: new BN("3882963332725380"),
    excluded_transfer_fee_amount_out: new BN("3882963332725380"),
    current_timestamp: new BN(1_761_760_000),
    reserve_a_amount: new BN(1),
    reserve_b_amount: new BN(2),
  });

  it("decodes EvtSwap2 bytes the way the SDK's coder lays them out", () => {
    const sqrt = (3n << 64n) + 7n; // exercises both halves of the u128
    const data = cpAmmCoder.types.encode("EvtSwap2", swapEvent(1, sqrt));
    expect(decodeDammSwap(data)).toEqual({
      pool: dammPool.toBase58(),
      buy: true,
      solAmount: 200_000_000n,
      tokenAmount: 3_882_963_332_725_380n,
      fee: 2_000_003n,
      sqrtPriceAfter: sqrt,
      time: 1_761_760_000,
    });
    const sell = decodeDammSwap(
      cpAmmCoder.types.encode("EvtSwap2", swapEvent(0, 5n)),
    )!;
    // AtoB sells the token: tokens in, SOL out.
    expect([sell.buy, sell.solAmount, sell.tokenAmount]).toEqual([
      false,
      3_882_963_332_725_380n,
      200_000_000n,
    ]);
    expect(decodeDammSwap(data.subarray(0, 60))).toBeNull();
  });

  it("converts Q64.64 sqrt prices to SOL per token", () => {
    expect(priceFromSqrt(1n << 64n).toString()).toBe("1");
    // About RETRY's graduation price, 5e-8 SOL per token.
    const sqrt = 4_124_817_371_235_594n;
    expect(priceFromSqrt(sqrt).toSignificantDigits(4).toString()).toBe("5e-8");
    expect(graduationPriceGap(sqrt, sqrt).gapPct).toBe("0");
    expect(
      Number(graduationPriceGap(sqrt, (sqrt * 101n) / 100n).gapPct),
    ).toBeCloseTo(2.01, 2);
  });

  describe("history: only Meteora's events make a trade", () => {
    const payer = Keypair.generate();
    const dammKeys = (overrides: Record<string, PublicKey> = {}) => ({
      pool_authority: DAMM_V2_POOL_AUTHORITY,
      pool: dammPool,
      input_token_account: wsolAta,
      output_token_account: baseAta,
      token_a_vault: vaultA,
      token_b_vault: vaultB,
      token_a_mint: mint,
      token_b_mint: WSOL_MINT,
      payer: payer.publicKey,
      token_a_program: SPL_TOKEN_PROGRAM,
      token_b_program: SPL_TOKEN_PROGRAM,
      referral_token_account: DAMM_V2_PROGRAM,
      event_authority: DAMM_V2_EVENT_AUTHORITY,
      program: DAMM_V2_PROGRAM,
      ...overrides,
    });
    const dammIx = (layout: DammInstructionLayout) =>
      new TransactionInstruction({
        programId: DAMM_V2_PROGRAM,
        data: Buffer.concat([
          Buffer.from(layout.discriminator),
          Buffer.alloc(17),
        ]),
        keys: layout.accounts.map((name) => ({
          pubkey:
            (dammKeys() as Record<string, PublicKey>)[name] ?? payer.publicKey,
          isSigner: name === "payer" || name === "signer",
          isWritable: name !== "program",
        })),
      });
    const swapIx = dammIx(DAMM_V2_INSTRUCTIONS.swap2);
    const event = (name: keyof typeof DAMM_V2_EVENTS, body: Buffer) =>
      Buffer.concat([
        Buffer.from(ANCHOR_EVENT_IX_TAG),
        Buffer.from(DAMM_V2_EVENTS[name]),
        body,
      ]);

    function landed(
      instructions: TransactionInstruction[],
      events: Buffer[],
      err: unknown = null,
    ) {
      const message = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: Keypair.generate().publicKey.toBase58(),
        instructions,
      }).compileToV0Message();
      const programIndex = message.staticAccountKeys.findIndex((key) =>
        key.equals(DAMM_V2_PROGRAM),
      );
      const authority = message.staticAccountKeys.findIndex((key) =>
        key.equals(DAMM_V2_EVENT_AUTHORITY),
      );
      return {
        slot: 42,
        blockTime: 1_761_760_005,
        transaction: { signatures: ["sig"], message },
        meta: {
          err,
          loadedAddresses: { writable: [], readonly: [] },
          innerInstructions: events.length
            ? [
                {
                  index: 0,
                  instructions: events.map((data) => ({
                    programIdIndex: programIndex,
                    accounts: [authority],
                    data: getBase58Decoder().decode(data),
                  })),
                },
              ]
            : [],
        },
      } as unknown as VersionedTransactionResponse;
    }
    const pools = { dbc: dbcPool.toBase58(), damm: dammPool.toBase58() };
    const sqrt = 4_124_817_371_235_594n;

    it("reads a DAMM v2 buy from its EvtSwap2, with the signer as trader", () => {
      const tx = landed(
        [swapIx],
        [
          event(
            "EvtSwap2",
            cpAmmCoder.types.encode("EvtSwap2", swapEvent(1, sqrt)),
          ),
        ],
      );
      expect(decodeActivity(context, tx, pools)).toMatchObject({
        kind: "buy",
        venue: "damm-v2",
        trader: payer.publicKey.toBase58(),
        solAmount: 200_000_000n,
        tokenAmount: 3_882_963_332_725_380n,
        fee: 2_000_003n,
        time: 1_761_760_005,
        failed: false,
      });
    });

    it("never counts a token transfer, another pool's swap or a failed swap as a trade", () => {
      const transfer = landed(
        [
          createTransferInstruction(
            baseAta,
            getAssociatedTokenAddressSync(mint, attacker, true),
            payer.publicKey,
            1_000n,
          ),
        ],
        [],
      );
      expect(decodeActivity(context, transfer, pools).kind).toBe("other");
      const elsewhere = landed(
        [swapIx],
        [
          event(
            "EvtSwap2",
            cpAmmCoder.types.encode("EvtSwap2", swapEvent(1, sqrt, attacker)),
          ),
        ],
      );
      expect(decodeActivity(context, elsewhere, pools).kind).toBe("other");
      // A failed transaction emits no events: listed, marked failed, not a trade.
      const failed = decodeActivity(
        context,
        landed([swapIx], [], { InstructionError: [0, { Custom: 6002 }] }),
        pools,
      );
      expect([failed.kind, failed.failed]).toEqual(["other", true]);
      // An event-shaped instruction from another program is ignored.
      const forged = landed(
        [
          new TransactionInstruction({
            programId: attacker,
            data: event(
              "EvtSwap2",
              cpAmmCoder.types.encode("EvtSwap2", swapEvent(1, sqrt)),
            ),
            keys: [],
          }),
        ],
        [],
      );
      expect(decodeActivity(context, forged, pools).kind).toBe("other");
    });

    it("reads an LP fee claim as a claim by the position holder", () => {
      const holder = Keypair.generate().publicKey;
      const body = cpAmmCoder.types.encode("EvtClaimPositionFee", {
        pool: dammPool,
        position: Keypair.generate().publicKey,
        owner: holder,
        fee_a_claimed: new BN(0),
        fee_b_claimed: new BN(7_610_420),
      });
      const tx = landed(
        [dammIx(DAMM_V2_INSTRUCTIONS.claim_position_fee)],
        [event("EvtClaimPositionFee", body)],
      );
      expect(decodeActivity(context, tx, pools)).toMatchObject({
        kind: "claim",
        venue: "damm-v2",
        trader: holder.toBase58(),
        solAmount: null,
      });
    });
  });
});

describe("DAMM v2 transaction allowlist (adversarial)", () => {
  const accounts = {
    pool_authority: DAMM_V2_POOL_AUTHORITY,
    pool: dammPool,
    input_token_account: wsolAta,
    output_token_account: baseAta,
    token_a_vault: vaultA,
    token_b_vault: vaultB,
    token_a_mint: mint,
    token_b_mint: WSOL_MINT,
    payer: owner,
    token_a_program: SPL_TOKEN_PROGRAM,
    token_b_program: SPL_TOKEN_PROGRAM,
    referral_token_account: DAMM_V2_PROGRAM,
    event_authority: DAMM_V2_EVENT_AUTHORITY,
    program: DAMM_V2_PROGRAM,
  };
  const expectation: TxExpectation = {
    owner,
    dbc: [],
    damm: ["swap2"],
    accounts,
    ataMints: [mint, WSOL_MINT],
  };
  const swapIx = (
    overrides: Partial<Record<keyof typeof accounts, PublicKey>> = {},
    layout: DammInstructionLayout = DAMM_V2_INSTRUCTIONS.swap2,
  ) =>
    new TransactionInstruction({
      programId: DAMM_V2_PROGRAM,
      data: Buffer.concat([
        Buffer.from(layout.discriminator),
        Buffer.alloc(17),
      ]),
      keys: layout.accounts.map((name) => ({
        pubkey:
          { ...accounts, ...overrides }[name as keyof typeof accounts] ??
          Keypair.generate().publicKey,
        isSigner: name === "payer",
        isWritable: true,
      })),
    });
  function buyTx(swap = swapIx()) {
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
      swap,
      createCloseAccountInstruction(wsolAta, owner, owner),
    );
    return tx;
  }

  it("accepts the swap RETRY builds for a graduated pool", () => {
    expect(() => validateTransaction(buyTx(), expectation)).not.toThrow();
  });

  it.each([
    ["pool", { pool: attacker }],
    ["token_a_vault", { token_a_vault: attacker }],
    ["output_token_account", { output_token_account: attacker }],
    ["token_a_mint", { token_a_mint: attacker }],
    ["referral_token_account", { referral_token_account: attacker }],
    ["event_authority", { event_authority: attacker }],
  ])("rejects a substituted %s account", (_, override) => {
    expect(() =>
      validateTransaction(buyTx(swapIx(override)), expectation),
    ).toThrow(TransactionValidationError);
  });

  it("rejects DAMM v2 instructions the operation does not need", () => {
    // A fee claim slipped into a trade, and a swap where only a claim is allowed.
    expect(() =>
      validateTransaction(
        buyTx(swapIx({}, DAMM_V2_INSTRUCTIONS.claim_position_fee)),
        expectation,
      ),
    ).toThrow(/Unexpected DAMM v2 instruction claim_position_fee/);
    expect(() =>
      validateTransaction(buyTx(), {
        ...expectation,
        damm: ["claim_position_fee"],
      }),
    ).toThrow(/Unexpected DAMM v2 instruction swap2/);
    // remove_liquidity is not in RETRY's layouts at all.
    const remove = CpAmmIdl.instructions.find(
      (ix) => ix.name === "remove_liquidity",
    )!;
    const withdraw = new TransactionInstruction({
      programId: DAMM_V2_PROGRAM,
      data: Buffer.from(remove.discriminator),
      keys: [],
    });
    expect(() => validateTransaction(buyTx(withdraw), expectation)).toThrow(
      /Unexpected DAMM v2 instruction unknown/,
    );
  });

  it("does not take a DAMM v2 instruction for a DBC one (same Anchor names)", () => {
    // swap2 has the same discriminator in both programs: the program ID decides.
    const asDbc = swapIx();
    asDbc.programId = DBC_PROGRAM;
    expect(() => validateTransaction(buyTx(asDbc), expectation)).toThrow(
      /Unexpected Meteora instruction swap2/,
    );
  });
});

describe("DAMM v2 trading guards", () => {
  const dammQuote = {
    venue: "damm-v2",
    side: "buy",
    pool: dammPool.toBase58(),
    quotedAt: Date.now(),
  } as TradeQuote;

  it("never sends a curve quote to DAMM v2 or a DAMM v2 quote to the curve", async () => {
    const input = {
      owner,
      side: "buy" as const,
      amountIn: 1n,
      slippageBps: 100,
    };
    // Both refuse before any RPC call (this context's RPC does not exist).
    await expect(
      prepareTrade(context, { ...input, pool: dbcPool, reviewed: dammQuote }),
    ).rejects.toThrow(/trades on DAMM v2 now/);
    await expect(
      prepareDammTrade(context, {
        ...input,
        launch: dbcPool,
        reviewed: { ...dammQuote, venue: "dbc" },
      }),
    ).rejects.toThrow(QuoteError);
  });
});

describe("lock verification from position state", () => {
  const position = (
    permanent: bigint,
    unlocked = 0n,
    vested = 0n,
  ): LockedPosition => ({
    position: Keypair.generate().publicKey.toBase58(),
    nftMint: Keypair.generate().publicKey.toBase58(),
    nftAccount: Keypair.generate().publicKey.toBase58(),
    holder: Keypair.generate().publicKey.toBase58(),
    unlockedLiquidity: unlocked,
    vestedLiquidity: vested,
    permanentLockedLiquidity: permanent,
    feeAPending: 0n,
    feeBPending: 0n,
  });
  // The figures measured at graduation on the validator.
  const creator = position(411657202295550785824274880615505n, 1n);
  const partner = position(411657202213054352498513200089599n);
  const locked =
    creator.permanentLockedLiquidity + partner.permanentLockedLiquidity;
  const pool = { liquidity: locked + 1n, permanentLockLiquidity: locked };

  it("verifies the graduated lock: two locked positions, 1 unit of rounding left", () => {
    const lock = checkLock(pool, [partner, creator]);
    expect(lock.verified).toBe(true);
    expect(lock.positions).toEqual([creator, partner]);
    expect(lock.others).toEqual([]);
    expect([lock.unlocked, lock.vested]).toEqual([1n, 0n]);
    expect(Number(lock.lockedPct)).toBeGreaterThan(99.999999);
  });

  it("fails when any graduated liquidity could be withdrawn or vests", () => {
    expect(
      checkLock(pool, [creator, position(partner.permanentLockedLiquidity, 2n)])
        .verified,
    ).toBe(false);
    expect(
      checkLock(pool, [
        creator,
        position(partner.permanentLockedLiquidity, 0n, 5n),
      ]).verified,
    ).toBe(false);
    expect(checkLock(pool, [creator]).verified).toBe(false);
    expect(
      checkLock({ ...pool, permanentLockLiquidity: locked - 1n }, [
        creator,
        partner,
      ]).verified,
    ).toBe(false);
    expect(
      checkLock({ liquidity: 0n, permanentLockLiquidity: 0n }, []).verified,
    ).toBe(false);
  });

  it("reports later positions apart instead of failing on them", () => {
    const stranger = position(0n, 10n ** 30n);
    const lock = checkLock(
      { ...pool, liquidity: pool.liquidity + 10n ** 30n },
      [stranger, creator, partner],
    );
    expect(lock.verified).toBe(true);
    expect(lock.others).toEqual([stranger]);
    expect(Number(lock.lockedPct)).toBeLessThan(100);
  });
});

describe("candles from decoded trades", () => {
  const trade = (
    slot: number,
    time: number,
    price: string,
    sol: bigint,
    extra: Partial<PoolActivity> = {},
  ): PoolActivity => ({
    signature: `s${slot}`,
    slot,
    time,
    kind: "buy",
    venue: "dbc",
    trader: null,
    solAmount: sol,
    tokenAmount: 1n,
    fee: 0n,
    priceAfterSol: price,
    failed: false,
    ...extra,
  });

  it("opens each candle at the previous trade's price and skips empty buckets", () => {
    const candles = candlesFromTrades(
      [
        trade(3, 130, "3", 1_000_000_000n, { kind: "sell" }),
        trade(1, 60, "1", 500_000_000n, { kind: "create" }),
        trade(2, 70, "2", 500_000_000n),
        trade(4, 400, "9", 1n, { failed: true }),
        trade(5, 410, "9", 1n, { venue: "damm-v2" }),
        trade(6, 420, "9", 1n, { kind: "claim" }),
      ],
      "dbc",
      60,
    );
    expect(candles).toEqual([
      { time: 60, open: 1, high: 2, low: 1, close: 2, volumeSol: 1 },
      { time: 120, open: 2, high: 3, low: 2, close: 3, volumeSol: 1 },
    ]);
    expect(candlesFromTrades([], "damm-v2", 60)).toEqual([]);
  });
});
