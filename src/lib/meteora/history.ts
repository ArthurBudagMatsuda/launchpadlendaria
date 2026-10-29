import { Buffer } from "buffer";
import Decimal from "decimal.js";
import {
  PublicKey,
  type ConfirmedSignatureInfo,
  type MessageCompiledInstruction,
  type VersionedTransactionResponse,
} from "@solana/web3.js";
import { getBase58Encoder } from "@solana/kit";
import { DynamicBondingCurveIdl } from "./sdk";
import type { MeteoraContext } from "./client";
import { RETRY_LAUNCH } from "./curve";
import {
  ANCHOR_EVENT_IX_TAG,
  DAMM_TRADE_DIRECTION,
  DAMM_V2_EVENTS,
  DAMM_V2_INSTRUCTIONS,
} from "./damm-layout";
import { DAMM_V2_PROGRAM, DBC_PROGRAM } from "./programs";
import type { TradeVenue } from "./quotes";

/**
 * What a transaction did to a RETRY launch, decoded from the events the
 * Meteora programs emit (Anchor `emit_cpi!`: a self-invocation whose data is
 * the event). Nothing is inferred from token transfers: a transaction with no
 * recognised event is listed as "other", never as a trade.
 */
export type ActivityKind =
  "create" | "buy" | "sell" | "graduate" | "claim" | "other";

export interface PoolActivity {
  signature: string;
  slot: number;
  /** Seconds since epoch, from the block (or the event when the block has none). */
  time: number | null;
  kind: ActivityKind;
  venue: TradeVenue | null;
  /** The wallet that signed the swap (its `payer` account), when known. */
  trader: string | null;
  /** Lamports paid in (buy) or received (sell), fee included as charged. */
  solAmount: bigint | null;
  /** Raw token units received (buy) or sold (sell). */
  tokenAmount: bigint | null;
  fee: bigint | null;
  /** Pool price right after the trade (its next sqrt price), SOL per token. */
  priceAfterSol: string | null;
  failed: boolean;
}

const hex = (bytes: readonly number[]) => Buffer.from(bytes).toString("hex");
const EVENT_TAG = hex(ANCHOR_EVENT_IX_TAG);
const DAMM_SWAP_EVENT = hex(DAMM_V2_EVENTS.EvtSwap2);
const DAMM_CLAIM_EVENT = hex(DAMM_V2_EVENTS.EvtClaimPositionFee);
const DAMM_SWAPS = new Set(
  [DAMM_V2_INSTRUCTIONS.swap, DAMM_V2_INSTRUCTIONS.swap2].map((ix) =>
    hex(ix.discriminator),
  ),
);
const dbcIx = (name: string) =>
  hex(
    DynamicBondingCurveIdl.instructions.find((ix) => ix.name === name)!
      .discriminator,
  );
const DBC_SWAPS = new Set([dbcIx("swap"), dbcIx("swap2")]);
const DBC_MIGRATE = dbcIx("migration_damm_v2");
/** Index of the `payer` account in DBC and cp_amm swap instructions. */
const DBC_SWAP_PAYER = 9;
const DAMM_SWAP_PAYER = 8;

const Q64 = new Decimal(2).pow(64);
export function priceFromSqrt(sqrtPrice: bigint) {
  return new Decimal(sqrtPrice.toString())
    .div(Q64)
    .pow(2)
    .mul(new Decimal(10).pow(RETRY_LAUNCH.decimals - 9));
}

const u64 = (data: Buffer, offset: number) => data.readBigUInt64LE(offset);
const u128 = (data: Buffer, offset: number) =>
  u64(data, offset) + (u64(data, offset + 8) << 64n);

export interface DecodedSwap {
  pool: string;
  buy: boolean;
  solAmount: bigint;
  tokenAmount: bigint;
  fee: bigint;
  sqrtPriceAfter: bigint;
  time: number;
}

/**
 * cp_amm EvtSwap2, read field by field up to the fees: pool, direction,
 * collect fee mode, referral flag, params (amount_0, amount_1, mode), then
 * swap_result (included/excluded input, amount left, output, next sqrt price,
 * four fee amounts). Later fields changed between program versions, so only
 * this stable prefix (and the timestamp at its known place) is read.
 */
export function decodeDammSwap(data: Buffer): DecodedSwap | null {
  if (data.length < 32 + 3 + 17 + 32 + 16 + 32) return null;
  const pool = new PublicKey(data.subarray(0, 32)).toBase58();
  const direction = data[32];
  let o = 35 + 17;
  const includedIn = u64(data, o);
  const output = u64(data, o + 24);
  const sqrt = u128(data, o + 32);
  o += 48;
  const fee =
    u64(data, o) + u64(data, o + 8) + u64(data, o + 16) + u64(data, o + 24);
  o += 32;
  // included_transfer_fee_amount_in, _out, excluded_out, then current_timestamp.
  const time = data.length >= o + 32 ? Number(u64(data, o + 24)) : 0;
  const buy = direction === DAMM_TRADE_DIRECTION.bToA;
  return {
    pool,
    buy,
    solAmount: buy ? includedIn : output,
    tokenAmount: buy ? output : includedIn,
    fee,
    sqrtPriceAfter: sqrt,
    time,
  };
}

type DbcEvent = { name: string; data: Record<string, unknown> };
const field = (data: Record<string, unknown>, snake: string): unknown => {
  const camel = snake.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());
  return data[camel] ?? data[snake];
};
const asBig = (value: unknown) => BigInt(String(value ?? 0));

/** DBC trade events: EvtSwap2 (swap2) and EvtSwap3, via the SDK's IDL coder. */
function dbcSwap(event: DbcEvent): DecodedSwap | null {
  const d = event.data;
  const pool = (field(d, "pool") as PublicKey | undefined)?.toBase58();
  if (!pool) return null;
  // DBC TradeDirection: BaseToQuote = 0 (sell), QuoteToBase = 1 (buy).
  const buy = Number(field(d, "trade_direction")) === 1;
  const time = Number(field(d, "current_timestamp") ?? 0);
  if (event.name === "EvtSwap2") {
    const r = field(d, "swap_result") as Record<string, unknown>;
    const includedIn = asBig(field(r, "included_fee_input_amount"));
    const output = asBig(field(r, "output_amount"));
    return {
      pool,
      buy,
      solAmount: buy ? includedIn : output,
      tokenAmount: buy ? output : includedIn,
      fee:
        asBig(field(r, "trading_fee")) +
        asBig(field(r, "protocol_fee")) +
        asBig(field(r, "referral_fee")),
      sqrtPriceAfter: asBig(field(r, "next_sqrt_price")),
      time,
    };
  }
  if (event.name === "EvtSwap3") {
    const inAmount = asBig(field(d, "included_transfer_fee_amount_in"));
    const outAmount = asBig(field(d, "excluded_transfer_fee_amount_out"));
    return {
      pool,
      buy,
      solAmount: buy ? inAmount : outAmount,
      tokenAmount: buy ? outAmount : inAmount,
      fee:
        asBig(field(d, "trading_fee")) +
        asBig(field(d, "protocol_fee")) +
        asBig(field(d, "referral_fee")),
      sqrtPriceAfter: asBig(field(d, "next_sqrt_price")),
      time,
    };
  }
  return null;
}

/** Decode a DBC event CPI with the SDK's IDL coder; names come back as "EvtSwap2". */
function decodeDbcEvent(
  context: MeteoraContext,
  data: Buffer,
): DbcEvent | null {
  try {
    const event = context.client.program.coder.events.decode(
      data.subarray(8).toString("base64"),
    ) as DbcEvent | null;
    if (!event) return null;
    // Anchor's coder camel-cases event names ("evtSwap2").
    return {
      ...event,
      name: event.name[0].toUpperCase() + event.name.slice(1),
    };
  } catch {
    return null;
  }
}

const base58 = getBase58Encoder();
const bytes = (data: Uint8Array | string) =>
  Buffer.from(typeof data === "string" ? base58.encode(data) : data);

/**
 * Decode one transaction against one launch (its DBC pool and, once
 * graduated, its DAMM v2 pool). Events for other pools in the same
 * transaction are ignored.
 */
export function decodeActivity(
  context: MeteoraContext,
  tx: VersionedTransactionResponse,
  pools: { dbc: string; damm: string | null },
): PoolActivity {
  const signature = tx.transaction.signatures[0];
  const keys = tx.transaction.message.getAccountKeys({
    accountKeysFromLookups: tx.meta?.loadedAddresses,
  });
  const key = (index: number) => keys.get(index)?.toBase58() ?? null;
  const base: PoolActivity = {
    signature,
    slot: tx.slot,
    time: tx.blockTime ?? null,
    kind: "other",
    venue: null,
    trader: null,
    solAmount: null,
    tokenAmount: null,
    fee: null,
    priceAfterSol: null,
    failed: Boolean(tx.meta?.err),
  };
  const outer = tx.transaction.message.compiledInstructions;
  const inner = new Map(
    (tx.meta?.innerInstructions ?? []).map((group) => [
      group.index,
      group.instructions.map((ix): MessageCompiledInstruction => ({
        programIdIndex: ix.programIdIndex,
        accountKeyIndexes: ix.accounts,
        data: bytes(ix.data),
      })),
    ]),
  );
  let result = base;
  outer.forEach((top, index) => {
    let payer: string | null = null;
    // A swap emits more than one event (DBC swap2 emits EvtSwap and
    // EvtSwap2): count one per swap instruction.
    let counted = false;
    for (const ix of [top, ...(inner.get(index) ?? [])]) {
      const program = key(ix.programIdIndex);
      const data = Buffer.from(ix.data);
      const head = data.subarray(0, 8).toString("hex");
      if (program === DBC_PROGRAM.toBase58()) {
        if (DBC_SWAPS.has(head)) {
          payer = key(ix.accountKeyIndexes[DBC_SWAP_PAYER]);
          counted = false;
        }
        if (head === DBC_MIGRATE && key(ix.accountKeyIndexes[0]) === pools.dbc)
          result = { ...result, kind: "graduate", venue: "dbc" };
        if (head !== EVENT_TAG) continue;
        const event = decodeDbcEvent(context, data);
        if (!event) continue;
        const pool = (
          field(event.data, "pool") as PublicKey | undefined
        )?.toBase58();
        if (pool !== pools.dbc) continue;
        if (/^EvtInitializePool/.test(event.name))
          result = { ...result, kind: "create", venue: "dbc", trader: key(0) };
        else if (/^EvtClaim/.test(event.name) && result.kind === "other")
          result = { ...result, kind: "claim", venue: "dbc", trader: key(0) };
        const swap = counted ? null : dbcSwap(event);
        if (swap) {
          result = merge(result, swap, "dbc", payer ?? key(0));
          counted = true;
        }
      } else if (program === DAMM_V2_PROGRAM.toBase58() && pools.damm) {
        if (DAMM_SWAPS.has(head)) {
          payer = key(ix.accountKeyIndexes[DAMM_SWAP_PAYER]);
          counted = false;
        }
        if (head !== EVENT_TAG) continue;
        const event = data.subarray(8, 16).toString("hex");
        const body = data.subarray(16);
        if (event === DAMM_CLAIM_EVENT && body.length >= 96) {
          // A position holder taking its LP fees: never a trade.
          const pool = new PublicKey(body.subarray(0, 32)).toBase58();
          if (pool === pools.damm && result.kind === "other")
            result = {
              ...result,
              kind: "claim",
              venue: "damm-v2",
              trader: new PublicKey(body.subarray(64, 96)).toBase58(),
            };
          continue;
        }
        if (event !== DAMM_SWAP_EVENT || counted) continue;
        const swap = decodeDammSwap(body);
        if (swap && swap.pool === pools.damm) {
          result = merge(result, swap, "damm-v2", payer ?? key(0));
          counted = true;
        }
      }
    }
  });
  return result;
}

/** A launch's first buy shares the create transaction: it stays a "create". */
function merge(
  current: PoolActivity,
  swap: DecodedSwap,
  venue: TradeVenue,
  trader: string | null,
): PoolActivity {
  return {
    ...current,
    kind: current.kind === "create" ? "create" : swap.buy ? "buy" : "sell",
    venue,
    trader,
    solAmount: (current.solAmount ?? 0n) + swap.solAmount,
    tokenAmount: (current.tokenAmount ?? 0n) + swap.tokenAmount,
    fee: (current.fee ?? 0n) + swap.fee,
    priceAfterSol: priceFromSqrt(swap.sqrtPriceAfter)
      .toSignificantDigits(8)
      .toString(),
    time: current.time ?? (swap.time || null),
  };
}

export interface ActivityPage {
  items: PoolActivity[];
  /** Oldest signature read per pool, to ask for the page before it. */
  before: { dbc: string | null; damm: string | null };
  /** False once both pools returned fewer signatures than asked for. */
  hasMore: boolean;
}

/**
 * One page of a launch's history straight from Solana RPC: the latest
 * signatures that touched its pools, then those transactions in one batch,
 * decoded. No indexer; a page costs 2–3 RPC requests.
 */
export async function fetchActivity(
  context: MeteoraContext,
  pools: { dbc: string; damm: string | null },
  options: { limit?: number; before?: ActivityPage["before"] } = {},
): Promise<ActivityPage> {
  const limit = options.limit ?? 25;
  const read = (address: string | null, before: string | null | undefined) =>
    address && before !== null
      ? context.connection.getSignaturesForAddress(
          new PublicKey(address),
          { limit, before: before ?? undefined },
          "confirmed",
        )
      : Promise.resolve([] as ConfirmedSignatureInfo[]);
  const [dbc, damm] = await Promise.all([
    read(pools.dbc, options.before?.dbc),
    read(pools.damm, options.before?.damm),
  ]);
  const seen = new Set<string>();
  const signatures = [...dbc, ...damm]
    .filter((s) => !seen.has(s.signature) && seen.add(s.signature))
    .sort((a, b) => b.slot - a.slot);
  const txs = signatures.length
    ? await context.connection.getTransactions(
        signatures.map((s) => s.signature),
        { maxSupportedTransactionVersion: 0, commitment: "confirmed" },
      )
    : [];
  const items: PoolActivity[] = [];
  txs.forEach((tx, i) => {
    if (tx) items.push(decodeActivity(context, tx, pools));
    else
      items.push({
        signature: signatures[i].signature,
        slot: signatures[i].slot,
        time: signatures[i].blockTime ?? null,
        kind: "other",
        venue: null,
        trader: null,
        solAmount: null,
        tokenAmount: null,
        fee: null,
        priceAfterSol: null,
        failed: Boolean(signatures[i].err),
      });
  });
  return {
    items,
    before: {
      dbc: dbc.length === limit ? dbc[dbc.length - 1].signature : null,
      damm: damm.length === limit ? damm[damm.length - 1].signature : null,
    },
    hasMore: dbc.length === limit || damm.length === limit,
  };
}

export interface SolCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** SOL traded in the bucket (sum of trade amounts, fees included). */
  volumeSol: number;
}

/**
 * Candles from decoded trades of one venue: each trade moves the pool price
 * from the previous trade's post-trade price to its own. Buckets without a
 * trade are skipped, never filled. Prices are display numbers only.
 */
export function candlesFromTrades(
  activity: readonly PoolActivity[],
  venue: TradeVenue,
  intervalSeconds: number,
): SolCandle[] {
  const trades = activity
    .filter(
      (a) =>
        !a.failed &&
        a.venue === venue &&
        a.priceAfterSol != null &&
        a.time != null &&
        (a.kind === "buy" || a.kind === "sell" || a.kind === "create"),
    )
    .sort((a, b) => a.slot - b.slot);
  const candles: SolCandle[] = [];
  let previous: number | null = null;
  for (const trade of trades) {
    const price = Number(trade.priceAfterSol);
    const time = Math.floor(trade.time! / intervalSeconds) * intervalSeconds;
    const open = previous ?? price;
    const volume = Number(trade.solAmount ?? 0n) / 1e9;
    const last = candles[candles.length - 1];
    if (last && last.time === time) {
      last.high = Math.max(last.high, open, price);
      last.low = Math.min(last.low, open, price);
      last.close = price;
      last.volumeSol += volume;
    } else
      candles.push({
        time,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
        volumeSol: volume,
      });
    previous = price;
  }
  return candles;
}
