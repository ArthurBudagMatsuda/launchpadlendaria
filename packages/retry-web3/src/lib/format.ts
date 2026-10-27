import { formatUnits } from 'viem'

export interface FormatTokenAmountOptions {
  /** Token decimals. Default 18 (ETH). */
  decimals?: number
  /** Fraction digits shown at most. Extra digits are truncated, never rounded up. Default 4. */
  maximumFractionDigits?: number
  /** Fraction digits always shown (zero padded). Default 0. */
  minimumFractionDigits?: number
  /** Insert `,` every three integer digits. Default true. */
  groupThousands?: boolean
}

function groupDigits(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Formats an integer amount of base units (wei) for display using string
 * arithmetic only, so no precision is lost to floating point.
 *
 * Values are truncated toward zero: a balance is never displayed as larger
 * than it is. Non-zero amounts smaller than the display precision render as
 * `<0.0001`.
 */
export function formatTokenAmount(value: bigint, options: FormatTokenAmountOptions = {}): string {
  const decimals = options.decimals ?? 18
  const maxFraction = Math.max(0, Math.trunc(options.maximumFractionDigits ?? 4))
  const minFraction = Math.min(Math.max(0, Math.trunc(options.minimumFractionDigits ?? 0)), maxFraction)
  const group = options.groupThousands ?? true

  const negative = value < 0n
  const absolute = negative ? -value : value
  const [integerPart = '0', fractionPart = ''] = formatUnits(absolute, decimals).split('.')

  let fraction = fractionPart.slice(0, maxFraction).replace(/0+$/, '')
  if (fraction.length < minFraction) fraction = fraction.padEnd(minFraction, '0')

  const sign = negative ? '-' : ''
  if (absolute !== 0n && integerPart === '0' && /^0*$/.test(fraction)) {
    const smallest = maxFraction === 0 ? '1' : `0.${'0'.repeat(maxFraction - 1)}1`
    return `${negative ? '>-' : '<'}${smallest}`
  }

  const integer = group ? groupDigits(integerPart) : integerPart
  return fraction ? `${sign}${integer}.${fraction}` : `${sign}${integer}`
}

/** `23400000000000000n` → `"0.0234"` */
export function formatEth(wei: bigint, options: Omit<FormatTokenAmountOptions, 'decimals'> = {}): string {
  return formatTokenAmount(wei, { ...options, decimals: 18 })
}

/** Full precision decimal string, e.g. for a tooltip or copy action. */
export function formatEthExact(wei: bigint): string {
  return formatUnits(wei, 18)
}
