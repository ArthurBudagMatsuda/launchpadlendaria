import { requireThat } from './math.mjs';

export function normalizeName(raw) {
  requireThat(typeof raw === 'string' && raw.length <= 64 && /^[A-Za-z0-9 -]+$/.test(raw), 'NAME_ASCII');
  const canonical = raw.trim().replace(/ +/g, ' ').toLowerCase();
  requireThat(canonical.length >= 2 && canonical.length <= 32 && /^[a-z0-9](?:[a-z0-9 -]*[a-z0-9])$/.test(canonical), 'NAME_LENGTH_OR_BOUNDARY');
  return canonical;
}

export function normalizeTicker(raw) {
  requireThat(typeof raw === 'string' && /^[A-Za-z0-9]{2,10}$/.test(raw), 'TICKER_ASCII');
  return raw.toUpperCase();
}

export class Registry {
  constructor() {
    this.names = new Map();
    this.tickers = new Map();
    this.pairs = new Set();
    this.launches = [];
    this.entered = false;
  }

  launch(creator, name, ticker, executeAtomicLaunch) {
    requireThat(!this.entered, 'REENTRANCY');
    const n = normalizeName(name);
    const t = normalizeTicker(ticker);
    const pair = JSON.stringify([creator, n, t]);
    requireThat((this.names.get(n) ?? 0) < 2, 'NAME_LIMIT');
    requireThat((this.tickers.get(t) ?? 0) < 2, 'TICKER_LIMIT');
    requireThat(!this.pairs.has(pair), 'CREATOR_PAIR');
    this.entered = true;
    try {
      // Only registry commit/rollback is modeled. EVM-wide rollback needs Solidity tests.
      const result = executeAtomicLaunch();
      this.names.set(n, (this.names.get(n) ?? 0) + 1);
      this.tickers.set(t, (this.tickers.get(t) ?? 0) + 1);
      this.pairs.add(pair);
      this.launches.push({ creator, name: n, ticker: t });
      return result;
    } finally {
      this.entered = false;
    }
  }
}
