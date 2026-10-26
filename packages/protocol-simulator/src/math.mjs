// Every economic quantity is an integer. Fractions are numerator/denominator pairs.
export const UNIT = 10n ** 18n;
export const BPS = 10_000n;
export const UINT256_MAX = (1n << 256n) - 1n;

export function requireThat(condition, reason) {
  if (!condition) throw new Error(reason);
}

export function uint(value) {
  requireThat(typeof value === 'bigint' && value >= 0n && value <= UINT256_MAX, 'INVALID_UINT256');
  return value;
}

export function ceilDiv(a, b) {
  requireThat(a >= 0n && b > 0n, 'INVALID_DIVISION');
  return a / b + (a % b === 0n ? 0n : 1n);
}

export function feeOf(gross, feeBps) {
  uint(gross);
  requireThat(feeBps >= 0n && feeBps < BPS, 'INVALID_FEE');
  return ceilDiv(gross * feeBps, BPS);
}

export function grossForNet(net, feeBps) {
  uint(net);
  requireThat(feeBps >= 0n && feeBps < BPS, 'INVALID_FEE');
  return ceilDiv(net * BPS, BPS - feeBps);
}

export function formatUnits(value, decimals = 18, places = 9) {
  requireThat(Number.isInteger(decimals) && Number.isInteger(places) && places >= 0, 'INVALID_FORMAT');
  const sign = value < 0n ? '-' : '';
  const magnitude = value < 0n ? -value : value;
  const base = 10n ** BigInt(decimals);
  const fraction = (magnitude % base).toString().padStart(decimals, '0').slice(0, places).replace(/0+$/, '');
  return `${sign}${magnitude / base}${fraction ? `.${fraction}` : ''}`;
}

export function formatRatio(numerator, denominator, places = 12) {
  requireThat(denominator > 0n, 'INVALID_RATIO');
  // Display only: half-up decimal rounding. Execution always uses exact fractions.
  return formatUnits((numerator * 10n ** BigInt(places) + denominator / 2n) / denominator, places, places);
}

export function json(value) {
  return JSON.stringify(value, (_key, entry) => typeof entry === 'bigint' ? entry.toString() : entry, 2) + '\n';
}
