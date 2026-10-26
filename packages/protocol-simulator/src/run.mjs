import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CANDIDATES, FEE_CANDIDATES, candidate } from './fixtures.mjs';
import { UNIT, formatUnits as u, formatRatio as r, json } from './math.mjs';
import { creatorExit, feeComparison, fill, launched, randomSequence, rejectionScenarios, smallTrades, summary, thresholdComparison } from './scenarios.mjs';

const checking = process.argv.includes('--check');
const outputs = new Map();
const results = CANDIDATES.map(config => {
  const { curve, initial } = launched(config);
  const trace = [{ step: 0, action: 'creator-buy', actor: 'creator-wallet', ...initial,
    realEth: curve.realEth, inventory: curve.inventory, x: curve.x, y: curve.y, state: curve.state }];
  const milestones = [];
  for (const percent of [25n, 50n, 90n, 100n]) {
    fill(curve, config.threshold * percent / 100n, trace);
    milestones.push({ percent, ...summary(curve) });
  }
  const terminal = summary(curve);
  const liquidity = curve.liquidityPlan();
  const locked = curve.graduate();
  const headings = ['step', 'action', 'actor', 'gross', 'fee', 'net', 'tokens', 'realEth', 'inventory', 'x', 'y', 'state'];
  const csv = headings.join(',') + '\n' + trace.map(row => headings.map(key => row[key]).join(',')).join('\n') + '\n';
  outputs.set(new URL(`../results/${config.id}.csv`, import.meta.url), csv);
  return { config, initial, milestones, terminal, liquidity, locked,
    creatorExit: creatorExit(config), smallTrades: smallTrades(config),
    randomSequence: randomSequence(config), rejectedOperations: rejectionScenarios(config),
    thresholds: thresholdComparison(config) };
});

let incompatible;
try { launched(candidate('incompatible-low-reserve', UNIT / 10n)); incompatible = 'UNEXPECTED_SUCCESS'; }
catch (error) { incompatible = error.message; }
const data = {
  schemaVersion: 1,
  status: 'HYPOTHETICAL_NOT_APPROVED',
  description: 'Offline integer model; ETH amounts are wei, token amounts are base units (18 decimals). No live DEX, gas, demand or profitability forecast.',
  seed: '20261026',
  candidates: results,
  feeComparison: feeComparison(CANDIDATES[1], FEE_CANDIDATES),
  invalidCreatorCapExample: { virtualEth: UNIT / 10n, threshold: UNIT * 3n / 10n, result: incompatible },
};
const encoded = json(data);
outputs.set(new URL('../results/results.json', import.meta.url), encoded);
const hash = createHash('sha256').update(encoded).digest('hex');
outputs.set(new URL('../results/results.sha256', import.meta.url), hash + '  results.json\n');

const rows = results.map(({ config: c, initial, terminal: t, liquidity: l }) =>
  `| ${c.id} | ${u(c.virtualEth)} | ${u(c.threshold)} | ${r(c.virtualEth, c.virtualTokens, 15)} | ${u(initial.tokens, 18, 6)} | ${u(t.buyGross)} | ${u(t.totalFees)} | ${r(t.y, t.x, 15)} | ${u(l.idealTokens, 18, 6)} |`).join('\n');
const exits = results.map(({ config: c, creatorExit: e }) =>
  `| ${c.id} | ${u(e.initial.gross, 18, 18)} | ${u(e.sale.net, 18, 18)} | ${u(e.recoverableCreatorFees, 18, 18)} | ${u(e.irreversibleCostBeforeGas, 18, 18)} | ${e.realEthAfterExit} |`).join('\n');
const impacts = results.map(({ config: c, creatorExit: e }) =>
  `| ${c.id} | ${r(e.initial.net, e.initial.tokens, 18)} | ${r(e.afterBuyPrice.numerator, e.afterBuyPrice.denominator, 18)} | ${r(e.buyMarginalPriceImpact.numerator * 100n, e.buyMarginalPriceImpact.denominator, 2)}% | ${r(e.afterSellPrice.numerator, e.afterSellPrice.denominator, 18)} |`).join('\n');
const progression = results.flatMap(({ config: c, milestones }) => milestones.map(m =>
  `| ${c.id} | ${m.percent}% | ${u(m.realEth)} | ${u(m.buyGross)} | ${u(m.heldTokens, 18, 6)} | ${r(m.y, m.x, 15)} | ${u(m.totalFees)} |`)).join('\n');
const fees = data.feeComparison.map(f =>
  `| ${f.id} | ${r(f.feeBps, 100n, 2)}% | ${r(f.treasuryShareBps, 100n, 2)} / ${r(f.creatorShareBps, 100n, 2)} | ${u(f.creatorGross, 18, 18)} | ${u(f.creatorSellNet, 18, 18)} | ${u(f.irreversibleCostBeforeGas, 18, 18)} |`).join('\n');
const thresholds = results[1].thresholds.map(t => t.reachable
  ? `| ${u(t.threshold)} | ${u(t.sold, 18, 6)} | ${u(t.unsold, 18, 6)} | ${u(t.idealTokens, 18, 6)} | ${u(t.surplusTokens, 18, 6)} | feasible in ideal proxy |`
  : `| ${u(t.threshold)} | — | — | — | — | unreachable: inventory |`).join('\n');
const splits = results.map(({ config: c, smallTrades: s, randomSequence: q }) =>
  `| ${c.id} | ${s.tokenDifference} | ${s.extraGrossFromFeeRounding} | ${u(s.splitRoundTripNetLoss, 18, 18)} | ${q.buys} / ${q.sells} / ${q.rejected} |`).join('\n');
const markdown = `# Resultados reproduzíveis — Fase 2

**Hipóteses pendentes de aprovação.** Gerado por node src/run.mjs; edição manual é detectada por --check.

## Três configurações da mesma família de curva

Todas usam supply de 1 bilhão, 80% para curva, 20% inicialmente reservado para LP, taxa de 1%, divisão 80/20 entre protocolo e criador e limite de saldo de 5%. A compra inicial representa 0,01 ETH líquido na reserva. Quantidades são truncadas e preços/percentuais arredondados somente na apresentação; o JSON mantém inteiros e frações exatos.

| Modelo | ETH virtual | Graduação ETH real | Preço inicial ETH/token | Tokens do criador | ETH bruto comprado até graduação | Taxas de compra ETH | Preço terminal ETH/token | Tokens LP ideal |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows}

O preço terminal é aproximadamente 16 vezes o inicial nesta família. O preço médio de aquisição dos 800 milhões é cerca de 4 vezes o inicial. Esses fatores descrevem a curva hipotética; não representam retorno garantido. Os CSVs usam carteiras distintas para respeitar o cap e não modelam demanda orgânica.

## Impacto da compra inicial

Preço médio considera a entrada líquida de 0,01 ETH; o comprador também paga trading fee. O impacto é a variação do preço marginal, apresentado em percentual com duas casas. A venda imediata reverte a pressão inicial de preço, sujeita a taxas e arredondamento.

| Modelo | Preço médio líquido ETH/token | Preço marginal após compra | Impacto marginal aproximado | Preço marginal após venda total |
|---|---:|---:|---:|---:|
${impacts}

## Evolução nas trajetórias de compras

| Modelo | Fração do alvo | ETH real | ETH bruto acumulado | Tokens em circulação | Preço marginal ETH/token | Trading fees ETH |
|---|---:|---:|---:|---:|---:|---:|
${progression}

## Venda imediata do criador e custo de spam

| Modelo | Compra bruta ETH | Venda líquida ETH | Taxas recuperáveis pelo criador ETH | Custo irreversível incluindo lançamento, antes de gas | Reserva residual wei |
|---|---:|---:|---:|---:|---:|
${exits}

A compra de 0,01 ETH pode ser resgatada. Ela não equivale a uma taxa anti-spam de 0,01 ETH. O custo considera o criador reclamando sua própria participação nas taxas, sem subsídio nem slippage externo. Reservas residuais de arredondamento não são receita sacável do protocolo.

## Comparação de taxas — modelo B

| Hipótese | Compra e venda | Divisão protocolo/criador % | Compra bruta para 0,01 líquido | Venda imediata líquida | Custo de spam antes de gas |
|---|---:|---:|---:|---:|---:|
${fees}

## Thresholds alternativos — reservas virtuais do modelo B

| ETH real alvo | Tokens vendidos | Estoque da curva remanescente | Tokens para LP ideal | Tokens excedentes a bloquear | Resultado |
|---|---:|---:|---:|---:|---|
${thresholds}

Alvos antecipados exigem contabilizar os tokens não vendidos; usar apenas os 200 milhões reservados pode ser insuficiente para preservar o preço. O alvo de 3 ETH é o candidato que aproxima 800 milhões vendidos e 200 milhões em LP, sem grande excedente. O alvo de 4 ETH não é atingível mantendo esse inventário e essas reservas virtuais.

## Operações pequenas e sequências mistas

Cada comparação fracionada executa 1.000 compras de 0,000001 ETH líquido, compara com uma compra única de 0,001 ETH líquido e vende a posição fracionada inteira. As sequências mistas usam semente 20261026 e 2.000 tentativas por modelo.

| Modelo | Diferença fracionada − única, átomos de token | ETH bruto adicional, wei | Perda líquida no round trip ETH | Compras / vendas / rejeições na sequência |
|---|---:|---:|---:|---:|
${splits}

Operações grandes numa carteira e tentativas de ultrapassar o threshold são rejeitadas. A configuração negativa com 0,1 ETH virtual falha em ${incompatible}: a compra inicial ultrapassaria 5% do supply.

## Escopo e arquivos

- [JSON exato](../../packages/protocol-simulator/results/results.json), com checkpoints de 25%, 50%, 90%, 100%, preços, reservas, taxas e cenários.
- [CSV A](../../packages/protocol-simulator/results/A-low-reserve.csv), [CSV B](../../packages/protocol-simulator/results/B-balanced.csv), [CSV C](../../packages/protocol-simulator/results/C-deeper-reserve.csv): cada compra até a graduação.
- [Reprodução e limitações](../../packages/protocol-simulator/README.md).
- SHA-256 de results.json: ${hash}.

O plano LP é uma aproximação de reserva/proporção para full range, calculada com inteiros. Não emula ticks, arredondamento do Position Manager, mempool, swap, gas, MEV, preços externos, callbacks nem contratos implantados. A Fase 3 deve comparar a proporção com a matemática exata da DEX e testes de fork antes de aceitar uma tolerância de preço. As invariantes aqui verificam este modelo, não constituem prova dos futuros contratos.
`;
outputs.set(new URL('../../../docs/protocol/SIMULATION_RESULTS.md', import.meta.url), markdown);

for (const [path, content] of outputs) {
  if (checking) {
    const saved = await readFile(path, 'utf8');
    if (saved !== content) throw new Error(`STALE_RESULT: ${path.pathname}`);
  } else {
    await mkdir(new URL('.', path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }
}
console.log(`${checking ? 'Verified' : 'Generated'} ${outputs.size} deterministic outputs; results.json SHA-256 ${hash}`);
