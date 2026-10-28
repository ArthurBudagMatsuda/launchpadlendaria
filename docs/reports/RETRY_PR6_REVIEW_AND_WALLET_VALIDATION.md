# RETRY — Revisão do PR #6 e validação de carteiras Solana

Data: **28/10/2026**. Repositório: [launchpadlendaria](https://github.com/ArthurBudagMatsuda/launchpadlendaria). PR preservado: [#6](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/6). Esta revisão reexaminou código e evidências atuais, sem assumir como garantia os resultados da migração anterior. Não equivale a auditoria externa independente.

## 1. Resumo executivo

**Resultado: revisão técnica concluída com validação manual de carteiras pendente.** Foram reproduzidos e corrigidos problemas de ciclo de carteira, configuração de RPC, limites de espera e diagnóstico de mint. A branch incorporou as melhorias de histórico do gráfico que chegaram depois à `main`, preservando seus commits.

Passaram **90 testes unitários/integração**, **24 cenários de navegador** em desktop/mobile e **2 consultas reais de RPC**, além de lint, tipos, build e export estático. As duas consultas reais usaram a conta pública do System Program; não houve carteira real conectada. O operador escolheu explicitamente registrar os testes reais de extensões como pendentes.

O PR permanece Draft. Não foi feito merge em `main`, deploy público, transação, assinatura, airdrop ou mudança econômica. O site público observado ainda apresenta a versão Base anterior; esta revisão não o substituiu pela versão Solana.

## 2. Pull Request #6

Origem: `migration/retry-solana`; destino: `main`. No início, a head era `cedf89700b5492e2859ca18fd20f5f2b4eebc541`, com os commits `c62d6ae` e `cedf897`, 189 arquivos no diff, Draft aberto e checks antigos aprovados. Não havia comentários, comentários inline ou revisões registrados na API consultada.

`git fetch origin` revelou uma `main` mais recente: `0fcc9e51048dfeb2c2a9cea360f2285b6fa874a0`, merge do PR #7. A branch `feat/token-chart-full-history` estava em `f7d3e5b`, após `f526d01`. A API do PR ainda informava a base histórica `b5a19d4` e `mergeable=clean`; por isso essa informação não foi usada isoladamente para concluir que a integração estava atualizada.

Foi feito merge normal de `origin/main` **na branch de migração**, não o contrário. A operação local reproduziu conflitos em README, import de teste e sete arquivos EVM que a migração já substituíra. As resoluções mantiveram Solana e portaram as mudanças legítimas do gráfico/consultas/testes. `git merge-base --is-ancestor origin/main HEAD` passou após a integração. Nenhum histórico foi unido com força, reescrito ou apagado.

As branches antigas de fundação, Web3, mercado, protocolo e correções foram preservadas. O relatório Word não rastreado no checkout original também permaneceu intacto.

## 3. Revisão do código

O inventário Git do PR, dependências, arquivos ativos, mudanças posteriores e arquivos retirados foram conferidos. A prioridade foi dada às fronteiras onde dados externos entram no estado React, ao isolamento por cluster e às alterações que poderiam perder trabalho de outro desenvolvedor.

| Área e arquivos examinados                                                                                                | Conclusão                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/components/wallet/solana-provider.tsx`, `solana-wallet.tsx`, `solana-status.tsx`                                     | Um contexto compartilhado; corrigidos validação de features/eventos, duplicação, desconexão e RPC configurado           |
| `src/components/providers.tsx`, `src/app/layout.tsx`                                                                      | Composição única, QueryClient por instância, limites client/server e estilo preservados                                 |
| `src/config/solana.ts`, `tracked-mints.ts`                                                                                | Devnet padrão, flags financeiras bloqueadas, catálogo vazio, nenhum destaque inventado                                  |
| `src/lib/solana/address.ts`, `rpc.ts`, `token-model.ts`                                                                   | Endereço base58/32 bytes, chave correspondente, lamports `bigint`, cluster por genesis, leitura de mint e limites `u64` |
| `src/hooks/use-solana-market.ts`, `src/lib/market/solana-market.ts`, `types.ts`, `http.ts`, `errors.ts`                   | Queries por cluster/mint/pool/intervalo; mercado Mainnet separado; histórico paginado portado                           |
| `src/components/market/candle-chart.tsx`, `solana-terminal.tsx`, `solana-lookup.tsx`, `primitives.tsx`, `chart-series.ts` | Melhorias recentes do gráfico preservadas; erro de RPC não é evidência de conta inválida                                |
| Header, Shell, Discover, token card, Portfolio e Trade                                                                    | Identidade/navegação preservadas; dados vazios honestos; nenhuma execução financeira                                    |
| Create, `validation.ts`, `draft-storage.ts`, `use-token-draft.ts`                                                         | Metadados, imagem, URLs e draft mantidos; cópia restrita de metadados antigos                                           |
| `next.config.ts`, scripts de build/servidor, Playwright, Vitest, Actions                                                  | Export `/launchpadlendaria/`, refresh e 404 testados; nenhum job de publicação nesta branch                             |
| `package.json`, workspace e lockfile                                                                                      | Instalação congelada reproduzível; nenhuma atualização de dependências introduzida nesta revisão                        |
| Remoções do módulo EVM, playground, rotas e fixtures antigas                                                              | Dependências substituídas e ausentes da aplicação; conteúdo recuperável pelo histórico Git                              |
| Documentação anterior e nova                                                                                              | Documentos Base continuam históricos; relatório original não foi reescrito como se incluísse esta validação             |

Os guias instalados do Next.js sobre export estático e componentes client/server foram consultados antes das alterações, conforme `AGENTS.md`. A revisão React incluiu efeitos/listeners, cancelamento, Strict Mode, chaves de listas, armazenamento, queries compartilhadas e imports pesados sob demanda.

## 4. Problemas encontrados

Não foi identificado bloqueador crítico de movimentação de fundos: a aplicação continua sem essas operações. A ausência de testes de extensões reais permanece um bloqueador de promoção para produção, não um teste aprovado.

| ID / gravidade            | Arquivo / trecho                                                                  | Causa e consequência                                                                                                                    | Correção e evidência                                                                                                      | Estado                                                           |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| R01 Alta, integração      | `candle-chart.tsx`, hooks/adaptadores de histórico                                | `main` avançou depois da migração. Integrar sem portar o novo fluxo perderia carregamento de candles antigos                            | Merge `29ed023`; cliente Solana usa página de 1.000 candles e `before_timestamp`; testes de paginação, deduplicação e pan | Corrigido; atualização posterior preservada                      |
| R02 Alta, disponibilidade | `solana-provider.tsx`: `compatibleWallet`, `selectAccount`, assinatura de eventos | Verificava só `connect`; feature de eventos incompleta ou contas malformadas podiam causar exceção ou impedir atualização da identidade | Features v1 de conectar/eventos/desconectar validadas; contas inválidas rejeitadas; falhas de inscrição/cleanup contidas  | Corrigido; testes de reprodução e regressão                      |
| R03 Média                 | `solana-provider.tsx`: `disconnect`; botão no menu                                | Promise da extensão sem limite de espera; rejeição tardia podia escrever erro na sessão reconectada                                     | Limite de 20 s, geração de sessão, limpeza imediata e fechamento independente do modal                                    | Corrigido; rejeição tardia e disconnect sem resposta testados    |
| R04 Média                 | `solana-provider.tsx`: `selectCluster`                                            | Voltar ao ambiente inicial descartava seu RPC personalizado e usava o público                                                           | Configuração inicial preservada por cluster; teste Devnet → Mainnet → Devnet                                              | Corrigido                                                        |
| R05 Média                 | `rpc.ts`: limite de operação                                                      | AbortController dependia de cooperação do transporte/callback. Um transporte simulado que ignorava abort ficava pendente                | Deadline rejeita independentemente do transporte, com até duas tentativas; cliente RPC reutilizado em cache limitado      | Corrigido; teste antes retornou `hung`, depois rejeitou no prazo |
| R06 Média                 | `solana-terminal.tsx`: estado de erro sem facts                                   | Falha de RPC também mostrava “not an initialized SPL mint”, inferindo algo não consultado                                               | Mostrar indisponibilidade sem diagnóstico negativo; cenário desktop/mobile                                                | Corrigido                                                        |
| R07 Baixa                 | `solana-provider.tsx`: lista de carteiras                                         | Objetos distintos com mesmo nome produziam opções e chaves React duplicadas                                                             | Uma opção por nome normalizado entre registros compatíveis; nome não é certificado de autenticidade                       | Corrigido; warning reproduzido e eliminado                       |
| R08 Baixa                 | `solana-wallet.tsx`: confirmação de cópia                                         | “Copied” permanecia após trocar a conta, embora a cópia anterior fosse de outro endereço                                                | Confirmação associada ao endereço efetivamente copiado; clipboard simulado nos testes                                     | Corrigido; desktop/mobile                                        |
| R09 Baixa, herdada        | Peers ESLint                                                                      | Plugins declaram compatibilidade até ESLint 9; projeto usa 10.13.0                                                                      | Lint efetivamente passa; sem upgrade/downgrade incidental; acompanhar manutenção upstream                                 | Pendente, não bloqueia esta validação técnica                    |

As cinco primeiras reproduções de estado/registro adicionadas à integração falharam antes da correção: RPC perdido, erro tardio, features incompletas, conta malformada e marca duplicada. O teste novo de deadline também falhou antes da correção. Não foram apagados testes para obter aprovação.

## 5. Arquitetura Solana

Mantido um `RetrySolanaProvider` sobre todas as rotas. Header, Create, Trade e Portfolio usam a mesma identidade. A descoberta é Wallet Standard; não há fallback para um provedor EVM de uma extensão multichain. São exigidas as features v1 necessárias ao ciclo da aplicação. Uma conta precisa anunciar Solana, ter endereço válido e bytes de chave pública correspondentes.

O nome da última carteira é a única informação de conexão persistida pelo provider. A restauração é silenciosa e restrita à carteira anteriormente selecionada. Eventos de conta vazia, retirada do registro, respostas atrasadas e Strict Mode foram exercitados com mocks. Nomes de carteiras não autenticam uma extensão; origem/versão reais exigem a matriz manual.

Kit 8.5.0 é o cliente RPC; lamports permanecem `bigint`. Clientes são reutilizados por URL em cache de até oito entradas; a identidade do cluster tem validade de 60 s. Queries de saldo incluem cluster, RPC e endereço. Selecionar cluster altera o RPC RETRY, sem solicitar mudança de rede na extensão. Hooks e componentes browser-only não leem `window` no SSR; export/build validaram essa composição.

## 6. Phantom

**Real: PENDENTE**, por decisão do operador de não disponibilizar carteira de teste. Nenhuma versão de Phantom foi usada ou presumida. Detecção oficial, autorização, aprovação/rejeição real, conta, bloqueio, múltiplas extensões e mobile real não foram validados.

**AUTOMATIZADO SIMULADO:** fixture nomeada Phantom passou em conexão, SOL, conta, SPA, reload silencioso, desconexão e cluster. O caminho de rejeição comum foi executado com essa fixture. A cópia após troca de conta também foi verificada sem usar o clipboard pessoal.

## 7. Solflare

**Real: PENDENTE.** Sem extensão/aplicativo real utilizado e sem versão declarada. A fixture Solflare passou em conexão, endereço, saldo, SPA, reload, conta, desconexão e clusters. Rejeição genérica do provider foi testada pela fixture comum, não como particularidade da Solflare. Ver matriz para os casos individuais ainda pendentes.

## 8. Backpack

**Real: PENDENTE.** Sem extensão/aplicativo real utilizado e sem versão declarada. A fixture Backpack passou no mesmo fluxo compartilhado de descoberta/conexão/estado/conta/saldo/navegação. Não há evidência real de coexistência com outras extensões ou de seu navegador móvel. Duplicações de registros foram reproduzidas e tratadas em teste do provider.

## 9. Matriz de testes de carteiras

Documento completo: [SOLANA_REAL_WALLET_TEST_MATRIX.md](../testing/SOLANA_REAL_WALLET_TEST_MATRIX.md). Contém versão, sistema, navegador, tipo, cluster, resultados e evidência; 18 casos reais individuais por carteira; procedimentos locais e de origem final; e distinção entre fixture, extensão e aplicativo.

| Carteira | Simulado                       | Extensão real | Mobile real |
| -------- | ------------------------------ | ------------- | ----------- |
| Phantom  | Aprovado nos cenários listados | Pendente      | Pendente    |
| Solflare | Aprovado nos cenários listados | Pendente      | Pendente    |
| Backpack | Aprovado nos cenários listados | Pendente      | Pendente    |

Emulação de tela mobile não aprova um aplicativo de carteira. Duas leituras reais de RPC também não equivalem a autorização de uma extensão.

## 10. Solana Devnet

Padrão confirmado por configuração e testes. Consulta real com o mesmo `readSolBalance` usado pela aplicação, em **20:14:50.012 UTC**, verificou o genesis Devnet e retornou slot **516171787**, saldo **1 lamport = 0.000000001 SOL** da conta pública do System Program. Não é saldo de usuário.

Testes determinísticos cobrem zero legítimo, saldo elevado além de `Number.MAX_SAFE_INTEGER`, erro de rede, resposta malformada, HTTP 429, timeout, cancelamento cooperativo, deadline independente do transporte e genesis de outro cluster. Erro não produz saldo zero.

## 11. Solana Mainnet

Somente leitura. A consulta real em **20:14:50.623 UTC** verificou o genesis Mainnet e retornou slot **462607636**, também **1 lamport** da conta pública usada como sonda. Evidência: [PR6_PUBLIC_RPC_READS.json](../testing/evidence/PR6_PUBLIC_RPC_READS.json).

No navegador simulado, os saldos foram intencionalmente diferentes entre Devnet e Mainnet para detectar mistura de cache. Explorer Devnet usa o parâmetro correspondente; Mainnet não recebe esse parâmetro. Nenhuma conta, token, pool ou programa foi criado; não houve assinatura nem envio.

## 12. Header e Wallet UI

Preservados logo, navegação, busca, seletor de cluster e modal Radix. O menu mostra endereço, SOL, Explorer, cópia, refresh e desconexão. A confirmação de cópia agora acompanha a conta. O modal fecha imediatamente ao desconectar, mesmo se a extensão não responder, enquanto o provider trata a revogação com prazo e erro controlado.

Foram verificados carteira ausente, rejeição, eventos inválidos, registros duplicados, desconexão, conta alterada e restauração em Strict Mode. A lista exige os recursos necessários; isso não constitui teste de cada extensão oficial.

## 13. Discover

Catálogo permanece vazio, com “No featured token yet”. Busca e navegação para inspeção de mint foram exercitadas sob o base path. Endereços não são convertidos para lowercase. Nome/ticker mantêm busca sem distinção de caixa. Categorias novas/graduadas não inventam lançamentos.

O contrato Base anterior não foi reintroduzido em fonte, assets, endpoints ou configurações ativas da branch. A presença dele na página pública Base antiga foi observada separadamente, sem alterar o deploy.

## 14. Trade

O gráfico incorpora o trabalho do PR #7: maior página do provedor, carga incremental ao chegar ao início, deduplicação, manutenção do viewport, zoom além do conjunto disponível, candles/linha, Log e reset. As queries antigas EVM não foram recuperadas para isso; seu comportamento útil foi portado para Solana, mantendo cluster/mint/pool/intervalo nas chaves.

O estado de erro do mint foi corrigido. Preço, candles e atividade são dados públicos indexados; não são cotações executáveis. Buy/Sell continua visual; botão financeiro permanece `disabled`. Não foram implementados builders, assinaturas ou rotas de swap.

## 15. Create Token

Formulário existente preservado. O teste de navegador preenche nome, ticker, descrição, website, X e Telegram, carrega PNG local, avança por Preview e Summary, confirma o botão de lançamento desabilitado e verifica persistência após reload. Validação unitária continua cobrindo limites, tipo/assinatura/tamanho de imagem e URLs inválidas.

Rascunho v2 Solana preserva metadados compatíveis e não limpa outros dados do navegador. Não há criação on-chain, taxa, mint ou conta de programa. Parâmetros econômicos continuam pendentes.

## 16. Portfolio

Verificados estado desconectado, conta conectada, SOL com nove casas de precisão, loading, indisponibilidade, refresh/queries, conta alterada, cluster alterado, reload silencioso e desconexão. Navegação SPA até Portfolio não abriu nova conexão; o teste verifica uma única chamada inicial. Após reload, a tentativa é `silent=true`.

SPL holdings, tokens criados e histórico pessoal continuam sem indexação, com estados vazios explícitos. Atividade de pool no terminal não é apresentada como histórico da carteira. Não existe PnL inventado.

## 17. Responsividade

Referências automatizadas: Desktop Chrome e Pixel 7 emulado, Windows `10.0.26200.0`, Chrome `156.0.8078.48`. O CI também executa os dois projetos em Chromium no runner Linux. Não equivale a Safari/iOS, Firefox, Brave ou apps de carteira reais.

Foram verificados menu móvel, modal, campos, cards, páginas, gráfico e ausência de overflow horizontal nos cenários previstos. Screenshots desta revisão usam fixtures e estão identificadas como **simuladas**; nenhuma contém carteira pessoal ou tela de credenciais.

Evidências visuais **AUTOMATIZADO SIMULADO**, com dados fictícios de teste:

- [Discover mobile](../testing/evidence/pr6-discover-mobile-simulated.png).
- [Gráfico e Trade desktop](../testing/evidence/pr6-mainnet-chart-desktop-simulated.png).
- [Portfolio mobile](../testing/evidence/pr6-portfolio-mobile-simulated.png).

## 18. Dependências

Instalação `pnpm install --frozen-lockfile` passou sem atualizar o lockfile. Mantidos Next 16.4.3, React/React DOM 19.3.1, Kit 8.5.0, Wallet Standard 1.1.1, TanStack Query e Lightweight Charts 5.2.1. As definições oficiais de features passaram a ser usadas na validação da integração; não foi instalada outra stack de carteiras.

Nenhum `wagmi`, `viem`, conector Coinbase/MetaMask/WalletConnect ou workspace EVM foi reintroduzido. O gráfico continua importado sob demanda. Não foram encontrados conflitos funcionais de React/SSR nos builds e testes. O aviso herdado de peers ESLint permanece registrado como baixa prioridade; lint passa. `pnpm audit --prod` não encontrou vulnerabilidades conhecidas na consulta realizada, o que não substitui auditoria independente.

## 19. Segurança

Nenhuma assinatura, envio, transferência, swap, airdrop, criação de token/conta/pool, burn, graduação ou lock foi executado ou habilitado. A interface só utiliza features de conexão/eventos/desconexão. Seeds, private keys e senhas não foram solicitadas, usadas ou registradas. A autenticação GitHub existente foi usada sem publicar seus valores.

Validações de endereço, chave pública, genesis, erro/timeout, geração de sessão e limpeza de listeners foram revisadas. Links externos usam destinos fixos de Explorer/instalação e `noopener noreferrer`. Imagens de tokens não carregam URLs remotas arbitrárias. Fixtures e valores fictícios permanecem restritos a testes. A origem de extensões oficiais continua pendente na matriz real.

## 20. Testes automatizados

| Comando                                         | Resultado nesta revisão                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                | Passou; sem atualização de dependências                                                  |
| `pnpm test` antes das correções                 | 78 passaram; referência inicial confirmada                                               |
| Novas reproduções focadas                       | Cinco testes de provider e um de deadline falharam antes das correções e passaram depois |
| `pnpm test` após correções                      | **90 passaram em 11 arquivos**                                                           |
| `pnpm test:e2e` com `PLAYWRIGHT_CHANNEL=chrome` | **24 passaram**, 12 desktop + 12 mobile emulado                                          |
| `pnpm test:rpc:live`                            | **2 passaram**, RPC real Devnet/Mainnet; nenhuma carteira                                |
| `pnpm lint`                                     | Passou com zero warnings após corrigir fixture de cursor                                 |
| `pnpm typecheck`                                | Passou                                                                                   |
| `pnpm build`                                    | Passou; páginas `/`, `/create`, `/portfolio`, `/token` e 404                             |
| `pnpm build:pages`                              | Passou durante os browser tests sob `/launchpadlendaria/`                                |
| `pnpm audit --prod`                             | Nenhuma vulnerabilidade conhecida encontrada                                             |
| `pnpm peers check`                              | Avisos ESLint descritos na seção 18; não foram escondidos                                |

Formatação e whitespace são conferidos novamente com os documentos finais antes do push. Suíte normal e CI não dependem de RPC externo: a sonda real é opt-in para que indisponibilidade de rede pública não substitua os testes determinísticos.

## 21. GitHub Actions

Os checks do head inicial `cedf897` foram confirmados diretamente no GitHub, não apenas aceitos do relatório anterior. A revisão foi enviada na branch do PR; os checks dos commits novos precisam ser considerados separadamente.

O CI do commit de código `83164bbf70177608db816d8e1602947fcf5da643` passou: [execução de PR 40762569582](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40762569582), com jobs de qualidade e navegador aprovados. A API passou a informar base `0fcc9e5`, head atualizada e integração limpa. [Checks atuais do PR #6](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/6/checks) são a referência para commits posteriores de documentação e captura de evidência, cuja head também é conferida antes da entrega.

Workflows mantêm `contents: read`, instalação congelada, formatação, lint, tipos, testes, build, export e browser tests. Artefato de export é de revisão. Nenhum `deploy-pages`, `pages: write` ou `id-token: write` foi adicionado. O script opt-in de RPC não é imposto ao CI.

## 22. GitHub Pages

Base path `/launchpadlendaria/` confirmado no build/export e testes: assets, CSS/JS, imagens, navegação SPA, reload de rotas, modal, gráfico e 404. O refresh é servido como diretório/index pelo servidor local de export.

A API Pages informou `build_type=workflow`, source `main` e caminho `/`. A observação real do domínio público mostrou o título “RETRY — A new beginning on Base”, selo Base Sepolia e o catálogo Base antigo. Isso é a publicação anterior, não uma falha em um deploy Solana que esta revisão nunca executou.

Não houve prévia pública nova nem teste real de autorização de extensão em `github.io`. Localhost/export não prova CORS, permissões de carteira ou reconhecimento da origem final. Headers do servidor Node não são automaticamente aplicados pelo Pages. Qualquer publicação precisa de autorização própria e da validação de origem correspondente.

## 23. Arquivos alterados

| Grupo                     | Arquivos e justificativa                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Integração de main        | `candle-chart.tsx`, `chart-series.ts`, teste `market-math`, documentação histórica: preservar PR #7                          |
| Porte Solana da paginação | `use-solana-market.ts`, `solana-market.ts`, terminal, teste de cursor e browser: nenhum caminho EVM recuperado               |
| Carteiras                 | `solana-provider.tsx`, `solana-wallet.tsx`, integração React: corrigir eventos, sessão, configuração, timeout e cópia        |
| RPC                       | `rpc.ts`, `solana-rpc.test.ts`: prazo independente do transporte e reutilização de cliente                                   |
| Sonda real                | `vitest.live.config.ts`, `tests/live/solana-readonly.probe.ts`, script em `package.json`: leitura pública opt-in             |
| Browser                   | `e2e/solana-app.spec.ts`, `solana-fixtures.ts`: SPA, reload, saldos distintos por cluster, falha de mint, Create e histórico |
| Evidência/documentação    | Este relatório, matriz real, JSON de RPC e imagens simuladas; guias de carteira/rede e README apontam o estado atual         |

O diff incremental [cedf897...migration/retry-solana](https://github.com/ArthurBudagMatsuda/launchpadlendaria/compare/cedf897...migration/retry-solana) contém as alterações desta revisão. As remoções amplas do módulo EVM pertencem à migração original; não foram repetidas como uma nova limpeza indiscriminada.

## 24. Commits

- `29ed023` — merge da `main` atual na migração, preservando o histórico paginado e o parentesco com `0fcc9e5`.
- `c271860` — correções do ciclo de carteira, eventos, configuração e cópia, com reproduções de integração.
- `699d110` — prazo de RPC independente do transporte, cache de clientes e sondas públicas opt-in.
- `83164bb` — regressões de navegador, navegação SPA, isolamento de cluster e diagnóstico do mint.
- O commit documental que contém este relatório publica também a matriz e as evidências, sem alterar a economia.

Pushes são normais para `migration/retry-solana`. Não houve force push, exclusão de branch ou commit na `main`.

## 25. Estado do PR

**Draft preservado — aguardando validação manual e revisão final. Não marcado pronto para merge.** Os problemas de código reproduzidos foram corrigidos e os testes automatizados passaram; não existe aprovação integral de Phantom/Solflare/Backpack reais.

A ausência de teste real de conexão, reconexão e origem final impede considerar a experiência pronta para produção. Mantendo o escopo não financeiro, a entrega é uma base técnica revisada para continuação do desenvolvimento. Não foi solicitada nem efetuada publicação pública.

## 26. Pendências

| Prioridade                         | Pendência                                                                                      | Impacto                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Crítica para operações financeiras | Economia, programas, auditoria e autorização de execução continuam ausentes                    | Todas as operações permanecem desabilitadas; não é regressão desta etapa       |
| Alta para liberação                | Extensões reais e origem final: conexão, conta, SOL, rejeição, bloqueio, reload e coexistência | Bloqueia promoção para produção e marcação de prontidão integral               |
| Média                              | RPC dedicado e CORS/quotas no domínio final; apps móveis reais                                 | Disponibilidade e experiência fora do ambiente simulado ainda não demonstradas |
| Média, produto futuro              | Indexação SPL/ATA, metadata e histórico pessoal                                                | Portfolio mantém estados vazios honestos                                       |
| Baixa                              | Compatibilidade declarada dos plugins ESLint com versão 10                                     | Aviso de peers; execução atual funciona                                        |

Não existem falhas críticas conhecidas de código pendentes dentro do escopo de leitura após as correções. Isso não elimina as lacunas de validação acima.

## 27. Próximos passos

Concluir a matriz real em perfil de teste controlado e, após autorização de uma origem de prévia, repetir os casos nesse domínio. Só então revisar prontidão de merge/publicação com o responsável.

Antes de implementar finanças: aprovar a especificação econômica Solana, produzir simulações e invariantes, escolher a integração DEX com versões/IDL/contas verificadas e definir autoridades, vaults e política de liquidez. A análise Raydium/Meteora e o roadmap existentes continuam planejamento, não autorização de deploy ou transação.

## 28. Conclusão

A revisão encontrou defeitos que os testes anteriores não cobriam, preservou contribuições posteriores da `main` e ampliou a evidência automatizada. A leitura RPC foi exercitada em redes reais, sem carteira. A interface e o export foram testados com fixtures e emulação de dispositivos.

**Não foram testadas carteiras reais nem publicada a versão Solana.** Os resultados permitem continuar o desenvolvimento sobre uma branch revisada; não permitem afirmar validação integral de extensões ou prontidão de produção. O PR #6 e a matriz mantêm essa pendência explícita.
