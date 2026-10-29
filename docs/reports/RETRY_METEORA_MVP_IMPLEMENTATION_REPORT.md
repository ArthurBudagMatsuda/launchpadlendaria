# RETRY — Relatório da Etapa 3: Meteora DBC (MVP em Devnet)

Data: **28/10/2026**. Branch: **`feat/retry-meteora-dbc-mvp`**, empilhada sobre `migration/retry-solana` (PR #6). Escopo: criar tokens, negociar, graduar e acompanhar lançamentos RETRY usando o Meteora Dynamic Bonding Curve, em Devnet, com Mainnet bloqueada.

Este relatório só registra o que foi realmente executado. Onde algo depende de um passo que não pôde ser feito, está marcado como **pendente** ou **bloqueado**, com o motivo.

> **Atualização de 29/10/2026.** Depois deste relatório, a Devnet pública foi desbloqueada pelo proprietário: carteira de teste no environment protegido `retry-devnet`, config RETRY de Devnet `8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N` registrada no app (commit `4233212`) e, segundo as evidências publicadas, smoke público com 8 testes aprovados e 2 pulados (graduação e migração, não autorizadas). O job de Devnet agora roda só por dispatch manual com aprovação, não mais por commit com `[devnet]`. Conferido pelo CI: o validador clona essa config da Devnet pública e passa o fluxo completo com ela, incluindo a migração ([execução](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40945281913)). As seções 1, 7, 29, 33, 37 e 40 descrevem o estado de 28/10. Detalhes e evidências: [RETRY_DEVNET_UNBLOCK_AND_INFRASTRUCTURE_REPORT.md](RETRY_DEVNET_UNBLOCK_AND_INFRASTRUCTURE_REPORT.md) e [docs/devnet/evidence/](../devnet/evidence/).

## 1. Resumo executivo

A RETRY agora tem um MVP funcional sobre o Meteora DBC, sem programa próprio:

- **Criar token**: supply fixo de 1 bilhão, 9 decimals, sem autoridade de mint/freeze, metadados imutáveis, primeira compra opcional na mesma transação, custo simulado antes de assinar, proteção contra envio duplicado e recuperação após recarregar.
- **Comprar e vender**: quotes do estado real da pool, taxa de 1% exibida e dividida, limite de slippage gravado na instrução, WSOL automático, simulação obrigatória, mensagens claras.
- **Graduar**: progresso e status do estado on-chain, migração manual (Devnet) para DAMM v2, com 100% da liquidez travada para sempre (salvo arredondamento de 1 unidade, ver seção 23).
- **Discover, página do token e Portfolio**: só dados on-chain de pools da config RETRY. Nenhum token, gráfico ou PnL fictício.

**O que foi provado on-chain**: o fluxo inteiro (config → lançamento com primeira compra → compra → venda → slippage recusado pelo programa → curva completa → migração para DAMM v2 com liquidez travada → saque das taxas do criador → listagem) rodou com transações reais num validador Solana local carregado com os **binários oficiais da Meteora clonados da Devnet e da Mainnet**, no GitHub Actions, e também no container de desenvolvimento.

**O que não foi possível**: rodar na **Devnet pública**. O faucet por RPC da Devnet respondeu `410 Gone: The RPC faucet is closed on this cluster` ([job](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40765616436/job/123088843971)). O caminho está pronto: basta um secret com uma carteira de teste financiada em faucet.solana.com (seção 29). O **Worker de metadados** está pronto e testado, mas não implantado (precisa da conta Cloudflare do proprietário). Testes com carteiras reais (Phantom etc.) ficam para o proprietário.

**Mainnet**: bloqueada por constante no código. Nenhuma config foi criada na Mainnet. Nenhum SOL real foi usado.

## 2. Estado inicial do projeto

- `main` em `0fcc9e5` (PR #7, gráfico de histórico completo, ainda da versão Base) publica o site no GitHub Pages.
- PR #6 (`migration/retry-solana`, Draft): migração para Solana somente leitura. Wallet Standard + `@solana/kit`, Devnet padrão, consulta de mints, nenhum fluxo financeiro. Estava em `cedf897` quando esta etapa começou; durante a etapa o autor do PR #6 trouxe a `main` (`0fcc9e5`) e chegou a `a2d1748`.
- Não existia integração Meteora, criação de token, negociação nem host de metadados.

## 3. Branches e commits inspecionados

| Branch                             | Commit                | Uso                                                                   |
| ---------------------------------- | --------------------- | --------------------------------------------------------------------- |
| `main`                             | `0fcc9e5`             | site publicado; não alterado                                          |
| `migration/retry-solana` (PR #6)   | `cedf897` → `a2d1748` | base desta etapa; **não alterado** por esta etapa                     |
| `feat/retry-protocol-architecture` | —                     | arquitetura antiga; não usada, não alterada                           |
| `feat/retry-meteora-dbc-mvp`       | esta etapa            | criada a partir de `cedf897`; `a2d1748` trazido por merge (`07260c4`) |

O PR #6 já contém a `main` atual (`0fcc9e5`), então esta branch também contém. O merge só tocou dois pontos: os scripts do `package.json` (mantidos os dois lados) e um teste e2e novo do PR #6 que esperava o botão antigo "Launch Token Coming Soon" e agora confere os botões travados da etapa de lançamento.

## 4. Decisão Meteora

DBC para a curva e DAMM v2 para a graduação, conforme pedido. Motivos práticos: programas auditados e já em produção, SDK oficial em TypeScript, taxa de parceiro nativa (a RETRY recebe parte da taxa sem custódia), migração permissionless e travamento permanente de liquidez nativos, e keeper da Meteora na Mainnet. Nenhum programa Rust próprio, nenhuma curva própria, nenhum Raydium.

## 5. Dependências utilizadas

| Pacote                                  | Versão                     | Por quê                                     |
| --------------------------------------- | -------------------------- | ------------------------------------------- |
| `@meteora-ag/dynamic-bonding-curve-sdk` | 2.0.0 (programa DBC 0.2.2) | SDK oficial                                 |
| `@solana/web3.js`                       | 1.98.4                     | exigido pelo SDK                            |
| `@solana/spl-token`                     | 0.4.15                     | ATAs, mint, saldos                          |
| `bn.js`                                 | 5.2.5                      | tipos numéricos do SDK                      |
| `buffer`                                | 6.0.3                      | o SDK usa `Buffer` global no navegador      |
| `@solana/kit`, Wallet Standard          | do PR #6                   | mantidos como fonte de carteira/cluster/RPC |

Versões exatas, lockfile verificado pela política de supply chain do pnpm. Pacotes com scripts nativos opcionais (`bigint-buffer`, `bufferutil`, `utf-8-validate`) ficam sem build (`pnpm-workspace.yaml`).

## 6. Arquitetura implementada

Ver [ARCHITECTURE.md](../meteora-mvp/ARCHITECTURE.md). Em resumo: UI → hooks (`use-retry.ts`) → `MeteoraContext` (mesma carteira, cluster e RPC do provider do PR #6) → SDK oficial → allowlist de instruções → simulação → assinatura na carteira (Wallet Standard `solana:signTransaction`) → verificação pós-assinatura → registro → envio → confirmação → atualização das queries. Site estático no GitHub Pages; único serviço extra é o Worker de metadados.

## 7. Configuração DBC

Uma config de parceiro RETRY por cluster, construída com `buildCurve` do SDK. Detalhes e motivos em [RETRY_LAUNCH_CONFIGURATION.md](../meteora-mvp/RETRY_LAUNCH_CONFIGURATION.md). Antes de cada operação, a config on-chain é comparada campo a campo com a revisada (`configMismatches`). Endereço Devnet: **pendente** (será criado na primeira execução na Devnet pública). Mainnet: vazio por decisão.

## 8. Configuração de tokens SPL

SPL Token clássico (não Token-2022), sem transfer fee, sem transfer hook. Autoridade de mint removida pelo DBC na criação, autoridade de freeze nula, metadados Metaplex com update authority = System Program (`Immutable`). Verificado on-chain no teste.

## 9. Supply e decimals

1.000.000.000 tokens, 9 decimals, supply total de exatamente 10¹⁸ unidades, verificado on-chain. ~80% vendido na curva, 20% vai com o SOL para o DAMM v2. Leftover 0. Sem vesting e sem alocação do criador: o criador só tem o que comprou (verificado: saldo do criador = saída da primeira compra; cofre da pool = todo o resto).

## 10. Taxas

1% fixo por negociação: 0,2% Meteora, 0,4% criador, 0,4% RETRY. Taxa de criação 0. Taxa de migração do parceiro/criador 0%. Meteora retém 0,2% da liquidez na graduação. LP da pool graduada: 1%. Medido on-chain: compra de 0,5 SOL pagou 0,005 SOL (0,001 + 0,002 + 0,002). Ver [FEES_AND_COSTS.md](../meteora-mvp/FEES_AND_COSTS.md).

## 11. Custos de lançamento

Medidos por simulação e saldo real:

- Criar + primeira compra de 0,1 SOL: 0,127038080 SOL (programas das fixtures do SDK, no container) e 0,126536960 SOL (binários da Mainnet, Actions), mais 0,00001 SOL de taxa de rede (2 assinaturas). Sem a compra, ≈ 0,0265–0,0270 SOL de aluguel e taxas.
- Criar a config (uma vez por cluster, pago pelo parceiro): **0,008194960 SOL** no total (aluguel da conta de config mais 0,00001 SOL de taxa de rede), medido nos dois binários.
- A tela mostra o custo simulado antes de pedir a assinatura.

## 12. Criação de tokens

`prepareCreateToken` usa `createPoolWithFirstBuy` do SDK; tudo numa transação. Validações: nome 2–32 bytes, ticker 2–10 `[A-Z0-9]`, URI só do host RETRY, primeira compra 0–1 SOL, slippage válido. Proteções: id de requisição contra duplicata, revisão presa aos dados, janela de 45 s para assinar, registro antes do envio, reconciliação. Ver [TOKEN_CREATION.md](../meteora-mvp/TOKEN_CREATION.md).

## 13. Metadados

Worker Cloudflare (`infra/metadata-worker/`) com JSON e imagem endereçados por SHA-256, origem restrita, limite por IP, validação de bytes da imagem; o app confere o hash ao ler de volta. 6 testes do Worker passam. **Bloqueado para uso real**: implantação na conta Cloudflare do proprietário. Sem a URL configurada, o botão de lançar fica desabilitado e explica o motivo. Os testes on-chain usam um JSON versionado neste repositório.

## 14. Compra

`swap2` com `PartialFill`, quote revalidada antes de montar, mínimo de saída gravado na instrução. Medido: 0,5 SOL comprou exatamente a quantidade cotada (130.564.541,249646396 tokens), impacto de preço 15,58%, variação de saldo 0,502039280 SOL (inclui 0,00203928 de aluguel da conta do token).

## 15. Venda

`swap2` com `ExactIn`, saldo conferido antes, WSOL desembrulhado na mesma transação. Medido: venda de metade rendeu +0,261505003 SOL, acima do mínimo cotado. Venda acima do saldo é recusada antes de assinar.

## 16. Cálculo de quotes

`swapQuote2` do SDK sobre a `VirtualPool` e a `PoolConfig` lidas na hora (mesma matemática do programa). A quote expira em 30 s, é refeita antes de montar e a transação é recusada se o novo mínimo for menor que o revisado. A primeira compra usa a quote pré-pool do SDK a partir da config. Em todos os testes on-chain a quantidade recebida bateu exatamente com a cotada.

## 17. Slippage

0,5% a 10% na tela (padrão 1%), intervalo aceito 0,1%–10%. Testado on-chain: com mínimo acima do possível, o programa recusa (erro 6002) e a tela mostra "The price moved beyond your slippage limit, so nothing was traded." Não há promessa de proteção contra MEV.

## 18. Descoberta de tokens

`listRetryPools` usa `getProgramAccounts` no DBC filtrado pelo endereço da config RETRY, então só aparecem lançamentos RETRY. Seções New, Graduating e Graduated por status real; busca e ordenação (mais novos, progresso, FDV). Estados vazios honestos. Mints consultados à parte (fora da RETRY) continuam no terminal de leitura do PR #6. Testado on-chain (o lançamento aparece na listagem) e no navegador (cartão no Discover).

## 19. Gráficos e dados

Não existe indexador de candles para pools DBC na Devnet, então a página do token mostra "No price chart yet" em vez de inventar um gráfico. Ela mostra preço à vista, FDV, progresso, reservas, atividade recente (`getSignaturesForAddress`, 20 últimas) e contas com links para o explorer. Um gráfico real exige um indexador (pendente, seção 40).

## 20. Portfolio

Abas Holdings (contas de token da carteira filtradas pelos mints RETRY), Created (pools em que a carteira é criadora) e Activity (operações registradas pela RETRY, com status e links). Valor em SOL = saldo × preço à vista. **Sem PnL**, porque não há preço de custo confiável sem indexador.

## 21. Graduação

Status e progresso do estado on-chain (seção [GRADUATION.md](../meteora-mvp/GRADUATION.md)). Curva completada com preenchimento parcial (10,000000001 SOL na reserva, FDV 50 SOL). Depois disso, novas quotes são recusadas. Na Devnet a migração é manual pelo painel; na Mainnet, keeper da Meteora.

**Achado real**: a migração falhou na primeira execução com os programas clonados porque o DBC pega emprestado o aluguel das contas do DAMM v2 da sua pool authority (`FhVo3m…uHLuM`) e cobra de volta do pagador na mesma instrução. No validador essa conta estava vazia ([execução](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40766575716)). Corrigido clonando a conta do cluster e adicionando uma verificação clara no app. Saldo dessa conta: **99,226635387 SOL na Devnet e 68,824058017 SOL na Mainnet** em 28/10/2026 (lido do RPC público de cada cluster pelo workflow). Depois da migração o saldo não diminuiu: o empréstimo é devolvido na mesma instrução.

## 22. DAMM v2

Migração `migration_damm_v2` executada com sucesso no validador com os binários de Devnet e de Mainnet ([execução 40769483758](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40769483758)): `isMigrated = 1`, status `graduated`, pool DAMM v2 criada e pertencente ao programa cp-amm, config pública FixedBps100 (`Hv8L…cjp`). Custo da migração para quem envia: **0,032518200 SOL** no total (0,000015 SOL de taxa de rede para 3 assinaturas, e o resto é o aluguel das contas novas do DAMM v2), entre 279 mil e 285 mil compute units conforme a execução.

## 23. Liquidity locking

Config: 50% parceiro + 50% criador, ambos `permanentLocked`. O teste lê as duas contas `Position` do DAMM v2 depois da migração: `vested_liquidity = 0`, `permanent_locked_liquidity` com a liquidez, e uma NFT com o parceiro e outra com o criador. **Detalhe real**: o DBC arredonda cada metade para baixo e deixa o resto (no máximo 1 unidade de liquidez) destravado na posição do criador; o teste viu exatamente 1 unidade. É poeira sem valor prático, mas a afirmação correta é "toda a liquidez travada, exceto 1 unidade de arredondamento". Valores lidos on-chain, iguais nos dois binários: uma posição com `permanent_locked_liquidity` = 411.657.202.295.550.785.824.274.880.615.505, `unlocked = 1`, `vested = 0`, e a outra com `permanent_locked_liquidity` = 411.657.202.213.054.352.498.513.200.089.599, `unlocked = 0`, `vested = 0`. As NFTs ficaram uma com o parceiro e outra com o criador, conferido pelo teste.

## 24. Anti-spam

Medidas simples, **não on-chain**: limite de uploads de metadados por IP por hora no Worker (10 por padrão), validação de campos e imagem, recusa de origens desconhecidas, bloqueio de envio duplicado no app. Qualquer pessoa pode criar uma pool DBC diretamente com a config RETRY fora do app; o programa não impede. O custo de criação (≈ 0,027 SOL) é o principal freio econômico.

## 25. Limitações do cap por carteira

O DBC **não tem limite de 5% por carteira**, e um limite assim não pode ser garantido sem um programa próprio (qualquer pessoa pode usar várias carteiras ou chamar o programa direto). Por isso nada foi falsificado: não há cap na interface fingindo ser regra on-chain. A primeira compra do criador é limitada a 1 SOL no app, o que é uma regra do app, não do programa. Pela quote do SDK sobre a config RETRY, uma primeira compra compra 3,08% do supply com 0,1 SOL, 13,79% com 0,5 SOL e **24,43% com 1 SOL**. A tela de revisão mostra essa porcentagem antes de assinar. Uma regra on-chain exigiria um programa próprio, que está fora do escopo. Se 24% for considerado concentração demais, o limite de 1 SOL pode ser reduzido no app (decisão da seção 39).

## 26. Segurança

- Nenhuma chave privada no repositório, no frontend ou em `NEXT_PUBLIC_*`; testes de fronteira impedem `secretKey`, `fromSecretKey`, mnemônicos, `signAllTransactions`, `signAndSendTransaction` e segredos em `NEXT_PUBLIC_*` em `src/`.
- Sem custódia: a carteira assina, a RETRY nunca segura fundos nem chaves.
- Allowlist por instrução e por conta antes da carteira, verificação depois da assinatura (pagador, blockhash, instruções), simulação obrigatória, `skipPreflight` só no reenvio dos mesmos bytes já simulados.
- 28 testes unitários/adversariais em `tests/meteora.test.ts` tentam trocar pool, config, mints, contas de saída, referral, inserir transferências, fechar contas de terceiros, programas desconhecidos, priority fee, signatário e pagador estranhos. Todos recusados.
- Mainnet: constante `false`, flags antigas de ambiente agora lançam erro.
- Imagens só de hosts confiáveis, `referrerPolicy=no-referrer`, metadados com hash conferido.
- Falta: revisão independente (seção 39).

## 27. Infraestrutura e custos

GitHub Pages (R$ 0), Worker Cloudflare no plano gratuito (R$ 0 dentro dos limites; o limite de gravações do KV permite ~300 lançamentos/dia), RPC público em Devnet. Para Mainnet: RPC dedicado (custo mensal a definir) e tesouraria multisig. Nenhuma API route Next.js (não funcionaria no Pages).

## 28. Testes automatizados

| Suite                                                         | Resultado                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest (13 arquivos)                                          | **126 passaram**, incluindo 28 Meteora (adversariais e unidade), 6 do Worker, 16 de config/política, 3 de fronteira de código                                                                                                                                                                                                      |
| Playwright sem blockchain (export estático, desktop e mobile) | **26 passaram** no CI (13 cenários × 2 telas, [execução](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40769483755)), incluindo "lançamento travado na Mainnet e sem host de metadados, nada assinado"                                                                                                      |
| Fluxo on-chain (`pnpm test:chain`, 10 testes)                 | **10/10** no container (programas das fixtures do SDK; migração pulada por falta da config DAMM) e **10/10 no GitHub Actions com os binários clonados da Devnet e 10/10 com os da Mainnet**, incluindo a migração ([execução](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40769483758))                   |
| Fluxo no navegador on-chain (`pnpm test:chain:browser`)       | **passou no container** (conectar → lançar com 0,2 SOL → revisar → assinar → "Launched." → comprar 0,1 → vender 50% → Portfolio → Discover, exatamente 3 assinaturas, nenhum erro de página) e **1/1 no Actions nos dois binários** ([execução](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40769483758)) |
| Lint, typecheck, build, build:pages, format                   | passam no CI                                                                                                                                                                                                                                                                                                                       |

## 29. Testes Devnet

**Bloqueado pelo faucet.** O job "Solana Devnet" rodou em 28/10/2026 e o `requestAirdrop` respondeu `410 Gone: The RPC faucet is closed on this cluster. Request test SOL at https://faucet.solana.com` ([job](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40765616436/job/123088843971)). Os testes foram pulados e registrados como pulados, não simulados.

Caminho pronto: secret `RETRY_DEVNET_FUNDER` com uma carteira de teste financiada à mão em faucet.solana.com (passo a passo no [runbook](../meteora-mvp/OPERATIONAL_RUNBOOK.md)). O job confere o genesis da Devnet antes de usar a chave, cria a config RETRY de Devnet, roda o fluxo e devolve o SOL que sobrar.

Como compensação parcial, o fluxo completo roda contra os **binários de Devnet e de Mainnet** clonados num validador local. Isso testa o código da RETRY contra os programas reais, mas não substitui a rede pública (latência, RPC público, carteiras reais).

## 30. Testes reais de carteira

**Pendente (proprietário).** O fluxo no navegador usa uma carteira Wallet Standard de teste que assina com uma chave local, o mesmo caminho de código de uma extensão. Phantom, Solflare e Backpack em Devnet precisam ser testados por uma pessoa, com o roteiro do runbook, depois que a config Devnet e o Worker existirem.

## 31. Arquivos modificados

`.env.example`, `e2e/solana-app.spec.ts`, `package.json`, `playwright.config.ts`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `src/app/globals.css`, `src/app/layout.tsx`, `src/components/create/create-flow.tsx`, `src/components/discover/discover.tsx`, `src/components/layout/shell.tsx`, `src/components/market/solana-lookup.tsx`, `src/components/portfolio/solana-portfolio.tsx`, `src/components/wallet/solana-status.tsx`, `src/components/wallet/solana-wallet.tsx`, `src/config/solana.ts`, `tests/solana-config.test.ts`, `tests/solana-source-boundaries.test.ts`.

## 32. Arquivos criados

- `src/lib/meteora/`: `buffer-polyfill.ts`, `client.ts`, `create-token.ts`, `curve.ts`, `errors.ts`, `fees.ts`, `format.ts`, `graduation.ts`, `metadata-upload.ts`, `metadata.ts`, `operations.ts`, `pools.ts`, `programs.ts`, `quotes.ts`, `sdk.ts`, `trade.ts`, `transactions.ts`, `wallet-signer.ts`
- `src/config/retry-protocol.ts`, `src/hooks/use-retry.ts`
- `src/components/launch/`: `graduation-panel.tsx`, `launch-card.tsx`, `launch-panel.tsx`, `launch-ui.tsx`, `retry-terminal.tsx`, `retry-trade-panel.tsx`
- `infra/metadata-worker/`: `src/index.ts`, `wrangler.toml`, `README.md`
- Testes: `tests/meteora.test.ts`, `tests/metadata-worker.test.ts`, `tests/chain/harness.ts`, `tests/chain/meteora-flow.chain.ts`, `tests/chain/use-validator-config.mjs`, `e2e/chain/meteora-browser.spec.ts`, `vitest.chain.config.ts`, `playwright.chain.config.ts`
- CI: `.github/workflows/meteora-chain.yml`
- Docs: os 8 arquivos de `docs/meteora/`, `docs/meteora/devnet-metadata/retry-devnet-test.json` e este relatório

## 33. GitHub Actions

- **RETRY quality checks** (`ci.yml`, já existente): format, lint, typecheck, testes, build, build:pages, e2e. Verde a cada push desta branch.
- **RETRY Meteora on-chain tests** (`meteora-chain.yml`, novo): validador com programas de Devnet e de Mainnet (fluxo + navegador) e job de Devnet (manual ou commit com `[devnet]`). Sem permissões de escrita, sem Pages, sem segredos além do opcional `RETRY_DEVNET_FUNDER`.
- Execução de referência: [execução 40769483758](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40769483758).
- Este branch não contém `pages.yml`, então nenhum push dele altera o site publicado.

## 34. Commits

Em ordem, na branch `feat/retry-meteora-dbc-mvp` (todos com a atribuição Claude Code):

| Commit    | Mensagem                                                                        |
| --------- | ------------------------------------------------------------------------------- |
| `c14d519` | feat(meteora): add the Meteora DBC layer for RETRY launches on Solana           |
| `8019fd7` | test(meteora): unit, adversarial and on-chain tests                             |
| `f5793a4` | feat(metadata): content-addressed metadata host for launches                    |
| `ee1c6de` | feat(ui): launch, trade, graduate and track RETRY tokens                        |
| `90702a4` | test(e2e): browser flows for locked states and the real launch                  |
| `74fa07d` | ci: run the Meteora flow on Devnet-cloned programs and Devnet                   |
| `5619230` | ci: test on Devnet and Mainnet program binaries; fund Devnet from a test wallet |
| `b832d9c` | fix(meteora): graduation needs Meteora's rent float; verify locked LP on-chain  |
| `2a053fc` | test(chain): accept DBC's 1-unit rounding remainder in the locked LP check      |
| `e632730` | docs(meteora): architecture, DBC config, flows, graduation, fees, runbook       |
| `6e906d9` | feat(launch): show the first buy's share of the supply before signing           |
| `a7fc1eb` | ci(meteora): publish chain evidence as run annotations and summaries            |
| `ee0e302` | docs(meteora): format with Prettier and add first-buy supply shares             |
| `07260c4` | merge: bring the latest PR #6 (a2d1748) into the Meteora branch                 |
| `589fc70` | docs(meteora): record measured migration, config and lock figures               |
| (este)    | docs(report): Etapa 3 report with the measured results                          |

Nenhum force-push, nenhum commit no PR #6 nem na `main`.

## 35. Draft Pull Request

[PR #8](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/8) — base `migration/retry-solana` (PR #6), Draft, não pronto para Mainnet.

## 36. Funcionalidades concluídas

- Integração com o SDK oficial, Program IDs fixados e conferidos, config RETRY reproduzível e verificada contra a on-chain.
- Criação de token com primeira compra atômica, custo simulado, duplicata bloqueada, recuperação.
- Compra e venda com quote real, taxas, slippage, WSOL, simulação, erros, confirmação e atualização.
- Discover, página do token e Portfolio com dados on-chain.
- Graduação: status, progresso, migração manual para DAMM v2, liquidez travada verificada.
- Saque das taxas do criador.
- Worker de metadados (código e testes).
- Testes on-chain contra binários reais de Devnet e Mainnet, no Actions.

## 37. Funcionalidades pendentes

- Execução na Devnet pública (precisa do secret `RETRY_DEVNET_FUNDER`) e o endereço da config Devnet no app.
- Implantação do Worker de metadados (conta Cloudflare do proprietário).
- Testes com carteiras reais.
- Gráfico de preço e PnL (precisam de indexador).
- Saque das taxas do parceiro RETRY pela tesouraria (operação fora do app).

## 38. Riscos

- **Economia**: FDV inicial ≈ 3,1 SOL faz compras grandes no início moverem muito o preço (15,6% em 0,5 SOL). A primeira compra máxima do criador (1 SOL) leva 24,43% do supply. Snipers também podem comprar cedo.
- **Binários diferentes entre Devnet e Mainnet**: o DBC tem hashes diferentes nos dois clusters (mesmo tamanho). Mitigado testando os dois.
- **Dependência da Meteora**: keeper, pool authority com SOL para a migração, upgrades dos programas (são atualizáveis pela Meteora).
- **Worker**: ponto único para novos lançamentos; não afeta negociação.
- **RPC público**: limites e instabilidade; usar RPC dedicado na Mainnet.
- **Spam de tokens e conteúdo abusivo**: sem moderação; ver seção 24.
- **Sem revisão independente** ainda.

## 39. Decisões necessárias para Mainnet

1. Parâmetros econômicos (FDV inicial, threshold, curva, % na migração) e o limite da primeira compra do criador (hoje 1 SOL ≈ 24,43% do supply).
2. Fee claimer da RETRY (tesouraria multisig) e quem opera a NFT de LP do parceiro.
3. Política de taxas (1% e divisão 50/50 criador/RETRY).
4. RPC de produção e orçamento.
5. Implantação do Worker e política de moderação.
6. Revisão de segurança independente.
7. Requisitos jurídicos.
8. Aprovação do checklist ([MAINNET_RELEASE_CHECKLIST.md](../meteora-mvp/MAINNET_RELEASE_CHECKLIST.md)) e autorização específica.

## 40. Próximas etapas

1. Proprietário cria o secret `RETRY_DEVNET_FUNDER` e roda o workflow; commitar o endereço da config Devnet.
2. Proprietário implanta o Worker e define `NEXT_PUBLIC_RETRY_METADATA_URL`.
3. Testes com Phantom, Solflare e Backpack na Devnet.
4. Integrar os PRs na ordem: PR #6 primeiro, depois este (a base dele muda para `main` automaticamente).
5. Indexador simples para gráfico e histórico (por exemplo, a partir dos eventos de swap do DBC).
6. Decisões da seção 39 e revisão de segurança.
