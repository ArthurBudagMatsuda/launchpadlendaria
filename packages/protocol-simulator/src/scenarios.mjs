import { Curve } from './curve.mjs';
import { BPS, feeOf, grossForNet, requireThat } from './math.mjs';

export function launched(config) {
  const curve = new Curve(config);
  const initial = curve.launch('creator-wallet', grossForNet(config.creatorMinNet, config.feeBps));
  return { curve, initial };
}

export function summary(curve) {
  const held = [...curve.holders.values()].reduce((sum, balance) => sum + balance, 0n);
  return {
    state: curve.state, realEth: curve.realEth, buyGross: curve.buyGross,
    sellNet: curve.sellNet, totalFees: curve.totalFees, credits: { ...curve.credits },
    inventory: curve.inventory, heldTokens: held, x: curve.x, y: curve.y,
    wallets: [...curve.holders.values()].filter(balance => balance > 0n).length,
    price: curve.price(),
  };
}

export function fill(curve, target = curve.config.threshold, trace = []) {
  let sequence = 0;
  while (curve.realEth < target) {
    const net = target - curve.realEth < curve.config.virtualEth / 100n
      ? target - curve.realEth : curve.config.virtualEth / 100n;
    const actor = `buyer-${curve.realEth}-${sequence++}`;
    const quote = curve.buy(actor, grossForNet(net, curve.config.feeBps));
    trace.push({ step: trace.length + 1, action: 'buy', actor, ...quote,
      realEth: curve.realEth, inventory: curve.inventory, x: curve.x, y: curve.y, state: curve.state });
  }
  return trace;
}

export function creatorExit(config) {
  const { curve, initial } = launched(config);
  const initialPrice = { numerator: config.virtualEth, denominator: config.virtualTokens };
  const afterBuyPrice = curve.price();
  const sale = curve.sell('creator-wallet', initial.tokens);
  const totalOutlay = config.launchFee + initial.gross;
  const recoverableCreatorFees = curve.credits.creator;
  return {
    initial, sale, totalOutlay, recoverableCreatorFees,
    initialPrice, afterBuyPrice, afterSellPrice: curve.price(),
    buyMarginalPriceImpact: {
      numerator: afterBuyPrice.numerator * initialPrice.denominator - initialPrice.numerator * afterBuyPrice.denominator,
      denominator: initialPrice.numerator * afterBuyPrice.denominator,
    },
    irreversibleCostBeforeGas: totalOutlay - sale.net - recoverableCreatorFees,
    realEthAfterExit: curve.realEth,
    roundTripFeeLoss: initial.gross - sale.net,
  };
}

export function smallTrades(config, count = 1_000) {
  const pieceNet = 10n ** 12n;
  const split = launched(config).curve;
  const single = launched(config).curve;
  let splitGross = 0n;
  let splitTokens = 0n;
  for (let i = 0; i < count; i++) {
    const quote = split.buy('small-trader', grossForNet(pieceNet, config.feeBps));
    splitGross += quote.gross;
    splitTokens += quote.tokens;
  }
  const one = single.buy('small-trader', grossForNet(pieceNet * BigInt(count), config.feeBps));
  const sale = split.sell('small-trader', splitTokens);
  return { count, pieceNet, splitGross, splitTokens, singleGross: one.gross,
    singleTokens: one.tokens, tokenDifference: splitTokens - one.tokens,
    extraGrossFromFeeRounding: splitGross - one.gross,
    splitRoundTripNetLoss: splitGross - sale.net };
}

export function randomSequence(config, seed = 20261026n, steps = 2_000) {
  const { curve } = launched(config);
  let rng = seed;
  const next = () => { rng = (rng * 1664525n + 1013904223n) & 0xffffffffn; return rng; };
  let buys = 0;
  let sells = 0;
  let rejected = 0;
  for (let i = 0; i < steps && curve.state === 'ACTIVE'; i++) {
    const actor = `random-${next() % 32n}`;
    const action = next() % 5n;
    const balance = curve.balance(actor);
    try {
      if (action < 2n && balance > 0n) {
        curve.sell(actor, balance / (next() % 4n + 1n));
        sells++;
      } else {
        const amount = (next() % 1_000n + 1n) * config.virtualEth / 1_000_000n;
        const net = amount < config.threshold - curve.realEth ? amount : config.threshold - curve.realEth;
        curve.buy(actor, grossForNet(net, config.feeBps));
        buys++;
      }
    } catch (error) {
      requireThat(['WALLET_CAP', 'DUST', 'ZERO_INPUT', 'INVENTORY'].includes(error.message), `UNEXPECTED_REJECTION:${error.message}`);
      rejected++;
    }
    curve.assertInvariants();
  }
  return { seed, requestedSteps: steps, buys, sells, rejected, final: summary(curve) };
}

export function thresholdComparison(config) {
  return [1n, 2n, 3n, 4n].map(multiplier => {
    const threshold = config.virtualEth * multiplier;
    const theoreticalSold = config.virtualTokens * threshold / (config.virtualEth + threshold);
    if (theoreticalSold > config.curveTokens) return {
      multiplier, threshold, reachable: false, reason: 'Curve inventory exhausted before this reserve target', theoreticalSold,
    };
    const curve = launched({ ...config, threshold }).curve;
    fill(curve);
    const plan = curve.liquidityPlan();
    return { multiplier, threshold, reachable: true, sold: config.curveTokens - curve.inventory,
      unsold: curve.inventory, ...plan };
  });
}

export function feeComparison(config, choices) {
  return choices.map(choice => {
    const scenario = creatorExit({ ...config, ...choice });
    return { ...choice, creatorGross: scenario.initial.gross, creatorBuyFee: scenario.initial.fee,
      creatorSellGross: scenario.sale.gross, creatorSellNet: scenario.sale.net,
      creatorRebate: scenario.recoverableCreatorFees,
      irreversibleCostBeforeGas: scenario.irreversibleCostBeforeGas,
      buyFeeOnOneEth: feeOf(10n ** 18n, choice.feeBps),
      treasuryShareBps: BPS - choice.creatorShareBps };
  });
}

export function rejectionScenarios(config) {
  const { curve } = launched(config);
  const outcomes = [];
  for (const [name, actor, net] of [
    ['large-single-wallet', 'whale', config.virtualEth / 5n],
    ['creator-cap-split-buy', 'creator-wallet', config.virtualEth / 5n],
    ['threshold-overshoot', 'whale', config.threshold + 1n],
  ]) {
    try { curve.buy(actor, grossForNet(net, config.feeBps)); outcomes.push({ name, result: 'UNEXPECTED_SUCCESS' }); }
    catch (error) { outcomes.push({ name, result: error.message }); }
  }
  const dust = curve.quoteSell(1n);
  outcomes.push({ name: 'one-token-atom-sell-quote', result: dust.net === 0n ? 'DUST_REJECTED_ON_EXECUTION' : 'NONZERO' });
  return outcomes;
}
