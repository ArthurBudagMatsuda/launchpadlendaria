# Negociação depois da graduação (DAMM v2)

Código: `src/lib/meteora/damm-v2.ts`, `src/lib/meteora/damm-layout.ts`, `src/lib/meteora/damm-sdk.ts`, `src/components/launch/damm-panels.tsx`, `src/components/launch/retry-terminal.tsx`. SDK: `@meteora-ag/cp-amm-sdk` 1.5.1 (IDL `cp_amm` 0.2.5), programa `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`.

## Mesma página, outra fonte

Quando a pool do lançamento está `graduated`, a página do token (`/token/?cluster=…&mint=…`) continua a mesma e passa a negociar na pool DAMM v2 que a graduação criou:

- o formulário de compra e venda é o mesmo componente (`TradeForm`), com a fonte DAMM v2 (`DammTradePanel`);
- os números do topo passam a ser da pool graduada: preço, FDV, SOL e tokens nos cofres (saldos reais), "Trades on DAMM v2 · 1% fee";
- o gráfico e a atividade continuam, separados por fonte ("Bonding curve" e "DAMM v2"): os preços das duas nunca são juntados numa série só;
- quem tem uma das posições de LP graduadas vê "Your LP fees" e pode sacar as taxas (abaixo);
- o painel de graduação mostra a prova do bloqueio ([LIQUIDITY_LOCKING.md](LIQUIDITY_LOCKING.md)).

A curva fica fechada: `quoteTrade` recusa uma pool migrada e `prepareTrade` recusa uma quote que não seja da curva.

## Qual pool é a do lançamento

O endereço da pool DAMM v2 **nunca vem de fora**. É derivado do lançamento: PDA do `cp_amm` para (config pública de migração FixedBps100, mint do lançamento, WSOL), a mesma que o DBC usa na migração. `validateDammPool` exige, a cada leitura:

1. conta do programa `cp_amm`;
2. endereço igual ao derivado do lançamento RETRY;
3. token A = mint do lançamento, token B = WSOL;
4. os dois mints em SPL Token (`tokenAFlag = tokenBFlag = 0`), nunca Token-2022;
5. cofres do SPL Token, com o mint certo e com dono = pool authority do `cp_amm` (`HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC`).

As reservas mostradas são os saldos desses cofres, não reservas virtuais.

## Quote e montagem

Quote: `swapQuoteExactInput` sobre o estado da pool lido num slot (o mesmo cálculo de `CpAmm.getQuote2` para `ExactIn`), com o mesmo formato de quote da curva. Detalhes, validade e slippage em [QUOTE_AND_SLIPPAGE.md](QUOTE_AND_SLIPPAGE.md).

`prepareDammTrade`, na ordem: fonte da quote = DAMM v2 → `assertWritable("trade-damm")` → `assertCluster` → quote com no máximo 30 s → relê o lançamento (precisa estar `graduated`) → lê e valida a pool → a quote revisada precisa ser desta pool → recota → recusa lado, valor ou slippage diferentes, ou mínimo menor → na venda, confere o saldo → monta `swap2` (`ExactIn`) sem referral.

### Allowlist

A transação só pode ter:

- uma instrução `swap2` do `cp_amm`, com estas contas fixadas pelo nome da IDL: `pool_authority`, `pool`, `input_token_account` e `output_token_account` (ATAs da própria carteira), `token_a_vault`, `token_b_vault`, `token_a_mint`, `token_b_mint`, `payer` (a carteira), `token_a_program` e `token_b_program` (SPL Token), `referral_token_account` (o próprio programa, ou seja, ausente), `event_authority` (`3rmHSu74h1ZcmAisVcWerTCiRDQbUrBKmcwptYGjHfet`) e `program`;
- criação das ATAs da carteira para o mint e para WSOL, transferência de SOL para a própria conta WSOL, `SyncNative`, `CloseAccount` da própria WSOL de volta para a carteira e limite de compute units.

Qualquer outra instrução do `cp_amm` (inclusive `swap`, `remove_liquidity`, `claim_position_fee` fora do saque de taxas) é recusada. Uma instrução DBC com o mesmo nome Anchor não passa por uma do DAMM v2: a allowlist identifica pelo programa e pelo discriminador (`tests/meteora-damm.test.ts` "does not take a DAMM v2 instruction for a DBC one").

### Por que o SDK do DAMM v2 não pesa nas outras páginas

A allowlist e o histórico rodam em todas as páginas, mas só precisam de discriminadores e da ordem das contas. Esses valores ficam em `damm-layout.ts`, copiados da IDL `cp_amm` 0.2.5, e o teste "match the official cp_amm IDL (0.2.5) instruction by instruction" falha se divergirem. O SDK inteiro só é carregado na página de um token graduado (`next/dynamic`). Medido no build do GitHub Pages em 29/10/2026:

| Chunk                   | Bytes   | gzip    | Carregado em                                                             |
| ----------------------- | ------- | ------- | ------------------------------------------------------------------------ |
| SDK do DBC (com Anchor) | 806.954 | 213.771 | as 4 páginas do app (Discover, Create, Token, Portfolio)                 |
| SDK do DAMM v2          | 189.551 | 41.173  | nenhuma página no carregamento inicial; só quando um token graduado abre |

## Taxas de LP

Na pool graduada a taxa é de 1% (`FixedBps100`), cobrada em SOL (`collectFeeMode = 1`). A quote mostra a parte do protocolo da Meteora e a parte das posições de LP. As taxas das posições vão para quem tem as NFTs das duas posições travadas: o criador e o fee claimer da config RETRY.

`prepareLpFeeClaim` monta `claim_position_fee` para a carteira que tem a NFT de uma posição da pool (a posição é encontrada lendo todas as posições da pool e o dono de cada NFT). O saque não mexe na liquidez travada. O valor sacável vem de `getUnClaimLpFee` sobre o estado atual. O portfolio lista as posições de LP da carteira em pools RETRY graduadas (`listLpPositions`).

## Resultados on-chain

Validador local com os programas clonados, nas duas variantes de binário ([execução 40972474049](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40972474049), commit `6247354`; os mesmos valores se repetem desde a primeira execução com DAMM v2, no commit `b62601b`):

| Operação                                                    | Resultado medido                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Compra de 0,2 SOL no DAMM v2                                | saldo −0,200000000 SOL; tokens recebidos exatamente iguais à quote                             |
| Venda no DAMM v2                                            | recebeu 1,661645052 SOL contra mínimo de 1,645033551 SOL (variação de saldo +1,661650052)      |
| Mínimo de saída acima do possível                           | recusada pelo `cp_amm` com 6002 `ExceededSlippage`                                             |
| Quote velha, quote que piorou, quote da curva, pool trocada | recusadas antes de montar a transação                                                          |
| Saque das taxas de LP pelo criador                          | recebeu 0,007610420 SOL, exatamente o valor mostrado como sacável; liquidez travada inalterada |
| Saque das taxas de LP por um estranho                       | recusado pelo `cp_amm` com 6053 `InvalidAuthority`                                             |

O teste no navegador contra o validador também compra no DAMM v2 e saca as taxas de LP pela página do token. Assinaturas em [DEVNET_E2E_RESULTS.md](DEVNET_E2E_RESULTS.md). **Não executado na Devnet pública**: a graduação pública ainda não foi autorizada, então não existe pool DAMM v2 RETRY na Devnet.

## Limites

- A pool é pública: qualquer um negocia nela fora da RETRY. O preço anda entre a quote e a execução; o mínimo de saída limita isso. A tela avisa.
- A RETRY não roteia por outras pools nem agrega liquidez externa. Só existe a pool do lançamento.
- Sem referral e sem priority fee da RETRY.
