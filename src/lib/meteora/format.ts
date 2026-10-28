import { tokenAmount } from "@/lib/format";
import { RETRY_LAUNCH } from "./curve";

const LAMPORTS = 1_000_000_000n;
const TOKEN_UNIT = 10n ** BigInt(RETRY_LAUNCH.decimals);

function decimal(raw: bigint, unit: bigint, places: number) {
  const negative = raw < 0n;
  const value = negative ? -raw : raw;
  const whole = value / unit;
  const digits = unit.toString().length - 1;
  const fraction = (value % unit)
    .toString()
    .padStart(digits, "0")
    .slice(0, places)
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Lamports as SOL with up to `places` decimals, trailing zeros trimmed. */
export const sol = (lamports: bigint, places = 4) =>
  `${decimal(lamports, LAMPORTS, places)} SOL`;

/** Raw RETRY token units (9 decimals) as a compact whole-token amount. */
export const tokens = (raw: bigint) => tokenAmount(decimal(raw, TOKEN_UNIT, 9));

function parse(text: string, decimals: number) {
  const value = text.trim();
  if (!/^\d{0,12}(\.\d*)?$/.test(value) || value === "" || value === ".")
    return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) return null;
  return (
    BigInt(whole || "0") * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0")
  );
}

/** "0.5" → 500000000n lamports; null for anything that is not a plain amount. */
export const parseSol = (text: string) => parse(text, 9);
/** "1000" → raw token units; null when invalid. */
export const parseTokens = (text: string) => parse(text, RETRY_LAUNCH.decimals);
/** Raw units back to an input string ("0.5"). */
export const solInput = (lamports: bigint) => decimal(lamports, LAMPORTS, 9);
export const tokenInput = (raw: bigint) => decimal(raw, TOKEN_UNIT, 9);
