import { BPS, UINT256_MAX, ceilDiv, feeOf, requireThat, uint } from './math.mjs';

// An offline accounting model, not an EVM, ERC-20 implementation or DEX emulator.
export class Curve {
  constructor(config) {
    this.config = { ...config };
    for (const key of ['supply', 'curveTokens', 'lpTokens', 'virtualTokens', 'virtualEth', 'threshold', 'feeBps', 'creatorShareBps', 'launchFee', 'creatorMinNet', 'capBps']) uint(config[key]);
    requireThat(config.curveTokens + config.lpTokens === config.supply, 'SUPPLY_ALLOCATION');
    requireThat(config.virtualTokens > config.curveTokens && config.virtualEth > 0n, 'VIRTUAL_RESERVES');
    requireThat(config.threshold > config.creatorMinNet && config.feeBps < BPS && config.creatorShareBps <= BPS && config.capBps > 0n && config.capBps <= BPS, 'CONFIGURATION');
    requireThat(config.virtualTokens * (config.virtualEth + config.threshold) <= UINT256_MAX, 'PRODUCT_BOUND');
    this.x = config.virtualTokens;
    this.y = config.virtualEth;
    this.realEth = 0n;
    this.inventory = config.curveTokens;
    this.holders = new Map();
    this.state = 'ACTIVE';
    this.launched = false;
    this.creator = null;
    this.buyGross = 0n;
    this.sellNet = 0n;
    this.totalFees = 0n;
    this.vaultBalance = 0n;
    this.feesClaimed = 0n;
    this.credits = { treasury: 0n, creator: 0n };
    this.migratedEth = 0n;
    this.lpLockedTokens = 0n;
    this.surplusLockedTokens = 0n;
    this.migratedPrice = null;
    this.initialK = this.x * this.y;
  }

  balance(actor) { return this.holders.get(actor) ?? 0n; }
  cap() { return this.config.supply * this.config.capBps / BPS; }
  price() { return { numerator: this.y, denominator: this.x }; }

  quoteBuy(gross) {
    uint(gross);
    requireThat(gross > 0n, 'ZERO_INPUT');
    const fee = feeOf(gross, this.config.feeBps);
    const net = gross - fee;
    requireThat(net > 0n, 'DUST');
    const tokens = this.x * net / (this.y + net);
    return { gross, fee, net, tokens };
  }

  launch(creator, gross, minTokens = 0n) {
    requireThat(!this.launched, 'ALREADY_LAUNCHED');
    const quote = this.quoteBuy(gross);
    requireThat(quote.net >= this.config.creatorMinNet, 'CREATOR_MINIMUM');
    this._buy(creator, quote, minTokens);
    this.creator = creator;
    this.launched = true;
    return quote;
  }

  buy(actor, gross, minTokens = 0n) {
    requireThat(this.launched, 'NOT_LAUNCHED');
    return this._buy(actor, this.quoteBuy(gross), minTokens);
  }

  _buy(actor, quote, minTokens) {
    uint(minTokens);
    requireThat(typeof actor === 'string' && actor.length > 0 && !['curve', 'lp-vault', 'locker', 'graduation-manager', 'zero'].includes(actor), 'BUY_RECIPIENT');
    requireThat(this.state === 'ACTIVE', 'TRADING_CLOSED');
    requireThat(quote.net <= this.config.threshold - this.realEth, 'THRESHOLD_EXCESS');
    requireThat(quote.tokens > 0n && quote.tokens <= this.inventory, 'INVENTORY');
    requireThat(quote.tokens >= minTokens, 'SLIPPAGE');
    requireThat(this.balance(actor) + quote.tokens <= this.cap(), 'WALLET_CAP');
    this.x -= quote.tokens;
    this.y += quote.net;
    this.realEth += quote.net;
    this.inventory -= quote.tokens;
    this.holders.set(actor, this.balance(actor) + quote.tokens);
    this.buyGross += quote.gross;
    this._accrue(quote.fee);
    if (this.realEth === this.config.threshold) this.state = 'READY';
    this.assertInvariants();
    return quote;
  }

  quoteSell(tokens) {
    uint(tokens);
    requireThat(tokens > 0n, 'ZERO_INPUT');
    const gross = this.y * tokens / (this.x + tokens);
    const fee = feeOf(gross, this.config.feeBps);
    return { tokens, gross, fee, net: gross - fee };
  }

  sell(actor, tokens, minNet = 0n) {
    uint(minNet);
    requireThat(this.launched && ['ACTIVE', 'READY'].includes(this.state), 'TRADING_CLOSED');
    const quote = this.quoteSell(tokens);
    requireThat(tokens <= this.balance(actor), 'BALANCE');
    requireThat(quote.net > 0n, 'DUST');
    requireThat(quote.gross <= this.realEth, 'REAL_RESERVE');
    requireThat(quote.net >= minNet, 'SLIPPAGE');
    this.x += tokens;
    this.y -= quote.gross;
    this.realEth -= quote.gross;
    this.inventory += tokens;
    this.holders.set(actor, this.balance(actor) - tokens);
    this.sellNet += quote.net;
    this._accrue(quote.fee);
    if (this.realEth < this.config.threshold) this.state = 'ACTIVE';
    this.assertInvariants();
    return quote;
  }

  transfer(from, to, tokens) {
    uint(tokens);
    requireThat(!['curve', 'lp-vault', 'locker', 'graduation-manager', 'zero'].includes(to), 'DIRECT_PROTOCOL_TRANSFER');
    requireThat(this.balance(from) >= tokens, 'BALANCE');
    if (from === to) return;
    requireThat(this.state === 'GRADUATED' || this.balance(to) + tokens <= this.cap(), 'WALLET_CAP');
    this.holders.set(from, this.balance(from) - tokens);
    this.holders.set(to, this.balance(to) + tokens);
    this.assertInvariants();
  }

  _accrue(fee) {
    const creator = fee * this.config.creatorShareBps / BPS;
    this.credits.creator += creator;
    this.credits.treasury += fee - creator;
    this.totalFees += fee;
    this.vaultBalance += fee;
  }

  claimFees(recipient, amount) {
    uint(amount);
    requireThat(Object.hasOwn(this.credits, recipient), 'RECIPIENT');
    requireThat(amount <= this.credits[recipient], 'FEE_CREDIT');
    this.credits[recipient] -= amount;
    this.vaultBalance -= amount;
    this.feesClaimed += amount;
    this.assertInvariants();
  }

  liquidityPlan() {
    requireThat(this.realEth > 0n, 'NO_LIQUIDITY');
    // Ideal full-range reserve-ratio proxy, NOT exact V3/V4 mint accounting.
    const needed = ceilDiv(this.realEth * this.x, this.y);
    const available = this.config.lpTokens + this.inventory;
    return {
      eth: this.realEth, availableTokens: available, idealTokens: needed,
      feasible: needed <= available,
      surplusTokens: available >= needed ? available - needed : 0n,
      shortfallTokens: needed > available ? needed - available : 0n,
      priceErrorNumerator: needed * this.y - this.realEth * this.x,
      priceErrorDenominator: needed * this.y,
    };
  }

  graduate({ fail = false } = {}) {
    requireThat(this.state === 'READY', 'NOT_READY');
    const plan = this.liquidityPlan();
    requireThat(plan.feasible, 'LP_SHORTFALL');
    requireThat(!fail, 'SIMULATED_DEX_FAILURE');
    this.migratedEth = plan.eth;
    this.lpLockedTokens = plan.idealTokens;
    this.surplusLockedTokens = plan.surplusTokens;
    this.migratedPrice = this.price();
    this.realEth = 0n;
    this.inventory = 0n;
    this.state = 'GRADUATED';
    this.assertInvariants();
    return plan;
  }

  buyAndGraduate(actor, gross, { fail = false } = {}) {
    // Local transactional copy: a DEX failure must also revert the triggering buy.
    const transaction = new Curve(this.config);
    Object.assign(transaction, structuredClone(this));
    const quote = transaction.buy(actor, gross);
    const plan = transaction.graduate({ fail });
    Object.assign(this, transaction);
    return { quote, plan };
  }

  snapshot() {
    return {
      state: this.state, launched: this.launched, creator: this.creator,
      x: this.x, y: this.y, realEth: this.realEth, inventory: this.inventory,
      holders: [...this.holders].sort(([a], [b]) => a.localeCompare(b)),
      buyGross: this.buyGross, sellNet: this.sellNet, totalFees: this.totalFees,
      vaultBalance: this.vaultBalance, feesClaimed: this.feesClaimed, credits: { ...this.credits },
      migratedEth: this.migratedEth, lpLockedTokens: this.lpLockedTokens,
      surplusLockedTokens: this.surplusLockedTokens,
    };
  }

  assertInvariants() {
    const held = [...this.holders.values()].reduce((sum, value) => sum + value, 0n);
    const supplyAccounted = held + (this.state === 'GRADUATED'
      ? this.lpLockedTokens + this.surplusLockedTokens
      : this.inventory + this.config.lpTokens);
    requireThat(supplyAccounted === this.config.supply, 'INV_SUPPLY');
    requireThat(this.buyGross === this.realEth + this.sellNet + this.vaultBalance + this.feesClaimed + this.migratedEth, 'INV_ETH');
    requireThat(this.vaultBalance === this.credits.creator + this.credits.treasury, 'INV_FEE_LIABILITY');
    requireThat(this.totalFees === this.vaultBalance + this.feesClaimed, 'INV_FEES');
    requireThat(this.x * this.y >= this.initialK, 'INV_PRODUCT');
    requireThat(this.x + held === this.config.virtualTokens, 'INV_EFFECTIVE_TOKEN_RESERVE');
    if (this.state !== 'GRADUATED') {
      requireThat(this.y === this.config.virtualEth + this.realEth && this.realEth >= 0n, 'INV_REAL_RESERVE');
      requireThat(this.x === this.inventory + this.config.virtualTokens - this.config.curveTokens, 'INV_VIRTUAL_TOKEN_OFFSET');
      requireThat(this.realEth <= this.config.threshold, 'INV_THRESHOLD');
      for (const balance of this.holders.values()) requireThat(balance >= 0n && balance <= this.cap(), 'INV_CAP');
    }
    return true;
  }
}
