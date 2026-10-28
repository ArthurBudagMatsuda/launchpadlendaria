/**
 * Exact decimal values for market data. Providers send prices, volumes and
 * liquidity as decimal strings (GeckoTerminal) or JSON numbers (DEX
 * Screener); both are parsed into a scaled bigint so derived values such as
 * FDV are computed without floating-point error. Numbers are only produced
 * at the edge, for charts and display.
 */
export interface Decimal {
  /** The value is `units / 10^scale`. */
  units: bigint;
  scale: number;
}

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i;
/** Prices of dust pools can carry 40+ decimals; anything longer is rejected. */
const MAX_DIGITS = 120;

export function parseDecimal(value: unknown): Decimal | null {
  const text =
    typeof value === "number"
      ? Number.isFinite(value)
        ? String(value)
        : ""
      : typeof value === "string"
        ? value.trim()
        : "";
  if (!text || text.length > MAX_DIGITS) return null;
  const match = DECIMAL_PATTERN.exec(text);
  if (!match) return null;
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  const shift = Number(exponent);
  if (!Number.isSafeInteger(shift) || Math.abs(shift) > MAX_DIGITS) return null;
  let units = BigInt(`${whole}${fraction}`);
  let scale = fraction.length - shift;
  if (scale < 0) {
    units *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return normalize({ units: sign ? -units : units, scale });
}

/** Parses a provider value that must be zero or positive. */
export function parseNonNegativeDecimal(value: unknown): Decimal | null {
  const parsed = parseDecimal(value);
  return parsed && parsed.units >= 0n ? parsed : null;
}

function normalize({ units, scale }: Decimal): Decimal {
  while (scale > 0 && units % 10n === 0n) {
    units /= 10n;
    scale -= 1;
  }
  return { units, scale };
}

/** Raw token units (e.g. `totalSupply()`) as a decimal amount. */
export function fromUnits(raw: bigint, decimals: number): Decimal {
  return normalize({ units: raw, scale: decimals });
}

export function multiply(a: Decimal, b: Decimal): Decimal {
  return normalize({ units: a.units * b.units, scale: a.scale + b.scale });
}

export function compareDecimal(a: Decimal, b: Decimal): number {
  const scale = Math.max(a.scale, b.scale);
  const left = a.units * 10n ** BigInt(scale - a.scale);
  const right = b.units * 10n ** BigInt(scale - b.scale);
  return left === right ? 0 : left > right ? 1 : -1;
}

/** Plain decimal string without exponent; `maxScale` truncates toward zero. */
export function toDecimalString(value: Decimal, maxScale?: number): string {
  let { units, scale } = value;
  if (maxScale !== undefined && scale > maxScale) {
    units /= 10n ** BigInt(scale - maxScale);
    scale = maxScale;
  }
  const negative = units < 0n;
  const digits = (negative ? -units : units)
    .toString()
    .padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, "") : "";
  const text = fraction ? `${whole}.${fraction}` : whole;
  return negative && /[1-9]/.test(text) ? `-${text}` : text;
}

/** Display and chart use only; never feed the result back into accounting. */
export function toNumber(value: Decimal): number {
  return Number(toDecimalString(value));
}
