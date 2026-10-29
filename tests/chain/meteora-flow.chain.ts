import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import BN from "bn.js";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  type Connection,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { RETRY_DBC_CONFIGS } from "@/config/retry-protocol";
import { CpAmm, derivePositionNftAccount } from "@/lib/meteora/damm-sdk";
import {
  DAMM_V2_POOL_AUTHORITY,
  dammCurrentPoint,
  prepareDammTrade,
  prepareLpFeeClaim,
  quoteDammTrade,
  readDammPool,
  verifyLockedLiquidity,
  type DammPool,
} from "@/lib/meteora/damm-v2";
import {
  candlesFromTrades,
  fetchActivity,
  type PoolActivity,
} from "@/lib/meteora/history";
import { customContext, type MeteoraContext } from "@/lib/meteora/client";
import { prepareCreateToken } from "@/lib/meteora/create-token";
import { mainnetApprovalParameters } from "@/lib/meteora/mainnet-approval";
import { configMismatches, retryCurve } from "@/lib/meteora/curve";
import { userMessage } from "@/lib/meteora/errors";
import { prepareCreatorClaim, splitTradingFee } from "@/lib/meteora/fees";
import {
  graduationPriceGap,
  graduationView,
  prepareMigration,
} from "@/lib/meteora/graduation";
import { readMetadata } from "@/lib/meteora/metadata";
import { memoryStore } from "@/lib/meteora/operations";
import {
  decodeConfig,
  listRetryPools,
  readRetryPool,
  type RetryPool,
} from "@/lib/meteora/pools";
import {
  DAMM_V2_PROGRAM,
  DBC_POOL_AUTHORITY,
  SPL_TOKEN_PROGRAM,
  SYSTEM_PROGRAM,
  WSOL_MINT,
} from "@/lib/meteora/programs";
import {
  currentPoint,
  QuoteError,
  quoteTrade,
  type TradeQuote,
} from "@/lib/meteora/quotes";
import { prepareTrade, tokenBalance } from "@/lib/meteora/trade";
import {
  execute,
  SimulationError,
  TransactionValidationError,
  type TxExpectation,
} from "@/lib/meteora/transactions";
import {
  connect,
  DEVNET_GENESIS,
  sendExpectingFailure,
  devnetFunder,
  env,
  fund,
  keypairSigner,
  log,
  refund,
  transferSol,
  writeEvidence,
} from "./harness";

const SOL = BigInt(LAMPORTS_PER_SOL);
const store = memoryStore();
/** False when Devnet had no test SOL: the chain steps are skipped, not faked. */
let funded = true;

let connection: Connection;
let funder: Keypair | null = null;
let context: MeteoraContext;
let configKey: PublicKey;
let pool: PublicKey;
let mint: PublicKey;
/** The config's fee claimer: this run's partner, or whoever created a reused config. */
let feeClaimer: PublicKey;
/** The pool when the curve completed, and the DAMM v2 pool right after migration. */
let curveEnd: RetryPool | null = null;
let dammOpen: DammPool | null = null;
/** What the flow executed, to check the decoded history against. */
const executed: {
  kind: PoolActivity["kind"];
  venue: PoolActivity["venue"];
  signature: string;
  sol: bigint;
  tokens: bigint;
}[] = [];
const partner = Keypair.generate();
const creator = Keypair.generate();
const trader = Keypair.generate();
const evidence: Record<string, unknown> = {
  partner: partner.publicKey.toBase58(),
  creator: creator.publicKey.toBase58(),
  trader: trader.publicKey.toBase58(),
};

async function run(
  label: string,
  signer: Keypair,
  prepared: {
    tx: import("@solana/web3.js").Transaction;
    expect: TxExpectation;
  },
  extraSigners: Keypair[] = [],
) {
  const { signature, result, preview } = await execute({
    context,
    tx: prepared.tx,
    signer: keypairSigner(signer),
    extraSigners,
    expect: prepared.expect,
    record: {
      cluster: context.cluster,
      kind: "buy",
      owner: signer.publicKey.toBase58(),
      pool: pool?.toBase58() ?? "",
      mint: mint?.toBase58() ?? "",
      summary: label,
    },
    store,
  });
  log(label, {
    signature,
    status: result.status,
    simulatedBalanceChange: preview.balanceChange,
    networkFee: preview.networkFee,
    units: preview.unitsConsumed,
  });
  expect(result.status).toBe("confirmed");
  return signature;
}

async function quote(
  side: TradeQuote["side"],
  amountIn: bigint,
  slippageBps = 100,
) {
  const read = await readRetryPool(context, pool);
  return quoteTrade({
    side,
    pool: {
      address: pool.toBase58(),
      raw: read.raw,
      config: read.config,
      slot: read.pool.slot,
    },
    amountIn,
    slippageBps,
    currentPoint: await currentPoint(context, read.config),
    context,
  });
}

describe(`RETRY on Meteora DBC (${env.mode})`, () => {
  beforeAll(async () => {
    connection = connect();
    const genesis = await connection.getGenesisHash();
    if (env.mode === "devnet") expect(genesis).toBe(DEVNET_GENESIS);
    funder = devnetFunder(genesis);
    if (funder) evidence.funder = funder.publicKey.toBase58();
    // Devnet: enough for config, launch, trades and claim. Graduation needs
    // ~10 SOL more and is topped up only when the test wallet has it.
    const need =
      env.mode === "local"
        ? { creator: 40, trader: 40 }
        : { creator: 0.4, trader: 1 };
    for (const [role, key] of [
      ["creator", creator],
      ["trader", trader],
    ] as const) {
      const balance = await fund(connection, key.publicKey, need[role], funder);
      log("funded", { key: key.publicKey.toBase58(), lamports: balance });
      if (balance < need[role] * LAMPORTS_PER_SOL * 0.99) funded = false;
    }
    if (!funded) {
      log("no test SOL", {
        reason: funder
          ? "the Devnet test wallet is too low; chain steps skipped"
          : "the public RPC faucet refused and RETRY_DEVNET_FUNDER is not set; chain steps skipped",
      });
      evidence.skipped = funder
        ? "Devnet test wallet too low"
        : "Devnet RPC faucet refused and no funded test wallet was given";
      writeEvidence(evidence);
      return;
    }
    await transferSol(
      connection,
      creator,
      partner.publicKey,
      0.05 * LAMPORTS_PER_SOL,
    );
    // The context is created after the config exists (or is reused).
    context = customContext(connection, null, genesis, "devnet");
  }, 600_000);

  beforeEach((test) => {
    if (!funded) test.skip();
  });

  afterAll(async () => {
    // Devnet: hand the leftover test SOL back so the test wallet lasts.
    if (!funder) return;
    for (const key of [partner, creator, trader])
      await refund(connection, key, funder.publicKey);
  });

  it("creates the RETRY config with createConfig2 (or reuses it) and it matches the reviewed parameters", async () => {
    const reuse = env.useAppConfig
      ? RETRY_DBC_CONFIGS.devnet?.address
      : env.devnetConfig;
    if (reuse) {
      configKey = new PublicKey(reuse);
      log("config reused", { config: configKey.toBase58() });
    } else {
      const config = Keypair.generate();
      const tx = await context.client.partner.createConfig2({
        config: config.publicKey,
        feeClaimer: partner.publicKey,
        leftoverReceiver: partner.publicKey,
        quoteMint: WSOL_MINT,
        payer: partner.publicKey,
        ...retryCurve(),
      });
      tx.feePayer = partner.publicKey;
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.sign(partner, config);
      const before = await connection.getBalance(partner.publicKey);
      const signature = await connection.sendRawTransaction(tx.serialize());
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature, ...latest },
        "confirmed",
      );
      configKey = config.publicKey;
      log("config created", {
        config: configKey.toBase58(),
        signature,
        cost: before - (await connection.getBalance(partner.publicKey)),
      });
      evidence.configSignature = signature;
    }
    evidence.config = configKey.toBase58();
    context = { ...context, retryConfig: configKey };
    const onchain = decodeConfig(
      context,
      await connection.getAccountInfo(configKey),
    );
    expect(configMismatches(onchain)).toEqual([]);
    expect(onchain.quoteMint.equals(WSOL_MINT)).toBe(true);
    // The Mainnet approval sheet states what the program computes from the
    // curve: the same supply split and graduation price, to the unit.
    const sheet = mainnetApprovalParameters();
    expect({
      soldOnCurve: onchain.swapBaseAmount.toString(),
      depositedAtGraduation: onchain.migrationBaseThreshold.toString(),
      migrationSqrtPrice: onchain.migrationSqrtPrice.toString(),
    }).toEqual({
      soldOnCurve: sheet.supply.soldOnCurve,
      depositedAtGraduation: sheet.supply.depositedAtGraduation,
      migrationSqrtPrice: sheet.curve.migrationSqrtPrice,
    });
    feeClaimer = onchain.feeClaimer;
    evidence.partner = feeClaimer.toBase58();
    // A config paying anyone but the recorded fee claimer is refused.
    await expect(
      prepareCreateToken(
        { ...context, feeClaimer: Keypair.generate().publicKey },
        {
          name: "RETRY Devnet Test",
          symbol: "RTEST",
          uri: env.metadataUri,
          creator: creator.publicKey,
          initialBuyLamports: 0n,
          slippageBps: 100,
        },
      ),
    ).rejects.toThrow("does not match");
    context = { ...context, feeClaimer };
  });

  it("launches a token with an atomic first buy, fixed supply and no mint or freeze authority", async () => {
    const prepared = await prepareCreateToken(context, {
      name: "RETRY Devnet Test",
      symbol: "RTEST",
      uri: env.metadataUri,
      creator: creator.publicKey,
      initialBuyLamports: SOL / 10n,
      slippageBps: 100,
    });
    pool = prepared.pool;
    mint = prepared.mint.publicKey;
    const signature = await run("create + first buy", creator, prepared, [
      prepared.mint,
    ]);
    evidence.createSignature = signature;
    evidence.pool = pool.toBase58();
    evidence.mint = mint.toBase58();

    const info = await getMint(connection, mint, "confirmed");
    expect(info.mintAuthority).toBeNull();
    expect(info.freezeAuthority).toBeNull();
    expect(info.decimals).toBe(9);
    expect(info.supply).toBe(1_000_000_000n * 10n ** 9n);

    const metadata = (await readMetadata(context, [mint])).get(mint.toBase58());
    expect(metadata).toMatchObject({
      name: "RETRY Devnet Test",
      symbol: "RTEST",
      uri: env.metadataUri,
    });
    expect(metadata?.isMutable).toBe(false);
    log("metadata", { ...metadata });

    // The creator holds exactly what the first buy returned: no hidden allocation.
    const held = await tokenBalance(context, creator.publicKey, mint);
    expect(held).toBe(prepared.initialBuyOut);
    expect(held).toBeGreaterThanOrEqual(prepared.initialBuyMinimumOut!);
    const read = await readRetryPool(context, pool);
    // Every other token sits in the pool's vault (curve + graduation liquidity).
    const vault = await getAccount(
      connection,
      new PublicKey(read.pool.baseVault),
      "confirmed",
    );
    expect(vault.amount + held).toBe(info.supply);
    expect(read.pool.creator).toBe(creator.publicKey.toBase58());
    expect(read.pool.status).toBe("active");
    log("pool after create", { ...read.pool });
  });

  it("buys with a quote from pool state and receives exactly the quoted amount", async () => {
    const q = await quote("buy", SOL / 2n);
    const before = await tokenBalance(context, trader.publicKey, mint);
    const prepared = await prepareTrade(context, {
      owner: trader.publicKey,
      pool,
      side: "buy",
      amountIn: q.amountIn,
      slippageBps: q.slippageBps,
      reviewed: q,
    });
    evidence.buySignature = await run("buy 0.5 SOL", trader, prepared);
    const after = await tokenBalance(context, trader.publicKey, mint);
    expect(after - before).toBe(prepared.quote.amountOut);
    executed.push({
      kind: "buy",
      venue: "dbc",
      signature: evidence.buySignature as string,
      sol: prepared.quote.amountInUsed,
      tokens: prepared.quote.amountOut,
    });
    const split = splitTradingFee(prepared.quote.fee);
    log("buy fee split", {
      fee: prepared.quote.fee,
      ...split,
      quote: prepared.quote,
    });
  });

  it("sells half and receives at least the quoted minimum in SOL", async () => {
    const held = await tokenBalance(context, trader.publicKey, mint);
    const q = await quote("sell", held / 2n);
    const before = BigInt(
      await connection.getBalance(trader.publicKey, "confirmed"),
    );
    const prepared = await prepareTrade(context, {
      owner: trader.publicKey,
      pool,
      side: "sell",
      amountIn: q.amountIn,
      slippageBps: q.slippageBps,
      reviewed: q,
    });
    evidence.sellSignature = await run("sell half", trader, prepared);
    executed.push({
      kind: "sell",
      venue: "dbc",
      signature: evidence.sellSignature as string,
      sol: 0n,
      tokens: prepared.quote.amountIn,
    });
    const after = BigInt(
      await connection.getBalance(trader.publicKey, "confirmed"),
    );
    // Network fee is the only other debit; WSOL is unwrapped back to SOL.
    expect(after - before + 10_000n).toBeGreaterThanOrEqual(
      prepared.quote.minimumAmountOut,
    );
    expect(await tokenBalance(context, trader.publicKey, mint)).toBe(
      held - held / 2n,
    );
  });

  it("refuses to sell more than the wallet holds", async () => {
    const held = await tokenBalance(context, trader.publicKey, mint);
    const q = await quote("sell", held + 1n);
    await expect(
      prepareTrade(context, {
        owner: trader.publicKey,
        pool,
        side: "sell",
        amountIn: q.amountIn,
        slippageBps: q.slippageBps,
        reviewed: q,
      }),
    ).rejects.toBeInstanceOf(QuoteError);
  });

  it("is stopped by the program when the minimum out is not met (slippage)", async () => {
    const q = await quote("buy", SOL / 10n);
    const tx = await context.client.pool.swap2({
      owner: trader.publicKey,
      pool,
      swapBaseForQuote: false,
      referralTokenAccount: null,
      payer: trader.publicKey,
      swapMode: 0,
      amountIn: new BN(q.amountIn.toString()),
      minimumAmountOut: new BN((q.amountOut + 1n).toString()),
    });
    const read = await readRetryPool(context, pool);
    const error = await run("slippage guard", trader, {
      tx,
      expect: {
        owner: trader.publicKey,
        dbc: ["swap2"],
        accounts: { pool, config: read.raw.poolState.config },
        ataMints: [mint, WSOL_MINT],
      },
    }).catch((cause) => cause);
    expect(error).toBeInstanceOf(SimulationError);
    expect(userMessage(error)).toMatch(/slippage/);
    log("slippage guard", { message: userMessage(error) });
  });

  it("completes the curve with a partial fill and stops quoting", async () => {
    const read = await readRetryPool(context, pool);
    const missing = read.pool.migrationQuoteThreshold - read.pool.quoteReserve;
    const balance = BigInt(
      await connection.getBalance(trader.publicKey, "confirmed"),
    );
    if (balance < missing + SOL / 2n && funder) {
      const topUp = Number(missing + SOL / 2n - balance);
      await fund(
        connection,
        trader.publicKey,
        topUp / LAMPORTS_PER_SOL,
        funder,
      );
    }
    const ready = BigInt(
      await connection.getBalance(trader.publicKey, "confirmed"),
    );
    if (ready < missing + SOL / 2n) {
      log("graduation skipped", {
        reason: "not enough test SOL",
        balance: ready,
        missing,
      });
      evidence.graduation = "skipped: not enough test SOL from the faucet";
      return;
    }
    // Offer more than needed: the program fills up to the threshold and the rest stays.
    const q = await quote("buy", missing + SOL / 5n);
    expect(q.completesCurve).toBe(true);
    expect(q.amountLeft).toBeGreaterThan(0n);
    const prepared = await prepareTrade(context, {
      owner: trader.publicKey,
      pool,
      side: "buy",
      amountIn: q.amountIn,
      slippageBps: q.slippageBps,
      reviewed: q,
    });
    evidence.completeSignature = await run("complete curve", trader, prepared);
    const after = await readRetryPool(context, pool);
    expect(after.pool.quoteReserve).toBeGreaterThanOrEqual(
      after.pool.migrationQuoteThreshold,
    );
    expect(after.pool.status).toBe("graduation-ready");
    expect(graduationView(after.pool).canMigrate).toBe(true);
    await expect(quote("buy", SOL / 10n)).rejects.toBeInstanceOf(QuoteError);
    curveEnd = after.pool;
    log("curve complete", { ...after.pool });
  });

  it("migrates to DAMM v2 with permanently locked liquidity (manual, permissionless)", async () => {
    const read = await readRetryPool(context, pool);
    if (!graduationView(read.pool).canMigrate) {
      log("migration skipped", { reason: "curve not complete" });
      return;
    }
    const dammConfig = new PublicKey(read.pool.dammV2Config);
    const dammConfigInfo = await connection.getAccountInfo(dammConfig);
    if (!dammConfigInfo) {
      // Local validators do not have Meteora's public DAMM v2 configs unless cloned.
      await expect(
        prepareMigration(context, { payer: trader.publicKey, pool }),
      ).rejects.toThrow(/DAMM v2 migration config is missing/);
      log("migration skipped", {
        reason: "DAMM v2 config account not on this validator",
        dammConfig,
      });
      evidence.migration =
        "skipped: DAMM v2 config not present on this validator";
      return;
    }
    const float = await connection.getBalance(DBC_POOL_AUTHORITY, "confirmed");
    log("pool authority rent float", { lamports: float });
    if (!float) {
      // Mirrors the cluster: without Meteora's float the program cannot migrate.
      await expect(
        prepareMigration(context, { payer: trader.publicKey, pool }),
      ).rejects.toThrow(/migration rent float is empty/);
      evidence.migration = "blocked: DBC pool authority holds no SOL here";
      return;
    }
    const before = BigInt(
      await connection.getBalance(trader.publicKey, "confirmed"),
    );
    const prepared = await prepareMigration(context, {
      payer: trader.publicKey,
      pool,
    });
    evidence.migrateSignature = await run(
      "migrate to DAMM v2",
      trader,
      prepared,
      prepared.signers,
    );
    const after = await readRetryPool(context, pool);
    expect(after.pool.isMigrated).toBe(true);
    expect(after.pool.status).toBe("graduated");
    const damm = await connection.getAccountInfo(prepared.dammV2Pool);
    expect(damm?.owner.equals(DAMM_V2_PROGRAM)).toBe(true);
    evidence.dammV2Pool = prepared.dammV2Pool.toBase58();
    // The payer repays the borrowed rent: that is the cost of graduating.
    const paid =
      before -
      BigInt(await connection.getBalance(trader.publicKey, "confirmed"));
    log("migration cost", { lamports: paid });
    expect(
      await connection.getBalance(DBC_POOL_AUTHORITY, "confirmed"),
    ).toBeGreaterThanOrEqual(float);
    // Both LP positions (partner's and creator's) are permanently locked:
    // DAMM v2 Position.vested_liquidity (offset 168) is zero and
    // permanent_locked_liquidity (184) holds the liquidity. DBC rounds each
    // 50% share down and leaves the remainder unlocked (offset 152) in the
    // creator's position, so at most 1 unit of liquidity can stay unlocked.
    const u128 = (data: Buffer, offset: number) =>
      data.readBigUInt64LE(offset) + (data.readBigUInt64LE(offset + 8) << 64n);
    const owners: string[] = [];
    for (const nft of prepared.signers) {
      const [position] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), nft.publicKey.toBuffer()],
        DAMM_V2_PROGRAM,
      );
      const [nftAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("position_nft_account"), nft.publicKey.toBuffer()],
        DAMM_V2_PROGRAM,
      );
      const data = (await connection.getAccountInfo(position))!.data;
      const locked = {
        unlocked: u128(data, 152),
        vested: u128(data, 168),
        permanent: u128(data, 184),
      };
      const holder = new PublicKey(
        (await connection.getAccountInfo(nftAccount))!.data.subarray(32, 64),
      ).toBase58();
      log("locked position", { position, holder, ...locked });
      expect(locked.unlocked).toBeLessThanOrEqual(1n);
      expect(locked.vested).toBe(0n);
      expect(locked.permanent).toBeGreaterThan(10n ** 12n);
      owners.push(holder);
    }
    expect(owners.sort()).toEqual(
      [feeClaimer.toBase58(), creator.publicKey.toBase58()].sort(),
    );
    // The DAMM v2 pool as the migration left it, before anyone trades.
    dammOpen = (await readDammPool(context, after.pool)).pool;
    log("graduated", {
      dammV2Pool: prepared.dammV2Pool,
      pool: after.pool,
      dammOpen,
    });
  });

  it("proves the lock from program state: every graduated position permanently locked, NFTs with the creator and RETRY", async () => {
    if (!dammOpen)
      return void log("lock check skipped", { reason: "not graduated" });
    const lock = await verifyLockedLiquidity(context, dammOpen);
    log("lock verification", { ...lock });
    expect(lock.verified).toBe(true);
    expect(lock.vested).toBe(0n);
    expect(lock.unlocked).toBeLessThanOrEqual(1n);
    expect(lock.permanentLocked).toBe(dammOpen.permanentLockLiquidity);
    expect(lock.permanentLocked + lock.unlocked).toBe(dammOpen.liquidity);
    expect(lock.others).toEqual([]);
    expect(Number(lock.lockedPct)).toBeGreaterThan(99.999999);
    expect(lock.positions.map((p) => p.holder).sort()).toEqual(
      [feeClaimer.toBase58(), creator.publicKey.toBase58()].sort(),
    );
    for (const p of lock.positions)
      expect(p.nftAccount).toBe(
        derivePositionNftAccount(new PublicKey(p.nftMint)).toBase58(),
      );
  });

  it("records the price and reserves across graduation and conserves the supply", async () => {
    if (!dammOpen || !curveEnd)
      return void log("graduation economics skipped", {
        reason: "not graduated",
      });
    const gap = graduationPriceGap(curveEnd.sqrtPrice, dammOpen.sqrtPrice);
    const read = await readRetryPool(context, pool);
    const dbcAfter = read.pool;
    // The DAMM v2 pool opens at the config's migration price: the token page
    // shows continuity from the two accounts it already reads.
    expect(BigInt(read.config.migrationSqrtPrice.toString())).toBe(
      dammOpen.sqrtPrice,
    );
    expect(
      graduationPriceGap(
        dbcAfter.sqrtPrice,
        BigInt(read.config.migrationSqrtPrice.toString()),
      ),
    ).toEqual(gap);
    const balance = async (address: string) =>
      (await getAccount(connection, new PublicKey(address), "confirmed"))
        .amount;
    const dbcBaseLeft = await balance(dbcAfter.baseVault);
    const dbcQuoteLeft = await balance(dbcAfter.quoteVault);
    const creatorHeld = await tokenBalance(context, creator.publicKey, mint);
    const traderHeld = await tokenBalance(context, trader.publicKey, mint);
    const figures = {
      ...gap,
      curveQuoteReserve: curveEnd.quoteReserve,
      curveBaseReserve: curveEnd.baseReserve,
      dammQuoteReserve: dammOpen.quoteReserve,
      dammBaseReserve: dammOpen.baseReserve,
      dbcQuoteVaultAfter: dbcQuoteLeft,
      dbcBaseVaultAfter: dbcBaseLeft,
      creatorHeld,
      traderHeld,
    };
    log("graduation economics", figures);
    evidence.graduationEconomics = figures;
    // No SOL appears from nowhere: the pool got at most the curve's reserve.
    expect(dammOpen.quoteReserve).toBeLessThanOrEqual(curveEnd.quoteReserve);
    expect(dammOpen.quoteReserve).toBeGreaterThan(0n);
    // Every token is in a wallet or a vault, and nothing new was minted.
    const info = await getMint(connection, mint, "confirmed");
    expect(info.mintAuthority).toBeNull();
    expect(info.supply).toBe(1_000_000_000n * 10n ** 9n);
    expect(dammOpen.baseReserve + dbcBaseLeft + creatorHeld + traderHeld).toBe(
      info.supply,
    );
    // The two prices are of the same pair; a gross gap means a wrong read.
    expect(Math.abs(Number(gap.gapPct))).toBeLessThan(50);
  });

  it("refuses curve quotes and curve trades once the token graduated", async () => {
    if (!dammOpen) return;
    await expect(quote("buy", SOL / 10n)).rejects.toBeInstanceOf(QuoteError);
    const read = await readRetryPool(context, pool);
    expect(read.pool.status).toBe("graduated");
  });

  async function dammQuote(
    side: TradeQuote["side"],
    amountIn: bigint,
    slippageBps = 100,
  ) {
    const launch = await readRetryPool(context, pool);
    const { pool: damm, state } = await readDammPool(context, launch.pool);
    return quoteDammTrade({
      side,
      pool: damm,
      state,
      amountIn,
      slippageBps,
      currentPoint: await dammCurrentPoint(context, damm),
    });
  }

  it("buys on DAMM v2 after graduation through the same trade layer and receives exactly the quote", async () => {
    if (!dammOpen)
      return void log("DAMM v2 trading skipped", { reason: "not graduated" });
    const q = await dammQuote("buy", SOL / 5n);
    expect(q.venue).toBe("damm-v2");
    const before = await tokenBalance(context, trader.publicKey, mint);
    const prepared = await prepareDammTrade(context, {
      owner: trader.publicKey,
      launch: pool,
      side: "buy",
      amountIn: q.amountIn,
      slippageBps: q.slippageBps,
      reviewed: q,
    });
    const signature = await run("DAMM v2 buy 0.2 SOL", trader, prepared);
    evidence.dammBuySignature = signature;
    const after = await tokenBalance(context, trader.publicKey, mint);
    expect(after - before).toBe(prepared.quote.amountOut);
    executed.push({
      kind: "buy",
      venue: "damm-v2",
      signature,
      sol: prepared.quote.amountIn,
      tokens: prepared.quote.amountOut,
    });
    log("DAMM v2 buy", { quote: prepared.quote });
  });

  it("sells on DAMM v2 and receives at least the quoted minimum in SOL", async () => {
    if (!dammOpen) return;
    const held = await tokenBalance(context, trader.publicKey, mint);
    const q = await dammQuote("sell", held / 20n);
    const before = BigInt(
      await connection.getBalance(trader.publicKey, "confirmed"),
    );
    const prepared = await prepareDammTrade(context, {
      owner: trader.publicKey,
      launch: pool,
      side: "sell",
      amountIn: q.amountIn,
      slippageBps: q.slippageBps,
      reviewed: q,
    });
    const signature = await run("DAMM v2 sell", trader, prepared);
    evidence.dammSellSignature = signature;
    const after = BigInt(
      await connection.getBalance(trader.publicKey, "confirmed"),
    );
    expect(after - before + 10_000n).toBeGreaterThanOrEqual(
      prepared.quote.minimumAmountOut,
    );
    expect(await tokenBalance(context, trader.publicKey, mint)).toBe(
      held - held / 20n,
    );
    executed.push({
      kind: "sell",
      venue: "damm-v2",
      signature,
      sol: 0n,
      tokens: prepared.quote.amountIn,
    });
    log("DAMM v2 sell", {
      quote: prepared.quote,
      balanceChange: after - before,
    });
  });

  it("refuses a DAMM v2 trade for a stale, moved or curve quote, and a substituted pool", async () => {
    if (!dammOpen) return;
    const q = await dammQuote("buy", SOL / 10n);
    const base = {
      owner: trader.publicKey,
      launch: pool,
      side: "buy" as const,
      amountIn: q.amountIn,
      slippageBps: q.slippageBps,
    };
    await expect(
      prepareDammTrade(context, {
        ...base,
        reviewed: { ...q, quotedAt: Date.now() - 60_000 },
      }),
    ).rejects.toThrow(/expired/);
    await expect(
      prepareDammTrade(context, {
        ...base,
        reviewed: { ...q, minimumAmountOut: q.minimumAmountOut * 2n },
      }),
    ).rejects.toThrow(/price moved/);
    await expect(
      prepareDammTrade(context, { ...base, reviewed: { ...q, venue: "dbc" } }),
    ).rejects.toThrow(/bonding curve/);
    await expect(
      prepareDammTrade(context, {
        ...base,
        reviewed: { ...q, pool: Keypair.generate().publicKey.toBase58() },
      }),
    ).rejects.toThrow(/another pool/);
    // A swap aimed at another pool is stopped before any wallet sees it.
    const prepared = await prepareDammTrade(context, { ...base, reviewed: q });
    const ix = prepared.tx.instructions.find((i) =>
      i.programId.equals(DAMM_V2_PROGRAM),
    )!;
    ix.keys[1] = { ...ix.keys[1], pubkey: Keypair.generate().publicKey };
    await expect(
      run("DAMM v2 substituted pool", trader, prepared),
    ).rejects.toBeInstanceOf(TransactionValidationError);
  });

  it("is stopped by DAMM v2 itself when the minimum out is not met", async () => {
    if (!dammOpen) return;
    const q = await dammQuote("buy", SOL / 10n);
    const launch = await readRetryPool(context, pool);
    const { state } = await readDammPool(context, launch.pool);
    const client = new CpAmm(connection);
    const tx = await client.swap2({
      payer: trader.publicKey,
      pool: new PublicKey(dammOpen.address),
      inputTokenMint: WSOL_MINT,
      outputTokenMint: mint,
      tokenAMint: mint,
      tokenBMint: WSOL_MINT,
      tokenAVault: state.tokenAVault,
      tokenBVault: state.tokenBVault,
      tokenAProgram: SPL_TOKEN_PROGRAM,
      tokenBProgram: SPL_TOKEN_PROGRAM,
      referralTokenAccount: null,
      poolState: state,
      swapMode: 0,
      amountIn: new BN(q.amountIn.toString()),
      minimumAmountOut: new BN((q.amountOut + 1n).toString()),
    });
    const failed = await sendExpectingFailure(connection, tx, [trader]);
    log("DAMM v2 slippage guard", failed);
    expect(failed.error).toBeTruthy();
    expect(failed.logs.join("\n")).toMatch(/ExceededSlippage/);
  });

  it("lets nobody withdraw the locked principal: not the creator, not a stranger, not with another NFT account", async () => {
    if (!dammOpen) return;
    const lock = await verifyLockedLiquidity(context, dammOpen);
    const mine = lock.positions.find(
      (p) => p.holder === creator.publicKey.toBase58(),
    )!;
    const theirs = lock.positions.find(
      (p) => p.holder === feeClaimer.toBase58(),
    )!;
    const client = new CpAmm(connection);
    const accounts = (position: typeof mine, signer: PublicKey) => ({
      poolAuthority: DAMM_V2_POOL_AUTHORITY,
      pool: new PublicKey(dammOpen!.address),
      position: new PublicKey(position.position),
      tokenAAccount: getAssociatedTokenAddressSync(mint, signer, true),
      tokenBAccount: getAssociatedTokenAddressSync(WSOL_MINT, signer, true),
      tokenAVault: new PublicKey(dammOpen!.tokenAVault),
      tokenBVault: new PublicKey(dammOpen!.tokenBVault),
      tokenAMint: mint,
      tokenBMint: WSOL_MINT,
      positionNftAccount: derivePositionNftAccount(
        new PublicKey(position.nftMint),
      ),
      signer,
      tokenAProgram: SPL_TOKEN_PROGRAM,
      tokenBProgram: SPL_TOKEN_PROGRAM,
    });
    const atas = (owner: PublicKey) =>
      [mint, WSOL_MINT].map((m) =>
        createAssociatedTokenAccountIdempotentInstruction(
          owner,
          getAssociatedTokenAddressSync(m, owner, true),
          owner,
          m,
        ),
      );
    const attempt = async (
      label: string,
      position: typeof mine,
      signer: Keypair,
      liquidityDelta: bigint | "all",
    ) => {
      const builder =
        liquidityDelta === "all"
          ? client._program.methods.removeAllLiquidity(new BN(0), new BN(0))
          : client._program.methods.removeLiquidity({
              liquidityDelta: new BN(liquidityDelta.toString()),
              tokenAAmountThreshold: new BN(0),
              tokenBAmountThreshold: new BN(0),
            });
      const tx = await builder
        .accountsPartial(accounts(position, signer.publicKey))
        .preInstructions(atas(signer.publicKey))
        .transaction();
      const result = await sendExpectingFailure(connection, tx, [signer]);
      log("withdrawal refused", {
        label,
        ...result,
        logs: result.logs.slice(-4),
      });
      expect(result.error, label).toBeTruthy();
      return result;
    };
    // The creator holds its NFT but its liquidity is permanently locked.
    await attempt(
      "creator removes its locked liquidity",
      mine,
      creator,
      mine.permanentLockedLiquidity,
    );
    await attempt(
      "creator removes more than its unlocked remainder",
      mine,
      creator,
      mine.unlockedLiquidity + 1n,
    );
    // A stranger signs for positions it does not hold (RETRY's and the creator's).
    await attempt(
      "stranger removes RETRY's locked liquidity",
      theirs,
      trader,
      theirs.permanentLockedLiquidity,
    );
    await attempt(
      "stranger removes everything from the creator's position",
      mine,
      trader,
      "all",
    );
    // Closing a position that still holds liquidity is refused too.
    const close = await client._program.methods
      .closePosition()
      .accountsPartial({
        positionNftMint: new PublicKey(mine.nftMint),
        positionNftAccount: derivePositionNftAccount(
          new PublicKey(mine.nftMint),
        ),
        pool: new PublicKey(dammOpen.address),
        position: new PublicKey(mine.position),
        poolAuthority: DAMM_V2_POOL_AUTHORITY,
        rentReceiver: creator.publicKey,
        owner: creator.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();
    const closed = await sendExpectingFailure(connection, close, [creator]);
    log("withdrawal refused", {
      label: "creator closes its locked position",
      ...closed,
      logs: closed.logs.slice(-4),
    });
    expect(closed.error).toBeTruthy();
    // Nothing moved.
    const again = await verifyLockedLiquidity(context, dammOpen);
    expect(again.permanentLocked).toBe(lock.permanentLocked);
    expect(again.verified).toBe(true);
  });

  it("lets only the position holder claim its LP fees, without touching the locked liquidity", async () => {
    if (!dammOpen) return;
    // A stranger cannot claim the creator's LP fees.
    await expect(
      prepareLpFeeClaim(context, { owner: trader.publicKey, launch: pool }),
    ).rejects.toThrow(/does not hold an LP position/);
    const live = await readDammPool(
      context,
      (await readRetryPool(context, pool)).pool,
    );
    const lock = await verifyLockedLiquidity(context, live.pool, live.state);
    const mine = lock.positions.find(
      (p) => p.holder === creator.publicKey.toBase58(),
    )!;
    // The pool collects fees in SOL only (collect fee mode 1).
    expect(mine.feeAClaimable).toBe(0n);
    expect(mine.feeBClaimable).toBeGreaterThan(0n);
    const client = new CpAmm(connection);
    const stolen = await client.claimPositionFee({
      owner: trader.publicKey,
      position: new PublicKey(mine.position),
      pool: new PublicKey(dammOpen.address),
      positionNftAccount: derivePositionNftAccount(new PublicKey(mine.nftMint)),
      tokenAMint: mint,
      tokenBMint: WSOL_MINT,
      tokenAVault: new PublicKey(dammOpen.tokenAVault),
      tokenBVault: new PublicKey(dammOpen.tokenBVault),
      tokenAProgram: SPL_TOKEN_PROGRAM,
      tokenBProgram: SPL_TOKEN_PROGRAM,
    });
    const refused = await sendExpectingFailure(connection, stolen, [trader]);
    log("fee claim refused", {
      label: "stranger claims the creator's LP fees",
      ...refused,
      logs: refused.logs.slice(-4),
    });
    expect(refused.error).toBeTruthy();
    // The creator can, and only SOL fees (the pool collects in SOL) arrive.
    const before = BigInt(
      await connection.getBalance(creator.publicKey, "confirmed"),
    );
    const prepared = await prepareLpFeeClaim(context, {
      owner: creator.publicKey,
      launch: pool,
    });
    const claimSignature = await run("creator LP fee claim", creator, prepared);
    evidence.lpClaimSignature = claimSignature;
    const after = BigInt(
      await connection.getBalance(creator.publicKey, "confirmed"),
    );
    const landed = await connection.getTransaction(claimSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const networkFee = BigInt(landed?.meta?.fee ?? 0);
    const liveAfter = await readDammPool(
      context,
      (await readRetryPool(context, pool)).pool,
    );
    const again = await verifyLockedLiquidity(
      context,
      liveAfter.pool,
      liveAfter.state,
    );
    const now = again.positions.find((p) => p.position === mine.position)!;
    log("LP fee claim", {
      balanceChange: after - before,
      claimable: mine.feeBClaimable,
      networkFee,
      before: mine,
      after: now,
    });
    // Exactly what the page said was claimable arrived, as SOL.
    expect(after - before + networkFee).toBe(mine.feeBClaimable);
    expect(now.feeBClaimable).toBe(0n);
    expect(now.permanentLockedLiquidity).toBe(mine.permanentLockedLiquidity);
    expect(again.verified).toBe(true);
  });

  it("lets only the creator claim the creator share of trading fees, as SOL", async () => {
    await expect(
      prepareCreatorClaim(context, { creator: trader.publicKey, pool }),
    ).rejects.toThrow(/Only the creator/);
    const before = BigInt(
      await connection.getBalance(creator.publicKey, "confirmed"),
    );
    const prepared = await prepareCreatorClaim(context, {
      creator: creator.publicKey,
      pool,
    });
    expect(prepared.amount).toBeGreaterThan(0n);
    evidence.claimSignature = await run("creator claim", creator, prepared);
    const after = BigInt(
      await connection.getBalance(creator.publicKey, "confirmed"),
    );
    // Claimed SOL minus the network fee; a new WSOL account's rent is refunded on close.
    expect(after - before).toBeGreaterThanOrEqual(prepared.amount - 10_000n);
    const read = await readRetryPool(context, pool);
    expect(read.pool.creatorQuoteFee).toBe(0n);
    log("creator claim", {
      claimed: prepared.amount,
      balanceChange: after - before,
    });
  });

  it("decodes the launch history from Meteora's events, matching what the flow executed", async () => {
    const launch = await readRetryPool(context, pool);
    const page = await fetchActivity(
      context,
      { dbc: pool.toBase58(), damm: launch.pool.dammV2Pool },
      { limit: 50 },
    );
    log("history", {
      count: page.items.length,
      kinds: page.items.map((a) => `${a.kind}/${a.venue ?? "-"}`),
    });
    const create = page.items.find(
      (a) => a.signature === evidence.createSignature,
    );
    expect(create?.kind).toBe("create");
    expect(create?.tokenAmount).toBeGreaterThan(0n);
    for (const done of executed) {
      const item = page.items.find((a) => a.signature === done.signature);
      expect(item, done.signature).toBeTruthy();
      expect(item!.kind).toBe(done.kind);
      expect(item!.venue).toBe(done.venue);
      expect(item!.trader).toBe(trader.publicKey.toBase58());
      expect(item!.tokenAmount).toBe(done.tokens);
      if (done.kind === "buy") expect(item!.solAmount).toBe(done.sol);
      expect(Number(item!.priceAfterSol)).toBeGreaterThan(0);
    }
    if (evidence.migrateSignature)
      expect(
        page.items.find((a) => a.signature === evidence.migrateSignature)?.kind,
      ).toBe("graduate");
    // Nothing that is not a swap is shown as one.
    const claim = page.items.find(
      (a) => a.signature === evidence.claimSignature,
    );
    if (claim) expect(["claim", "other"]).toContain(claim.kind);
    const curve = candlesFromTrades(page.items, "dbc", 60);
    expect(curve.length).toBeGreaterThan(0);
    if (launch.pool.dammV2Pool)
      expect(
        candlesFromTrades(page.items, "damm-v2", 60).length,
      ).toBeGreaterThan(0);
    log("candles", { curve: curve.length });
  });

  it("lists the launch from the DBC program accounts, filtered by the RETRY config", async () => {
    const pools = await listRetryPools(context);
    expect(pools.map((p) => p.address)).toContain(pool.toBase58());
    const metadata = await readMetadata(context, [mint]);
    expect(metadata.get(mint.toBase58())?.updateAuthority).toBe(
      SYSTEM_PROGRAM.toBase58(),
    );
    const ata = getAssociatedTokenAddressSync(mint, creator.publicKey);
    expect(
      (await getAccount(connection, ata)).owner.equals(creator.publicKey),
    ).toBe(true);
    writeEvidence(evidence);
  });
});
