# Testes

Estado em 29/10/2026, branch `feat/retry-meteora-create-trade-graduate`. Resultados medidos estão em [DEVNET_E2E_RESULTS.md](DEVNET_E2E_RESULTS.md).

## Níveis de evidência

Um teste de um nível não prova o nível de cima. Toda afirmação nos documentos diz de que nível vem.

| Nível | Nome                                        | O que roda                                                                                                         | O que prova                                                               |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| U     | Unitário                                    | lógica, matemática e validações, sem rede                                                                          | o código da RETRY sob entradas escolhidas                                 |
| I     | Integração                                  | componentes React com Wallet Standard e RPC simulados                                                              | a integração com o contrato Wallet Standard                               |
| B     | Navegador simulado                          | export estático no Chromium, desktop e mobile emulado, RPC e carteiras simulados                                   | telas, estados e mensagens; nada on-chain                                 |
| V     | Validador local com os programas da Meteora | transações reais contra os binários oficiais (clonados da Devnet e da Mainnet no CI; fixtures do SDK no container) | o fluxo on-chain completo, com os programas de verdade, num cluster local |
| VB    | Navegador contra o validador                | o app real no Chromium, Worker de metadados em processo, carteira de teste Wallet Standard                         | o caminho da tela até o programa, sem extensão real                       |
| D     | Devnet pública                              | transações na Devnet com a carteira de teste descartável                                                           | o fluxo no cluster público, com RPC público                               |
| R     | Carteira real                               | extensão oficial operada por uma pessoa                                                                            | a experiência real de assinatura (**pendente**)                           |
| M     | Mainnet                                     | —                                                                                                                  | **proibido nesta tarefa**                                                 |

## Comandos

```bash
pnpm install --frozen-lockfile        # Node 24, pnpm 11.25
pnpm format:check && pnpm lint && pnpm typecheck
pnpm test                             # U e I (vitest)
pnpm build:pages                      # export do GitHub Pages
pnpm test:e2e                         # B (Playwright, desktop e mobile)
pnpm test:chain                       # V (precisa de um validador, ver o runbook)
pnpm test:chain:browser               # VB (validador + build apontado para a config do validador)
pnpm test:devnet:readiness            # leitura pública da Devnet, sem chave (PR #8)
pnpm test:rpc:live                    # leitura pública, sem carteira nem transação
```

Como subir o validador com os programas da Meteora: [OPERATIONAL_RUNBOOK.md](OPERATIONAL_RUNBOOK.md). Como rodar na Devnet pública com a carteira protegida: [docs/devnet/RETRY_PUBLIC_DEVNET_TESTS.md](../devnet/RETRY_PUBLIC_DEVNET_TESTS.md).

## Suítes e contagens (29/10/2026)

| Suíte                        | Arquivos                                       | Testes                                   | Nível        | Onde roda                                                 |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------- | ------------ | --------------------------------------------------------- |
| Unitários e integração       | 18 arquivos em `tests/`                        | 185                                      | U, I         | CI "validate" e local                                     |
| Navegador simulado           | `e2e/solana-app.spec.ts`                       | 26 (13 × desktop e mobile)               | B            | CI "Browser tests" e local                                |
| Fluxo on-chain               | `tests/chain/meteora-flow.chain.ts`            | 21                                       | V            | CI, duas vezes (binários de Devnet e de Mainnet), e local |
| Navegador contra o validador | `e2e/chain/meteora-browser.spec.ts`            | 1                                        | VB           | CI, nas duas variantes, e local                           |
| Devnet pública               | o mesmo `meteora-flow.chain.ts` em modo Devnet | 8 aprovados, 2 pulados no smoke do PR #8 | D            | manual, environment protegido (PR #8)                     |
| Leitura pública              | `tests/live/*.probe.ts`                        | —                                        | leitura real | manual                                                    |

Unitários por arquivo: `meteora.test.ts` 33, `meteora-damm.test.ts` 25, `solana-config.test.ts` 17, `integration/solana-wallet.test.tsx` 17, `metadata-worker.test.ts` 16, `market-math.test.ts` 15, `solana-rpc.test.ts` 12, `solana-market.test.ts` 11, `devnet-safety.test.ts` 8, `validation.test.ts` 7, `mainnet-approval.test.ts` 4, `public-devnet-rpc.test.ts` 4, e 3 ou menos nos demais.

O teste no navegador contra o validador percorre, pela interface: lançamento com imagem e primeira compra, compra, venda, a compra que completa a curva, a graduação, a prova do bloqueio, uma compra no DAMM v2, o saque das taxas de LP do criador, o portfolio (posições de LP e atividade) e o Discover, com exatamente sete assinaturas da carteira. Passos e valores em [DEVNET_E2E_RESULTS.md](DEVNET_E2E_RESULTS.md#o-app-no-navegador-contra-o-validador).

Na variante de Devnet do CI, o validador clona a config RETRY registrada (`8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N`) e o fluxo usa essa config; na de Mainnet, o teste cria uma config nova com os mesmos parâmetros.

## O fluxo on-chain (seção 35)

`tests/chain/meteora-flow.chain.ts`, na ordem: config (`createConfig2` ou a registrada) conferida campo a campo e contra a folha de aprovação; fee claimer diferente recusado → criação com primeira compra atômica (supply fixo, sem autoridades, metadados imutáveis) → compra que recebe exatamente a quote → venda que recebe pelo menos o mínimo → venda acima do saldo recusada → slippage recusado pelo DBC → compra que completa a curva com preenchimento parcial → migração manual para o DAMM v2 com as duas posições travadas → prova do bloqueio → preço e reservas na graduação e conservação do supply → curva fechada → segunda migração recusada pelo DBC → compra e venda no DAMM v2 pela mesma camada de negociação → quote velha, piorada, da curva ou pool trocada recusadas → slippage recusado pelo DAMM v2 → cinco tentativas de retirar o principal recusadas → saque de taxas de LP pelo dono, recusado para um estranho → saque das taxas do criador → histórico decodificado dos eventos → listagem pelo filtro da config.

Cada passo grava endereços, assinaturas e valores em JSON (`RETRY_CHAIN_EVIDENCE`) e o CI publica um resumo em anotações. Na Devnet pública sem autorização de graduação, os passos depois da curva completa são marcados como pulados, nunca como aprovados.

## Matriz da seção 36

Estado: ✅ coberto · 🟡 parcial · ⬜ pendente. Entre parênteses, o nível.

| Item                                             | Estado | Cobertura                                                                                                                                              |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Configuração**                              |        |                                                                                                                                                        |
| Cluster                                          | ✅     | genesis por cluster, RPC de outra rede recusado (U); Devnet pública conferida pelo genesis (D)                                                         |
| Program IDs                                      | ✅     | fixados e comparados com os SDKs e as IDLs (U); executáveis e hash dos binários (leitura real no CI)                                                   |
| Config key                                       | ✅     | fixada por cluster, divergência recusada (U); config registrada conferida on-chain (V, D)                                                              |
| Supply e decimals                                | ✅     | 10¹⁸ unidades, 9 decimals (V, D)                                                                                                                       |
| Quote mint                                       | ✅     | WSOL exigido (U, V)                                                                                                                                    |
| Fees                                             | ✅     | divisão exata (U); 1% medido e dividido on-chain (V, D)                                                                                                |
| Threshold                                        | ✅     | 10 SOL, conclusão da curva (V)                                                                                                                         |
| Lock policy                                      | ✅     | percentuais na config (U, V); posições travadas (V)                                                                                                    |
| **B. Criação de token**                          |        |                                                                                                                                                        |
| Sucesso                                          | ✅     | (V, VB, D)                                                                                                                                             |
| Campos inválidos                                 | ✅     | (U), tela (B)                                                                                                                                          |
| Metadata inválida                                | ✅     | host, hash e campos (U)                                                                                                                                |
| Falha no upload                                  | ✅     | 401/403/429/erro e conteúdo trocado (U)                                                                                                                |
| Conta desconectada                               | ✅     | (B, I)                                                                                                                                                 |
| Falta de SOL                                     | 🟡     | mensagem para o erro do programa e reserva de 0,01 SOL na tela (U); sem teste on-chain com saldo insuficiente                                          |
| Rejeição                                         | ✅     | (U, B)                                                                                                                                                 |
| Timeout e confirmação tardia                     | ✅     | expiração por blockhash e reconciliação (U)                                                                                                            |
| Duplicidade                                      | ✅     | id do lançamento e lançamento pendente (U)                                                                                                             |
| **C. Bonding curve**                             |        |                                                                                                                                                        |
| Quote, compra, venda                             | ✅     | (V, VB, D)                                                                                                                                             |
| Fee                                              | ✅     | (U, V, D)                                                                                                                                              |
| Slippage                                         | ✅     | (U, V, D)                                                                                                                                              |
| Reservas                                         | ✅     | (V)                                                                                                                                                    |
| Price impact                                     | ✅     | (V; exibição em U)                                                                                                                                     |
| Limites                                          | ✅     | zero, `u64`, saldo, curva completa (U, V)                                                                                                              |
| Repetição                                        | ✅     | nada é reenviado como transação nova (U)                                                                                                               |
| Arredondamentos                                  | ✅     | conversões exatas (U); sobra de 1 unidade na graduação (V)                                                                                             |
| **D. Carteira**                                  |        |                                                                                                                                                        |
| Phantom, Solflare, Backpack                      | 🟡     | simuladas (B, I); **reais pendentes** (R)                                                                                                              |
| Desconexão, troca de conta                       | ✅     | (I, B); assinatura de outra conta recusada (U)                                                                                                         |
| Rejeição                                         | ✅     | (U, B)                                                                                                                                                 |
| Cluster incorreto                                | ✅     | (U, I)                                                                                                                                                 |
| **E. Graduação**                                 |        |                                                                                                                                                        |
| Threshold e pool completa                        | ✅     | (V)                                                                                                                                                    |
| Migração e pool destino                          | ✅     | (V, VB); **Devnet pública pendente** (D)                                                                                                               |
| Falha e retry seguro                             | 🟡     | rent float vazio e config ausente recusados antes de assinar; segunda migração recusada (V); sem teste de migração que falha no meio                   |
| Custos                                           | ✅     | 0,0325182 SOL medidos (V)                                                                                                                              |
| Price continuity                                 | ✅     | diferença 0% (V)                                                                                                                                       |
| **F. Liquidity lock**                            |        |                                                                                                                                                        |
| Configuração, posições, autoridades              | ✅     | (U, V)                                                                                                                                                 |
| Direitos e coleta autorizada                     | ✅     | NFTs com parceiro e criador; saque de LP pelo dono (V, VB), recusado para um estranho (V)                                                              |
| Retirada indevida                                | ✅     | 5 tentativas recusadas on-chain (V)                                                                                                                    |
| **G. DAMM v2**                                   |        |                                                                                                                                                        |
| Quotes, buy, sell, saldos                        | ✅     | (V; compra também em VB); **Devnet pública pendente** (D)                                                                                              |
| Wrong pool, stale quote                          | ✅     | (U, V)                                                                                                                                                 |
| **H. Frontend**                                  |        |                                                                                                                                                        |
| Discover, Create, Trade, Portfolio, Token Detail | ✅     | (B, VB)                                                                                                                                                |
| Mobile                                           | 🟡     | emulação Pixel 7 (B); sem aparelho real                                                                                                                |
| Loading, erro, vazio                             | ✅     | (B)                                                                                                                                                    |
| Telas de DAMM v2 e de prova do bloqueio          | ✅     | graduação pela página do token, prova do bloqueio, compra no DAMM v2, saque de LP e posições no portfolio (VB); venda no DAMM v2 pela tela não testada |

## Desempenho (seção 39)

| Item                                           | Medida ou regra                                                                                                                                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle                                         | build do Pages em 29/10/2026: chunk do SDK do DBC 806.954 bytes (213.771 gzip), carregado nas 4 páginas do app; SDK do DAMM v2 189.551 (41.173 gzip) e biblioteca de gráfico 173.270 (55.644 gzip) só sob demanda |
| SDK do DAMM v2 fora das páginas que não o usam | `damm-layout.ts` copia só discriminadores e contas para a allowlist e o histórico; teste confere contra a IDL                                                                                                     |
| Polling                                        | lista 20 s, pool 10 s, quote 10 s, saldo do token 15 s, histórico 30 s, posições de LP 60 s; prova do bloqueio considerada fresca por 30 s                                                                        |
| Consultas por renderização                     | nenhuma: tudo passa pelo React Query com chaves estáveis                                                                                                                                                          |
| RPC por atualização do Discover                | 1 `getProgramAccounts`, 1 config, 1 slot, metadados em lotes de 100, 1 leitura por pool migrada                                                                                                                   |
| Providers                                      | um só provider de carteira e cluster (PR #6); a `Connection` do web3.js é criada uma vez por cluster e RPC                                                                                                        |
| Gráfico                                        | velas a partir do histórico já decodificado, sem nova consulta por intervalo                                                                                                                                      |
| Limite conhecido                               | `getProgramAccounts` sem paginação: com muitos milhares de lançamentos será preciso um indexador; o SDK do DBC ainda pesa no carregamento inicial                                                                 |

Não foram medidos tempo de carregamento em rede real, consumo de memória nem latência de quotes em produção.

## O que os testes não cobrem

- Nenhuma extensão de carteira real (R).
- Graduação, DAMM v2 e prova do bloqueio na Devnet pública (D).
- Worker implantado na Cloudflare.
- Mainnet (M), por regra.
