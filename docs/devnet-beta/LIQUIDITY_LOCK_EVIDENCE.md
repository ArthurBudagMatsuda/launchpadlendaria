# Bloqueio de liquidez — evidência necessária

**Etapa 7 pública: NOT TESTED.** Nenhuma pool DAMM v2 ou posição pública nova foi criada nesta etapa. Endereços efêmeros de validadores do CI não são evidência pública.

A configuração candidata do código destina 50% da liquidez ao parceiro e 50% ao criador, com 100% permanentemente bloqueados. A interface de pool graduada só deve mostrar bloqueio verificado quando a leitura on-chain das posições comprovar os critérios de `lockProof` em `src/lib/meteora/damm-v2.ts`.

Após a graduação pública, registrar: pool DAMM v2 derivada e seu owner, endereços das duas posições, NFTs/autoridades, liquidez permanente/vestida/desbloqueada, comparação dos totais da pool, direitos de saque de taxas e assinaturas. Conferir que `verified` é verdadeiro e que falha de RPC produz estado não verificado.

Retirada de principal e claim de taxas são direitos distintos. O criador pode ter taxas a sacar sem poder retirar o principal bloqueado. O bloqueio não impede venda dos tokens circulantes, queda de preço ou outros golpes. Também não torna imutáveis programas atualizáveis da Meteora; conferir autoridades e binários nas evidências de programas antes de uma liberação.

O [CI da Etapa 7](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41568352309) repetiu os testes com sucesso nos dois validadores: prova de posições, retirada indevida e segunda migração recusadas, claims de taxas sem redução da liquidez bloqueada. Evidências completas: [binários Devnet](evidence/local-validator-devnet.json) e [binários Mainnet](evidence/local-validator-mainnet.json), ambas com `mode=local`.

Nas duas execuções, `permanentLocked=823314404508605138322788080705104`, `totalLiquidity=823314404508605138322788080705105`, `unlocked=1`, `vested=0`, em unidades brutas de liquidez. O rateio deixa uma unidade de arredondamento na posição do criador; a leitura `lockedPct="100"` é arredondada. Portanto, a prova aceita esse resíduo mínimo e não demonstra bloqueio matemático de cada unidade. O teste de retirada do criador pede mais que esse resíduo e é recusado. Não confundir unidades de liquidez com tokens/SOL, nem este ensaio local com selo público.

Fonte histórica complementar: [LIQUIDITY_LOCKING](../meteora-mvp/LIQUIDITY_LOCKING.md). A graduação pública permanece pendente.
