import { UNIT } from './math.mjs';

// Hypothetical research fixtures. NONE is an approved production configuration.
export const SUPPLY = 1_000_000_000n * UNIT;
export const CURVE_TOKENS = SUPPLY * 8n / 10n;
export const LP_TOKENS = SUPPLY - CURVE_TOKENS;
export const VIRTUAL_TOKENS = SUPPLY * 16n / 15n;

export function candidate(id, virtualEth) {
  return Object.freeze({
    id,
    status: 'HYPOTHETICAL_NOT_APPROVED',
    supply: SUPPLY,
    curveTokens: CURVE_TOKENS,
    lpTokens: LP_TOKENS,
    virtualTokens: VIRTUAL_TOKENS,
    virtualEth,
    threshold: virtualEth * 3n,
    feeBps: 100n,
    creatorShareBps: 2_000n,
    launchFee: UNIT / 1_000n,
    creatorMinNet: UNIT / 100n,
    capBps: 500n,
  });
}

export const CANDIDATES = Object.freeze([
  candidate('A-low-reserve', UNIT / 4n),
  candidate('B-balanced', UNIT),
  candidate('C-deeper-reserve', UNIT * 3n),
]);

export const FEE_CANDIDATES = Object.freeze([
  { id: 'low', feeBps: 50n, creatorShareBps: 2_000n },
  { id: 'baseline', feeBps: 100n, creatorShareBps: 2_000n },
  { id: 'high', feeBps: 200n, creatorShareBps: 3_000n },
]);
