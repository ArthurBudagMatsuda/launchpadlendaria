# Resultados reproduzíveis — Fase 2

**Hipóteses pendentes de aprovação.** Gerado por node src/run.mjs; edição manual é detectada por --check.

## Três configurações da mesma família de curva

Todas usam supply de 1 bilhão, 80% para curva, 20% inicialmente reservado para LP, taxa de 1%, divisão 80/20 entre protocolo e criador e limite de saldo de 5%. A compra inicial representa 0,01 ETH líquido na reserva. Quantidades são truncadas e preços/percentuais arredondados somente na apresentação; o JSON mantém inteiros e frações exatos.

| Modelo | ETH virtual | Graduação ETH real | Preço inicial ETH/token | Tokens do criador | ETH bruto comprado até graduação | Taxas de compra ETH | Preço terminal ETH/token | Tokens LP ideal |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A-low-reserve | 0.25 | 0.75 | 0.000000000234375 | 41025641.025641 | 0.757575757 | 0.007575757 | 0.00000000375 | 200000000 |
| B-balanced | 1 | 3 | 0.0000000009375 | 10561056.10561 | 3.03030303 | 0.03030303 | 0.000000015 | 200000000 |
| C-deeper-reserve | 3 | 9 | 0.0000000028125 | 3543743.078626 | 9.09090909 | 0.09090909 | 0.000000045 | 200000000 |

O preço terminal é aproximadamente 16 vezes o inicial nesta família. O preço médio de aquisição dos 800 milhões é cerca de 4 vezes o inicial. Esses fatores descrevem a curva hipotética; não representam retorno garantido. Os CSVs usam carteiras distintas para respeitar o cap e não modelam demanda orgânica.

## Impacto da compra inicial

Preço médio considera a entrada líquida de 0,01 ETH; o comprador também paga trading fee. O impacto é a variação do preço marginal, apresentado em percentual com duas casas. A venda imediata reverte a pressão inicial de preço, sujeita a taxas e arredondamento.

| Modelo | Preço médio líquido ETH/token | Preço marginal após compra | Impacto marginal aproximado | Preço marginal após venda total |
|---|---:|---:|---:|---:|
| A-low-reserve | 0.00000000024375 | 0.0000000002535 | 8.16% | 0.000000000234375 |
| B-balanced | 0.000000000946875 | 0.00000000095634375 | 2.01% | 0.0000000009375 |
| C-deeper-reserve | 0.000000002821875 | 0.00000000283128125 | 0.67% | 0.0000000028125 |

## Evolução nas trajetórias de compras

| Modelo | Fração do alvo | ETH real | ETH bruto acumulado | Tokens em circulação | Preço marginal ETH/token | Trading fees ETH |
|---|---:|---:|---:|---:|---:|---:|
| A-low-reserve | 25% | 0.1875 | 0.189393939 | 457142857.142857 | 0.000000000717773 | 0.001893939 |
| A-low-reserve | 50% | 0.375 | 0.378787878 | 639999999.999999 | 0.000000001464844 | 0.003787878 |
| A-low-reserve | 90% | 0.675 | 0.681818181 | 778378378.378378 | 0.000000003208594 | 0.006818181 |
| A-low-reserve | 100% | 0.75 | 0.757575757 | 799999999.999999 | 0.00000000375 | 0.007575757 |
| B-balanced | 25% | 0.75 | 0.757575757 | 457142857.142857 | 0.000000002871094 | 0.007575757 |
| B-balanced | 50% | 1.5 | 1.515151515 | 639999999.999999 | 0.000000005859375 | 0.015151515 |
| B-balanced | 90% | 2.7 | 2.727272727 | 778378378.378378 | 0.000000012834375 | 0.027272727 |
| B-balanced | 100% | 3 | 3.03030303 | 799999999.999999 | 0.000000015 | 0.03030303 |
| C-deeper-reserve | 25% | 2.25 | 2.272727272 | 457142857.142857 | 0.000000008613281 | 0.022727272 |
| C-deeper-reserve | 50% | 4.5 | 4.545454545 | 639999999.999999 | 0.000000017578125 | 0.045454545 |
| C-deeper-reserve | 90% | 8.1 | 8.181818181 | 778378378.378378 | 0.000000038503125 | 0.081818181 |
| C-deeper-reserve | 100% | 9 | 9.09090909 | 799999999.999999 | 0.000000045 | 0.09090909 |

## Venda imediata do criador e custo de spam

| Modelo | Compra bruta ETH | Venda líquida ETH | Taxas recuperáveis pelo criador ETH | Custo irreversível incluindo lançamento, antes de gas | Reserva residual wei |
|---|---:|---:|---:|---:|---:|
| A-low-reserve | 0.010101010101010102 | 0.0099 | 0.00004020202020202 | 0.001160808080808082 | 0 |
| B-balanced | 0.010101010101010102 | 0.009899999999999999 | 0.00004020202020202 | 0.001160808080808083 | 1 |
| C-deeper-reserve | 0.010101010101010102 | 0.009899999999999999 | 0.00004020202020202 | 0.001160808080808083 | 1 |

A compra de 0,01 ETH pode ser resgatada. Ela não equivale a uma taxa anti-spam de 0,01 ETH. O custo considera o criador reclamando sua própria participação nas taxas, sem subsídio nem slippage externo. Reservas residuais de arredondamento não são receita sacável do protocolo.

## Comparação de taxas — modelo B

| Hipótese | Compra e venda | Divisão protocolo/criador % | Compra bruta para 0,01 líquido | Venda imediata líquida | Custo de spam antes de gas |
|---|---:|---:|---:|---:|---:|
| low | 0.5% | 80 / 20 | 0.010050251256281408 | 0.009949999999999999 | 0.001080201005025128 |
| baseline | 1% | 80 / 20 | 0.010101010101010102 | 0.009899999999999999 | 0.001160808080808083 |
| high | 2% | 70 / 30 | 0.010204081632653062 | 0.009799999999999999 | 0.001282857142857145 |

## Thresholds alternativos — reservas virtuais do modelo B

| ETH real alvo | Tokens vendidos | Estoque da curva remanescente | Tokens para LP ideal | Tokens excedentes a bloquear | Resultado |
|---|---:|---:|---:|---:|---|
| 1 | 533333333.333333 | 266666666.666666 | 266666666.666666 | 200000000 | feasible in ideal proxy |
| 2 | 711111111.111111 | 88888888.888888 | 237037037.037037 | 51851851.851851 | feasible in ideal proxy |
| 3 | 799999999.999999 | 0 | 200000000 | 0 | feasible in ideal proxy |
| 4 | — | — | — | — | unreachable: inventory |

Alvos antecipados exigem contabilizar os tokens não vendidos; usar apenas os 200 milhões reservados pode ser insuficiente para preservar o preço. O alvo de 3 ETH é o candidato que aproxima 800 milhões vendidos e 200 milhões em LP, sem grande excedente. O alvo de 4 ETH não é atingível mantendo esse inventário e essas reservas virtuais.

## Operações pequenas e sequências mistas

Cada comparação fracionada executa 1.000 compras de 0,000001 ETH líquido, compara com uma compra única de 0,001 ETH líquido e vende a posição fracionada inteira. As sequências mistas usam semente 20261026 e 2.000 tentativas por modelo.

| Modelo | Diferença fracionada − única, átomos de token | ETH bruto adicional, wei | Perda líquida no round trip ETH | Compras / vendas / rejeições na sequência |
|---|---:|---:|---:|---:|
| A-low-reserve | -493 | 989 | 0.000020101010102001 | 1252 / 748 / 0 |
| B-balanced | -491 | 989 | 0.000020101010102001 | 1252 / 748 / 0 |
| C-deeper-reserve | -500 | 989 | 0.000020101010102001 | 1252 / 748 / 0 |

Operações grandes numa carteira e tentativas de ultrapassar o threshold são rejeitadas. A configuração negativa com 0,1 ETH virtual falha em WALLET_CAP: a compra inicial ultrapassaria 5% do supply.

## Escopo e arquivos

- [JSON exato](../../packages/protocol-simulator/results/results.json), com checkpoints de 25%, 50%, 90%, 100%, preços, reservas, taxas e cenários.
- [CSV A](../../packages/protocol-simulator/results/A-low-reserve.csv), [CSV B](../../packages/protocol-simulator/results/B-balanced.csv), [CSV C](../../packages/protocol-simulator/results/C-deeper-reserve.csv): cada compra até a graduação.
- [Reprodução e limitações](../../packages/protocol-simulator/README.md).
- SHA-256 de results.json: 02a5ce83fca79cb7e2959655ab9cebbde15df36b9672b1b3b85f7255e301e758.

O plano LP é uma aproximação de reserva/proporção para full range, calculada com inteiros. Não emula ticks, arredondamento do Position Manager, mempool, swap, gas, MEV, preços externos, callbacks nem contratos implantados. A Fase 3 deve comparar a proporção com a matemática exata da DEX e testes de fork antes de aceitar uma tolerância de preço. As invariantes aqui verificam este modelo, não constituem prova dos futuros contratos.
