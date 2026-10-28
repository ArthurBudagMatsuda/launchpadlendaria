import { getAddress, isAddress, type Address, type Hex } from "viem";
import { parseNonNegativeDecimal, toDecimalString } from "./decimal";
import type { TxCounts, Windowed } from "./types";

/**
 * Small, dependency-free validators for provider JSON. Every field read from
 * a response goes through one of these; anything malformed becomes `null`
 * (optional fields) or rejects the record (identity fields).
 */
export type Json = Record<string, unknown>;

export function asObject(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

export function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

export function asString(value: unknown, maxLength = 200): string | null {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

// C0/C1 controls plus zero-width and bidi overrides (Trojan Source spoofing).
const UNSAFE_TEXT =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Display text from a provider or contract: no control characters, bounded. */
export function asLabel(value: unknown, maxLength = 64): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(UNSAFE_TEXT, "").trim();
  return clean ? clean.slice(0, maxLength) : null;
}

export function asAddress(value: unknown): Address | null {
  return typeof value === "string" && isAddress(value, { strict: false })
    ? getAddress(value)
    : null;
}

/** Pool address (20 bytes) or Uniswap v4 pool ID (32 bytes), lower-case. */
export function asPoolId(value: unknown): Hex | null {
  return typeof value === "string" &&
    /^0x([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/.test(value)
    ? (value.toLowerCase() as Hex)
    : null;
}

export function asTxHash(value: unknown): Hex | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)
    ? (value.toLowerCase() as Hex)
    : null;
}

/** Non-negative decimal as an exact string, or null. */
export function asAmount(value: unknown): string | null {
  const parsed = parseNonNegativeDecimal(value);
  return parsed ? toDecimalString(parsed) : null;
}

export function asFiniteNumber(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  return Number.isFinite(number) ? number : null;
}

export function asCount(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : null;
}

/** ISO date or millisecond timestamp, within a sane range, as ms. */
export function asTimestampMs(value: unknown): number | null {
  const ms =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : NaN;
  // Base mainnet launched in 2023; anything before is malformed.
  return Number.isFinite(ms) &&
    ms >= Date.UTC(2023, 0, 1) &&
    ms <= Date.now() + 86_400_000
    ? ms
    : null;
}

export function windowed<T>(
  source: unknown,
  keys: Record<keyof Windowed<T>, string>,
  read: (value: unknown) => T | null,
): Windowed<T> {
  const data = asObject(source);
  return {
    m5: data ? read(data[keys.m5]) : null,
    h1: data ? read(data[keys.h1]) : null,
    h6: data ? read(data[keys.h6]) : null,
    h24: data ? read(data[keys.h24]) : null,
  };
}

export function txCounts(value: unknown): TxCounts | null {
  const data = asObject(value);
  const buys = data ? asCount(data.buys) : null;
  const sells = data ? asCount(data.sells) : null;
  return buys !== null && sells !== null ? { buys, sells } : null;
}
