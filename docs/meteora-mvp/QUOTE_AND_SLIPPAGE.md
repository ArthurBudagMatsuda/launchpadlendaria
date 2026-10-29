# Quotes e slippage

Código: `src/lib/meteora/quotes.ts` (curva), `src/lib/meteora/damm-v2.ts` (`quoteDammTrade`), `src/lib/meteora/trade.ts` e `damm-v2.ts` (`prepareTrade`, `prepareDammTrade`), `src/components/launch/retry-trade-panel.tsx` (formulário único das duas fontes).

## Princípio

Nenhum preço é inventado. Toda quote é a matemática do próprio programa, portada pelo SDK oficial, aplicada à conta da pool lida num slot conhecido. A quote é refeita no momento de montar a transação, e o mínimo de saída vai dentro da instrução, então **quem garante o limite é o programa**, não a interface.

## Duas fontes, um formato

| Onde negocia               | Função do SDK                                                                                         | Modo                                                                                                             | Estado lido                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Bonding curve (DBC)        | `client.pool.swapQuote2` do `@meteora-ag/dynamic-bonding-curve-sdk` 2.0.0                             | compra `PartialFill` (a compra que completa a curva preenche até o threshold e devolve o resto); venda `ExactIn` | `VirtualPool` + `PoolConfig`, mesmo slot             |
| Pool graduada (DAMM v2)    | `swapQuoteExactInput` do `@meteora-ag/cp-amm-sdk` 1.5.1 (o que `CpAmm.getQuote2` roda para `ExactIn`) | `ExactIn` nos dois sentidos                                                                                      | `Pool` do `cp_amm`, conferida por `validateDammPool` |
| Primeira compra na criação | `client.pool.getQuoteFromInputAmount` com a própria config                                            | `ExactIn`                                                                                                        | a config (a pool ainda não existe)                   |

Os dois tipos de quote têm a mesma forma (`TradeQuote`) e um campo `venue` (`"dbc"` ou `"damm-v2"`). O formulário de negociação é o mesmo antes e depois da graduação; só muda a fonte.

Sem referral (`hasReferral: false`) e sem "primeira compra com taxa mínima" (`eligibleForFirstSwapWithMinFee: false`), porque a config RETRY não tem essas opções. O ponto atual (`getCurrentPoint`) vem da própria rede, na unidade de ativação da pool (timestamp na config RETRY).

## O que a quote mostra

| Campo                       | Origem                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Você paga / usa / sobra     | `amountIn`, `amountInUsed`, `amountLeft` (sobra só na compra que completa a curva)                                                    |
| Você recebe                 | `outputAmount` do SDK, em unidades brutas                                                                                             |
| Mínimo garantido            | `minimumAmountOut` do SDK para o slippage escolhido; vai para a instrução                                                             |
| Taxa                        | soma das partes que o SDK devolve (trading + protocolo + referral na curva; claiming + protocolo + compounding + referral no DAMM v2) |
| Divisão da taxa             | `splitTradingFee` (curva): Meteora 20%, o resto meio a meio entre criador e RETRY                                                     |
| Preço à vista               | `sqrtPrice` da pool, convertido por `getPriceFromSqrtPrice`                                                                           |
| Preço de execução e impacto | SOL ÷ tokens da própria quote, comparado ao preço à vista (positivo = pior para quem negocia)                                         |
| Completa a curva            | a reserva depois da compra alcança o threshold                                                                                        |
| Slot e horário              | slot da leitura e `quotedAt`                                                                                                          |

Quantias são `bigint` do começo ao fim (lamports e unidades de 10⁻⁹ token). `decimal.js` só aparece em preços e porcentagens para exibição. Valores digitados passam por `parseSol`/`parseTokens`, que não usam ponto flutuante.

## Atualização e validade

- A quote é recalculada a cada 10 s e a cada nova leitura da pool (o slot faz parte da chave da query).
- `QUOTE_TTL_MS = 30 s`: uma quote mais velha do que isso não pode ser executada.
- Na criação, a revisão de custo vale 45 s (`PREPARED_TTL_MS` em `launch-panel.tsx`). Depois disso é preciso revisar de novo.

## Recotação antes de assinar

`prepareTrade` (curva) e `prepareDammTrade` (DAMM v2), na ordem:

1. a quote revisada precisa ser da mesma fonte (uma quote da curva não executa no DAMM v2 e vice-versa);
2. `assertWritable` (flag do recurso, Mainnet travada, config presente) e `assertCluster` (genesis);
3. a quote revisada precisa ter no máximo 30 s;
4. a pool é relida (no DAMM v2, o lançamento é relido, precisa estar `graduated`, e a pool graduada é derivada dele, nunca recebida de fora);
5. a quote é refeita sobre esse estado;
6. recusa se mudaram o lado, o valor ou o slippage, ou se o **novo mínimo for menor** do que o revisado ("The price moved. Review the new quote first.");
7. na venda, confere o saldo do token na carteira;
8. monta `swap2` com o mínimo da quote nova.

Se o preço melhorar entre a revisão e a montagem, a transação sai com o mínimo novo (maior). Se piorar, nada é pedido à carteira.

## Slippage

| Item                   | Valor                                                       |
| ---------------------- | ----------------------------------------------------------- |
| Opções na tela         | 0,5%, 1%, 2%, 5%, 10%                                       |
| Padrão                 | 1% (`DEFAULT_SLIPPAGE_BPS = 100`)                           |
| Aceito pela biblioteca | de 0,1% a 10% (`validateSlippage`, 10 a 1.000 bps, inteiro) |
| Onde é garantido       | no programa: o mínimo de saída está na instrução            |

O que acontece quando o preço anda além do limite entre a assinatura e a execução: o programa recusa a transação inteira e nada é negociado. Os testes montam uma transação com mínimo acima da saída possível (saída cotada + 1 unidade) e conferem a recusa do próprio programa, no validador com os binários de Devnet e de Mainnet:

| Programa | Erro                               | Evidência                                                                                                                                                                                |
| -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DBC      | 6002 `ExceededSlippage`            | "is stopped by the program when the minimum out is not met (slippage)": recusada na simulação, nada enviado. O smoke público da Devnet (PR #8) repetiu o caso                            |
| DAMM v2  | 6002 `ExceededSlippage` (`cp_amm`) | "is stopped by DAMM v2 itself when the minimum out is not met": a transação é enviada sem preflight de propósito (só no teste, no validador) e falha on-chain, com assinatura registrada |

A mensagem ao usuário vem de `src/lib/meteora/errors.ts`. Como DBC e DAMM v2 reutilizam números de erro, a mensagem é escolhida pelo nome que o programa escreve no log (o executor guarda os logs também quando o preflight do RPC recusa o envio).

## Limites e o que não é prometido

- Valor zero, acima de `u64` ou pequeno demais para render saída: recusado antes de montar.
- Pool completa (aguardando graduação) ou já graduada: a curva não cota; a página troca para a graduação ou para o DAMM v2.
- Pool DAMM v2 desativada (`poolStatus ≠ 0`): não cota.
- **MEV**: o limite de slippage limita a perda; não impede um sandwich dentro dele. A tela diz isso.
- A RETRY não acrescenta priority fee. Se a carteira acrescentar, a carteira mostra.

## Testes

| Teste                                                                                                                                                                                                                                               | Nível                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `tests/meteora.test.ts` "bounds slippage and expires quotes", "parses SOL and token amounts exactly"                                                                                                                                                | unitário                                                       |
| `tests/meteora-damm.test.ts` "never sends a curve quote to DAMM v2 or a DAMM v2 quote to the curve"                                                                                                                                                 | unitário                                                       |
| `tests/chain/meteora-flow.chain.ts`: compra recebe exatamente a quantidade cotada; venda recebe pelo menos o mínimo; slippage recusado pelo DBC; quote velha, movida, da curva ou de outra pool recusada no DAMM v2; slippage recusado pelo DAMM v2 | programas reais no validador (binários de Devnet e de Mainnet) |
| Smoke público da Devnet (PR #8, código `4233212`): compra, venda, excesso de saldo e slippage                                                                                                                                                       | Devnet pública, carteira de teste descartável                  |
