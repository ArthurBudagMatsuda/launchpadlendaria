import { describe, expect, it } from 'vitest'
import { formatEth, formatEthExact, formatTokenAmount } from '../src/lib/format.js'

const ETH = 10n ** 18n

describe('ETH formatting', () => {
  it.each([
    [0n, '0'],
    [23_400_000_000_000_000n, '0.0234'],
    [ETH, '1'],
    [ETH + ETH / 2n, '1.5'],
    [1_234n * ETH + 567_800_000_000_000_000n, '1,234.5678'],
    [1_000_000n * ETH, '1,000,000'],
  ])('formats %s wei as %s', (wei, expected) => {
    expect(formatEth(wei)).toBe(expected)
  })

  it('truncates instead of rounding up so a balance is never overstated', () => {
    expect(formatEth(23_499_999_999_999_999n)).toBe('0.0234')
    expect(formatEth(999_999_999_999_999_999n)).toBe('0.9999')
  })

  it('shows tiny non-zero balances as <0.0001', () => {
    expect(formatEth(1n)).toBe('<0.0001')
    expect(formatEth(99_999_999_999_999n)).toBe('<0.0001')
    expect(formatEth(100_000_000_000_000n)).toBe('0.0001')
  })

  it('keeps full precision for exact values (no floating point)', () => {
    expect(formatEthExact(123_456_789_012_345_678_901n)).toBe('123.456789012345678901')
    expect(formatEth(2n ** 255n, { groupThousands: false })).toBe(
      '57896044618658097711785492504343953926634992332820282019728.792',
    )
  })

  it('supports custom precision and padding', () => {
    expect(formatEth(ETH, { minimumFractionDigits: 2 })).toBe('1.00')
    expect(formatEth(23_400_000_000_000_000n, { maximumFractionDigits: 2 })).toBe('0.02')
    expect(formatEth(1_234n * ETH, { groupThousands: false })).toBe('1234')
    expect(formatEth(1n, { maximumFractionDigits: 0 })).toBe('<1')
  })

  it('formats other decimals and negative amounts', () => {
    expect(formatTokenAmount(1_500_000n, { decimals: 6 })).toBe('1.5')
    expect(formatTokenAmount(-ETH / 4n)).toBe('-0.25')
  })
})
