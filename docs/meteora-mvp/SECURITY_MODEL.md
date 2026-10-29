# Modelo de segurança

Estado em 29/10/2026. **Este código não passou por revisão de segurança independente e não é declarado auditado.** O que segue descreve o que a implementação faz, o que os testes provam e o que fica de risco.

## O que a RETRY é, do ponto de vista de segurança

- Um site estático (GitHub Pages) que monta transações para os programas oficiais da Meteora e as entrega à carteira do usuário para assinar. **Não há programa on-chain da RETRY, servidor da RETRY com chaves, nem custódia.**
- Um Worker de metadados (Cloudflare) que guarda JSON e imagem por hash. Ele não assina nada e não tem chave Solana.
- Testes que usam chaves descartáveis: no validador local, e na Devnet pública com a carteira de teste do environment protegido `retry-devnet` (ver [docs/devnet/RETRY_GITHUB_ACTIONS_SECURITY.md](../devnet/RETRY_GITHUB_ACTIONS_SECURITY.md)).

## Em quem se confia

| Componente                         | Confiança                                                                                                        | Consequência se falhar                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Programas DBC e DAMM v2 da Meteora | total: regras de curva, taxas, slippage, migração e bloqueio da liquidez são deles                               | um bug ou upgrade malicioso afeta todo lançamento; a RETRY não tem como impedir                                        |
| Autoridade de upgrade da Meteora   | os programas são atualizáveis (`JADaUV8k…` na Mainnet, ver [PROGRAMS_AND_NETWORKS.md](PROGRAMS_AND_NETWORKS.md)) | o comportamento testado vale para o binário do dia; o hash é registrado a cada execução do CI                          |
| SDKs oficiais (versões fixadas)    | montam as instruções e portam a matemática das quotes                                                            | a allowlist e a recotação limitam o estrago de um SDK errado; um SDK que mude Program ID falha nos testes              |
| RPC configurado                    | dados de leitura                                                                                                 | dados falsos na tela. Escrita protegida pelo genesis hash, simulação e allowlist; o programa executa com o estado real |
| Carteira do usuário                | guarda a chave e assina                                                                                          | fora do controle da RETRY; o retorno da carteira é conferido                                                           |
| GitHub Pages e o build             | entrega o código                                                                                                 | quem altera o build altera o app; mudanças passam por PR e CI                                                          |
| Worker de metadados                | serve JSON e imagem                                                                                              | conteúdo trocado é detectado pelo hash; conteúdo removido some da tela                                                 |

## Controles, por camada

### Antes de montar

- Flags por recurso e por rede, Mainnet travada em constante e conferida em mais de uma camada (`executionPolicy` na tela, `assertWritable` na biblioteca, testes que falham se alguém ligar a Mainnet sem aprovação). Detalhes em [PROGRAMS_AND_NETWORKS.md](PROGRAMS_AND_NETWORKS.md).
- `assertCluster`: o RPC precisa responder com o genesis hash do cluster escolhido.
- Config RETRY fixada no código por cluster, reconferida on-chain (`configMismatches`, 21 campos e todos os pontos da curva) e com o fee claimer registrado.
- Identidade: pool DBC só na PDA canônica de (WSOL, mint, config RETRY), de dono DBC; pool DAMM v2 só a derivada do lançamento, de dono `cp_amm`, com os mints e cofres certos.
- Quotes recalculadas do estado lido; recusa de quote velha (30 s) ou que piorou.

### A transação

- Allowlist por programa, discriminador e conta (`validateTransaction`): só as instruções da operação, contas fixadas pelo nome da IDL, SOL só para a própria conta WSOL, ATAs só da própria carteira e dos mints esperados, nenhum signatário estranho, pagador = carteira, sem priority fee da RETRY.
- Simulação da transação exata antes de pedir assinatura.

### Depois da assinatura

- `validateSigned`: a carteira não pode mudar pagador, blockhash ou instruções; só pode acrescentar Compute Budget e Lighthouse.
- `verifySignatures(true)`: uma assinatura que não é da conta pagadora aborta.
- A assinatura é gravada antes do envio; envio com preflight; confirmação reenvia **os mesmos bytes assinados** enquanto o blockhash vale; `reconcile` resolve operações pendentes pelo estado da chain, sem reenviar.

### `skipPreflight`

Aparece em dois lugares, os dois justificados:

1. No app, só em `confirmSignature`: reenvia os bytes já assinados, que já passaram pelo preflight; a mesma assinatura não executa duas vezes. `tests/solana-source-boundaries.test.ts` falha se `skipPreflight: true` aparecer em outro arquivo de `src/` ou mais de uma vez, e exige `skipPreflight: false` no envio. O mesmo teste prende `signTransaction`, `sendRawTransaction` e a geração de keypairs aos módulos revisados.
2. Nos testes, em `tests/chain/harness.ts` (`sendExpectingFailure`), para que uma transação proibida chegue ao programa no validador e seja recusada on-chain.

### Segredos

- Nada secreto no bundle. Tudo que começa com `NEXT_PUBLIC_` é público e não contém chave. `tests/solana-source-boundaries.test.ts` procura material de chave no código ativo.
- Keypairs gerados no navegador (mint, NFTs de posição) assinam uma vez e não são gravados.
- `localStorage`: só o registro público das operações e o nome da última carteira.
- A chave de teste da Devnet existe só no environment protegido `retry-devnet` e no backup cifrado do proprietário; nunca no repositório, no frontend ou em logs (PR #8).

## Testes adversariais (seção 38)

| Situação                            | Controle                                                                                  | Teste (nível)                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Troca de conta durante a assinatura | `verifySignatures`                                                                        | "sends nothing when the wallet signs with another account" (unitário)                                                                                                                 |
| RPC de cluster incorreto            | `assertCluster`                                                                           | "builds nothing when the RPC answers for another cluster" (unitário)                                                                                                                  |
| Pool falsa                          | `validateRetryPool`, `decodePool`, `validateDammPool`                                     | "takes a DBC pool as a RETRY launch only at its canonical address…", "takes a DAMM v2 pool only as the one the launch graduated into" (unitário); pool trocada no DAMM v2 (validador) |
| Mint falso                          | PDA derivada do mint, mints conferidos na pool DAMM v2, SPL Token obrigatório             | mesmos testes de identidade (unitário)                                                                                                                                                |
| Token com ticker igual              | identidade pelo mint, regras de nome, marca no Discover                                   | `tests/meteora-naming.test.ts` (unitário)                                                                                                                                             |
| Metadados maliciosos                | hosts confiáveis, domínios, tamanho, nome/ticker iguais aos on-chain, Worker valida bytes | "trusts only RETRY's hosts…", `tests/metadata-worker.test.ts`, `tests/validation.test.ts` (unitário)                                                                                  |
| Carteira desconectada               | o executor exige conta conectada                                                          | `e2e/solana-app.spec.ts`, `tests/integration/solana-wallet.test.tsx` (navegador simulado, integração)                                                                                 |
| Quote obsoleta                      | TTL de 30 s e recotação                                                                   | "bounds slippage and expires quotes" (unitário); DAMM v2 com quote velha (validador)                                                                                                  |
| Transação duplicada                 | registro antes do envio, `pendingCreate`, id do lançamento, reconciliação                 | "stores the signature before sending…", "blocks a second launch while one is waiting", "settles sent operations from chain state only" (unitário)                                     |
| Manipulação de valor                | recotação exige o mesmo valor; `validateSigned` compara os dados da instrução             | "rejects a changed fee payer, blockhash, instruction, or an added transfer" (unitário)                                                                                                |
| Erro de decimals                    | 9 decimals conferidos na config e no mint; conversões exatas                              | "parses SOL and token amounts exactly" (unitário); mint com 9 decimals (validador e Devnet pública)                                                                                   |
| Program ID não permitido            | allowlist                                                                                 | "rejects unknown programs, priority fees, foreign signers and a foreign fee payer" (unitário)                                                                                         |
| Config key incorreta                | config fixada e `configMismatches`                                                        | "flags any on-chain config that differs from the reviewed parameters" (unitário)                                                                                                      |
| Fee claimer alterado                | `context.feeClaimer` comparado com a config on-chain                                      | lançamento recusado com fee claimer diferente (validador)                                                                                                                             |
| Substituição de conta               | contas fixadas pelo nome da IDL                                                           | testes de allowlist DBC e DAMM v2 (unitário); pool DAMM v2 trocada (validador)                                                                                                        |
| Migração repetida                   | `prepareMigration` recusa; o DBC recusa                                                   | "refuses a second migration…": 6022 `NotPermitToDoThisAction` do DBC (validador)                                                                                                      |
| Pool já graduada                    | curva não cota; quote da curva não executa no DAMM v2                                     | "refuses curve quotes and curve trades once the token graduated" (validador)                                                                                                          |
| Retirar LP bloqueada                | `cp_amm`                                                                                  | 5 tentativas recusadas on-chain (validador), ver [LIQUIDITY_LOCKING.md](LIQUIDITY_LOCKING.md)                                                                                         |
| Claim não autorizado                | biblioteca (criador) e `cp_amm` (LP)                                                      | "Only the creator…" e estranho sacando LP: 6053 (validador)                                                                                                                           |
| Divergência de preço na migração    | `graduationPriceGap`                                                                      | preço da curva 5 × 10⁻⁸ → DAMM v2 5 × 10⁻⁸, diferença 0% (validador)                                                                                                                  |
| Queda de provedor de dados          | estados de erro honestos; RPC fora do ar nunca vira saldo zero                            | "an RPC outage is never shown as zero SOL", "rejection and RPC failure have honest user states" (navegador simulado); timeouts em `tests/solana-rpc.test.ts`                          |

Nenhum teste ataca contratos ou pools de terceiros: tudo roda no validador local, com pools criadas no próprio teste, ou na Devnet com a config e os tokens de teste da RETRY.

## Invariantes financeiros (seção 37)

| Invariante                        | Como é verificado                                                                                                              | Depende do programa da Meteora? |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Conservação do supply             | soma de cofre DAMM v2 + cofre DBC + saldos = supply do mint, depois da graduação (validador)                                   | sim (o DBC move os tokens)      |
| Sem mint não autorizado           | autoridade de mint e de freeze nulas depois da criação (validador e Devnet pública)                                            | não: é estado SPL verificável   |
| Reservas reais × virtuais         | a tela mostra saldos dos cofres DAMM v2; na curva, `quoteReserve` do estado e o progresso, nunca reservas virtuais como fundos | —                               |
| Conservação das quantias          | compra recebe exatamente a quote; venda recebe ≥ mínimo; variação de saldo medida (validador)                                  | sim                             |
| Contabilidade de taxas            | divisão exata em `bigint` (`splitTradingFee`); saque do criador = acumulado; saque de LP = sacável mostrado                    | sim                             |
| Retirada indevida impossível      | tentativas recusadas on-chain                                                                                                  | sim (`cp_amm`)                  |
| Dono das contas                   | DBC, `cp_amm`, Metaplex, SPL Token e Token-2022 conferidos antes de decodificar                                                | não                             |
| Identidade da pool                | PDAs canônicas                                                                                                                 | não                             |
| Limites numéricos                 | valores até `u64`, slippage 0,1%–10%, compra inicial ≤ 1 SOL                                                                   | não                             |
| Arredondamento                    | parte travada arredondada para baixo, 1 unidade de sobra medida; preços só para exibição                                       | sim                             |
| Liquidez da migração reconciliada | 10,000000001 SOL na curva → 9,98 SOL no DAMM v2 + 0,02 SOL de taxa da Meteora (validador)                                      | sim                             |
| Principal de LP protegido         | `verifyLockedLiquidity` e testes negativos                                                                                     | sim                             |
| Sem repetição indevida            | registro antes do envio, reenvio só dos mesmos bytes, reconciliação sem reenvio                                                | não                             |

Onde a coluna da direita diz "sim", a RETRY prova o comportamento do binário testado, não uma garantia independente.

## Riscos que continuam abertos

- **Sem revisão independente de segurança.** Escopo sugerido: `src/lib/meteora/transactions.ts`, `wallet-signer.ts`, `create-token.ts`, `trade.ts`, `damm-v2.ts`, `graduation.ts`, `fees.ts`, `src/config/retry-protocol.ts` e o Worker.
- **Dependências**: `pnpm audit --prod` (PR #8, 29/10/2026) encontrou 10 alertas, 6 altos e 4 moderados, na árvore do Meteora/Anchor/web3.js (`bigint-buffer`, `toml`, `stream-json`, `uuid`). Não corrigidos nem suprimidos. Ver [docs/devnet/evidence/DEPENDENCY_AUDIT.json](../devnet/evidence/DEPENDENCY_AUDIT.json).
- **Programas atualizáveis da Meteora** (acima).
- **RPC público**: limites de requisição e possibilidade de dados errados na leitura.
- **MEV**: o slippage limita a perda, não a impede.
- **Regras de nome**: só na interface; quem chama o DBC direto passa por cima.
- **Prova do bloqueio**: identifica as posições graduadas pelo tamanho; ver o limite em [LIQUIDITY_LOCKING.md](LIQUIDITY_LOCKING.md).
- **Worker**: não implantado; Access, cookies entre origens e cotas reais não exercitados.
- **Carteiras reais**: nenhuma extensão real testada.
- **Mainnet**: fee claimer (tesouraria) e economia não aprovados; ver [MAINNET_RELEASE_CHECKLIST.md](MAINNET_RELEASE_CHECKLIST.md).
