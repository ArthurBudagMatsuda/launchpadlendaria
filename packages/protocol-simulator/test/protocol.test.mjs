import test from 'node:test';
import assert from 'node:assert/strict';
import { Curve } from '../src/curve.mjs';
import { CANDIDATES, candidate } from '../src/fixtures.mjs';
import { BPS, UINT256_MAX, UNIT, ceilDiv, feeOf, grossForNet, json } from '../src/math.mjs';
import { Registry, normalizeName, normalizeTicker } from '../src/registry.mjs';
import { creatorExit, fill, launched, randomSequence, smallTrades, thresholdComparison } from '../src/scenarios.mjs';

test('integer fees never undercharge and grossForNet is the minimum sufficient gross', () => {
  for (const fee of [0n, 1n, 50n, 100n, 200n, 9_999n]) {
    for (const net of [1n, 2n, 99n, 10_001n, UNIT / 100n, UNIT]) {
      const gross = grossForNet(net, fee);
      assert.equal(gross - feeOf(gross, fee), net);
      assert.ok((gross - 1n) - feeOf(gross - 1n, fee) < net);
      assert.ok(feeOf(gross, fee) * BPS >= gross * fee);
    }
  }
});

test('invalid integer inputs, negative amounts and pathological fees are rejected', () => {
  for (const amount of [-1n, UINT256_MAX + 1n, 1, NaN]) assert.throws(() => feeOf(amount, 100n), /INVALID_UINT256/);
  assert.throws(() => ceilDiv(1n, 0n), /INVALID_DIVISION/);
  assert.throws(() => grossForNet(1n, BPS), /INVALID_FEE/);
  assert.throws(() => new Curve({ ...CANDIDATES[0], curveTokens: 1n }), /SUPPLY_ALLOCATION/);
  assert.throws(() => new Curve({ ...CANDIDATES[0], virtualEth: UINT256_MAX }), /PRODUCT_BOUND/);
});

test('canonical ASCII names and tickers have deterministic equivalence classes', () => {
  assert.equal(normalizeName('  MOON   Coin  '), 'moon coin');
  assert.equal(normalizeName('Moon-Coin'), 'moon-coin');
  assert.notEqual(normalizeName('Moon-Coin'), normalizeName('Moon Coin'));
  assert.equal(normalizeTicker('mO0n'), 'MO0N');
  for (const bad of ['Móon', 'ＭＯＯＮ', 'M\u200boon', 'Moon\tCoin', 'Moon\u00a0Coin', 'Moon_Coin', 'Moon.Coin', '🚀', '-moon', 'moon-', 'a', 'a'.repeat(33)]) {
    assert.throws(() => normalizeName(bad));
  }
  for (const bad of ['A', 'A B', 'MOÓN', 'A'.repeat(11), '']) assert.throws(() => normalizeTicker(bad));
});

test('name and ticker limits are independent and completed launches retain slots', () => {
  const registry = new Registry();
  registry.launch('alice', 'Moon Coin', 'AA', () => 'completed');
  registry.launch('bob', ' moon  COIN ', 'BB', () => 'completed');
  assert.throws(() => registry.launch('carol', 'Moon Coin', 'CC', () => {}), /NAME_LIMIT/);
  registry.launch('alice', 'Other Coin', 'AA', () => 'abandoned');
  assert.throws(() => registry.launch('dave', 'Different Coin', 'AA', () => {}), /TICKER_LIMIT/);
  assert.equal(registry.names.get('moon coin'), 2);
  assert.equal(registry.launches.length, 3);
});

test('same creator cannot repeat a canonical pair but another creator can use its second slot', () => {
  const registry = new Registry();
  registry.launch('alice', 'Moon Coin', 'MOON', () => {});
  assert.throws(() => registry.launch('alice', 'moon coin', 'moon', () => {}), /CREATOR_PAIR/);
  registry.launch('bob', 'moon coin', 'moon', () => {});
  assert.equal(registry.names.get('moon coin'), 2);
});

test('reverted launch and simulated registry reentrancy consume no slots', () => {
  const registry = new Registry();
  assert.throws(() => registry.launch('alice', 'Moon Coin', 'MOON', () => { throw new Error('REFUND_FAILED'); }), /REFUND_FAILED/);
  assert.throws(() => registry.launch('alice', 'Moon Coin', 'MOON', () => registry.launch('bob', 'Moon Coin', 'MOON', () => {})), /REENTRANCY/);
  assert.equal(registry.names.size, 0);
  assert.equal(registry.tickers.size, 0);
  assert.equal(registry.pairs.size, 0);
  assert.equal(registry.entered, false);
  registry.launch('alice', 'Moon Coin', 'MOON', () => {});
});

test('low virtual reserve conflicts with creator minimum and wallet cap; registry rolls back', () => {
  const config = candidate('invalid', UNIT / 10n);
  const curve = new Curve(config);
  const before = json(curve.snapshot());
  const registry = new Registry();
  assert.throws(() => registry.launch('alice', 'Moon Coin', 'MOON', () => curve.launch('alice', grossForNet(config.creatorMinNet, config.feeBps))), /WALLET_CAP/);
  assert.equal(json(curve.snapshot()), before);
  assert.equal(registry.names.size, 0);
});

for (const config of CANDIDATES) {
  test(`${config.id}: creator purchase is net of fees, not the launch fee`, () => {
    const { curve, initial } = launched(config);
    assert.equal(initial.net, config.creatorMinNet);
    assert.equal(curve.realEth, initial.net);
    assert.equal(curve.vaultBalance, initial.fee);
    assert.equal(curve.balance('creator-wallet'), config.virtualTokens * initial.net / (config.virtualEth + initial.net));
    assert.ok(initial.tokens <= curve.cap());
    assert.throws(() => curve.launch('second', initial.gross), /ALREADY_LAUNCHED/);
    const fresh = new Curve(config);
    const before = json(fresh.snapshot());
    assert.throws(() => fresh.launch('creator', grossForNet(config.creatorMinNet - 1n, config.feeBps)), /CREATOR_MINIMUM/);
    assert.equal(json(fresh.snapshot()), before);
  });

  test(`${config.id}: immediate creator sale cannot redeem virtual ETH`, () => {
    const result = creatorExit(config);
    assert.ok(result.sale.gross <= config.creatorMinNet);
    assert.ok(result.realEthAfterExit >= 0n && result.realEthAfterExit <= 2n);
    assert.ok(result.irreversibleCostBeforeGas > config.launchFee);
    assert.ok(result.irreversibleCostBeforeGas < config.launchFee + config.creatorMinNet);
    assert.ok(result.recoverableCreatorFees > 0n);
  });

  test(`${config.id}: rejected buy/sell/slippage/dust calls leave accounting unchanged`, () => {
    const { curve } = launched(config);
    for (const action of [
      () => curve.buy('whale', grossForNet(config.virtualEth / 5n, config.feeBps)),
      () => curve.buy('trader', grossForNet(config.threshold + 1n, config.feeBps)),
      () => curve.buy('trader', 1n),
      () => curve.buy('trader', grossForNet(1_000_000n, config.feeBps), config.supply),
      () => curve.sell('stranger', UNIT),
      () => curve.sell('creator-wallet', 1n),
      () => curve.sell('creator-wallet', UNIT, UNIT),
      () => curve.claimFees('treasury', curve.vaultBalance + 1n),
      () => curve.claimFees('other', 0n),
    ]) {
      const before = json(curve.snapshot());
      assert.throws(action);
      assert.equal(json(curve.snapshot()), before);
    }
  });

  test(`${config.id}: cap applies to transfers; splitting a purchase cannot bypass balances`, () => {
    const { curve } = launched(config);
    for (let i = 0; i < 8; i++) curve.buy(`donor-${i}`, grossForNet(config.virtualEth / 100n, config.feeBps));
    let remaining = curve.cap();
    for (let i = 0; remaining > 0n; i++) {
      const amount = curve.balance(`donor-${i}`) < remaining ? curve.balance(`donor-${i}`) : remaining;
      curve.transfer(`donor-${i}`, 'collector', amount);
      remaining -= amount;
    }
    assert.equal(curve.balance('collector'), curve.cap());
    assert.throws(() => curve.transfer('creator-wallet', 'collector', 1n), /WALLET_CAP/);
    assert.throws(() => curve.buy('collector', grossForNet(10n ** 12n, config.feeBps)), /WALLET_CAP/);
    assert.throws(() => curve.transfer('creator-wallet', 'curve', 1n), /DIRECT_PROTOCOL_TRANSFER/);
    curve.transfer('collector', 'collector', 0n);
    curve.transfer('collector', 'fresh-wallet', UNIT);
    curve.transfer('creator-wallet', 'collector', UNIT);
    curve.assertInvariants();
  });

  test(`${config.id}: 1,000 split buys and round trip do not create a rounding profit`, () => {
    const result = smallTrades(config);
    assert.ok(result.extraGrossFromFeeRounding >= 0n);
    assert.ok(result.tokenDifference <= 0n);
    assert.ok(result.splitRoundTripNetLoss > 0n);
  });

  test(`${config.id}: fees are fully funded and claiming cannot touch reserves`, () => {
    const { curve } = launched(config);
    const real = curve.realEth;
    const initialFees = curve.totalFees;
    curve.claimFees('creator', curve.credits.creator);
    curve.claimFees('treasury', curve.credits.treasury);
    assert.equal(curve.vaultBalance, 0n);
    assert.equal(curve.feesClaimed, initialFees);
    assert.equal(curve.realEth, real);
    assert.throws(() => curve.claimFees('treasury', 1n), /FEE_CREDIT/);
    curve.sell('creator-wallet', curve.balance('creator-wallet'));
    curve.assertInvariants();
  });

  test(`${config.id}: exact last wei reaches READY, failed migration rolls back and retry locks all assets once`, () => {
    const { curve } = launched(config);
    fill(curve, config.threshold - 1n);
    const before = json(curve.snapshot());
    assert.throws(() => curve.buy('last', grossForNet(2n, config.feeBps)), /THRESHOLD_EXCESS/);
    assert.equal(json(curve.snapshot()), before);
    curve.buy('last', grossForNet(1n, config.feeBps));
    assert.equal(curve.state, 'READY');
    const ready = json(curve.snapshot());
    assert.throws(() => curve.graduate({ fail: true }), /SIMULATED_DEX_FAILURE/);
    assert.equal(json(curve.snapshot()), ready);
    const plan = curve.graduate();
    assert.equal(curve.state, 'GRADUATED');
    assert.equal(curve.migratedEth, config.threshold);
    assert.equal(curve.realEth, 0n);
    assert.ok(plan.feasible);
    assert.ok(plan.priceErrorNumerator * 10_000n <= plan.priceErrorDenominator); // < 1 bps in ideal proxy
    assert.throws(() => curve.graduate(), /NOT_READY/);
    const beforeBalance = curve.balance('creator-wallet');
    for (const [actor, balance] of [...curve.holders]) if (actor !== 'creator-wallet') curve.transfer(actor, 'creator-wallet', balance);
    assert.ok(curve.balance('creator-wallet') > curve.cap() && curve.balance('creator-wallet') > beforeBalance);
    curve.assertInvariants();
  });

  test(`${config.id}: READY retains redemption and a sale reopens ACTIVE after a failed graduation`, () => {
    const { curve } = launched(config);
    fill(curve);
    assert.throws(() => curve.graduate({ fail: true }), /SIMULATED_DEX_FAILURE/);
    const sale = curve.sell('creator-wallet', UNIT);
    assert.ok(sale.net > 0n);
    assert.equal(curve.state, 'ACTIVE');
    assert.ok(curve.realEth < config.threshold);
  });

  test(`${config.id}: atomic final buy and graduation roll back together on DEX failure`, () => {
    const { curve } = launched(config);
    fill(curve, config.threshold - 1n);
    const before = json(curve.snapshot());
    const gross = grossForNet(1n, config.feeBps);
    assert.throws(() => curve.buyAndGraduate('last', gross, { fail: true }), /SIMULATED_DEX_FAILURE/);
    assert.equal(json(curve.snapshot()), before);
    curve.buyAndGraduate('last', gross);
    assert.equal(curve.state, 'GRADUATED');
    assert.throws(() => curve.sell('creator-wallet', UNIT), /TRADING_CLOSED/);
  });

  test(`${config.id}: migration before threshold is forbidden`, () => {
    const { curve } = launched(config);
    assert.throws(() => curve.graduate(), /NOT_READY/);
  });

  test(`${config.id}: rising product and complete redemption remain solvent without trading fees`, () => {
    const { curve } = launched({ ...config, feeBps: 0n });
    for (let i = 0; i < 50; i++) curve.buy(`buyer-${i}`, config.virtualEth / 1_000n);
    let previousK = curve.x * curve.y;
    for (const [actor, balance] of [...curve.holders]) {
      curve.sell(actor, balance);
      assert.ok(curve.x * curve.y >= previousK);
      previousK = curve.x * curve.y;
      assert.ok(curve.realEth >= 0n);
    }
    assert.equal(curve.inventory, config.curveTokens);
    assert.equal(curve.x, config.virtualTokens);
    assert.ok(curve.sellNet <= curve.buyGross);
  });

  test(`${config.id}: alternate thresholds expose stranded inventory and an unreachable target`, () => {
    const rows = thresholdComparison(config);
    assert.ok(rows[0].surplusTokens > 0n);
    assert.ok(rows[0].idealTokens > config.lpTokens);
    assert.ok(rows[1].surplusTokens > 0n);
    assert.ok(rows[2].feasible);
    assert.equal(rows[3].reachable, false);
  });

  test(`${config.id}: seeded mixed-operation property runs preserve all ledgers`, () => {
    for (const seed of [1n, 2n, 3n, 42n, 65535n, 20261026n, 0xffffffffn]) {
      const result = randomSequence(config, seed, 2_000);
      assert.ok(result.buys > 0 && result.sells > 0);
      assert.equal(result.buys + result.sells + result.rejected, 2_000);
      assert.ok(result.final.realEth >= 0n);
    }
  });
}
