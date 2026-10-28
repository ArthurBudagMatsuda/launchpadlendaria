# RETRY — Relatório da migração Base → Solana

Data: **28/10/2026**. Escopo: aplicação e infraestrutura de leitura, com preservação da identidade RETRY. Programas financeiros, transações, pools e publicação pública não fazem parte desta entrega.

## 1. Resumo executivo

A RETRY passou a usar Solana na aplicação ativa. A migração parte da versão integrada mais recente, preserva o design e o gráfico interativo e substitui a infraestrutura EVM por Wallet Standard e Kit. Devnet é o padrão. O usuário pode conectar uma carteira Solana, consultar SOL real no RPC escolhido e inspecionar um mint. Mainnet permite consultar mercados externos apenas para leitura. Nenhum token substituto foi promovido como destaque.

Lançar tokens, comprar/vender, cobrar taxas, guardar SOL e graduar liquidez continuam indisponíveis. O documento diferencia implementação, simulação automatizada, verificação pública e pendências reais.

## 2. Estado inicial da aplicação

O diretório original estava na branch `feat/etapa-1-foundation`, commit `2c8a156`, e continha um relatório Word não rastreado do usuário. Ele foi preservado. Trabalhar apenas nesse checkout antigo perderia melhorias já integradas.

Após atualizar referências, `origin/main` em `b5a19d4986a22b02951ac7e702e4af04f76a3e31` reunia frontend/Web3, mercado real Base, logo, candles, ATH e navegação do gráfico. Essa foi a base selecionada. Havia um módulo `@retry/web3`, playground separado, carteiras Ethereum, leituras ERC-20 e um token externo em destaque. Não havia protocolo financeiro pronto.

## 3. Organização Git e preservação

Branch exclusiva: **`migration/retry-solana`**. Checkout isolado: `E:\launchpadlendaria\.qa\retry-solana`. O checkout original e a branch de arquitetura de protocolo não foram alterados. Não houve merge em `main`, rebase de histórico compartilhado ou force push. Módulos retirados continuam recuperáveis em `b5a19d4` e nas branches antigas.

| Referência remota auditada             | Head observado | Relação com a migração                                        |
| -------------------------------------- | -------------- | ------------------------------------------------------------- |
| `main`                                 | `b5a19d4`      | Versão integrada selecionada                                  |
| `feat/etapa-1-foundation`              | `2c8a156`      | Fundação antiga                                               |
| `feat/etapa-2-web3`                    | `34de682`      | Integração EVM anterior                                       |
| `feat/retry-frontend-web3-integration` | `d39c375`      | Trabalho incorporado à versão integrada                       |
| `feat/retry-real-market-data`          | `b23a5bc`      | Trabalho de mercado incorporado                               |
| `fix/token-chart-and-logo`             | `f760550`      | Melhorias incorporadas                                        |
| `fix/token-chart-ath-and-panning`      | `4ccaf12`      | Melhorias incorporadas no PR #5                               |
| `feat/retry-protocol-architecture`     | `fc089d1`      | Arquitetura Base separada; não aplicada como protocolo Solana |

O log atribui a **CapotaVelha** os merges dos PRs #4 e #5. Portanto, houve participação efetiva no repositório integrado. Isso não comprova o estado de um fork particular nem permissões atuais da conta. A migração aproveitou essas atualizações.

## 4. Auditoria técnica

Inspecionados scripts, workspace, rotas, providers, hooks, carteiras, RPC, fontes de mercado, fixtures, armazenamento, assets, documentação e Actions. Foram lidas as instruções `AGENTS.md` e os guias da versão instalada do Next.js para componentes cliente/servidor e export estático antes da implementação. Revisão React aplicada aos componentes alterados.

Mantidos Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3, Tailwind 4.3.3, TanStack Query e `lightweight-charts` 5.2.1. Não foi reconstruído o produto em outro framework. O componente `candle-chart.tsx`, a marca e as artes do hero não receberam alterações funcionais.

## 5. Remoção do token Base anterior

O contrato anterior era `0xb200000000000000000000585fd80c20af698f01`. Foram retirados o cadastro ativo, a rota estática Base, o arquivo local de imagem, as fixtures de respostas Base, o verificador antigo e os serviços ERC-20/B20 correspondentes. Não existe redirecionamento para apresentar esse endereço como mint Solana.

`src/config/tracked-mints.ts` começa com catálogo vazio; a homepage apresenta **“No featured token yet”** e **“Discover tokens on Solana”**. Nenhum mint famoso, aleatório ou inventado foi escolhido como substituto. Menções ao endereço em documentos históricos e no teste de proibição são evidência de remoção, não configuração do produto. A validação final inclui varredura de `src`, `public`, scripts e export.

## 6. Antes e depois

| Camada            | Antes                                     | Depois                                              |
| ----------------- | ----------------------------------------- | --------------------------------------------------- |
| Carteira          | EIP-1193/EIP-6963, wagmi e conectores EVM | Registro Wallet Standard e conta Solana validada    |
| Unidade nativa    | ETH/wei                                   | SOL/lamports, `bigint` e 9 casas                    |
| Rede              | Base/Base Sepolia por chain ID            | Devnet/Mainnet por cluster e genesis                |
| Token             | Contrato ERC-20/B20                       | Mint + Token Program dono + cluster                 |
| Mercado           | Endpoints Base e destaque fixo            | Adaptadores Solana Mainnet, catálogo vazio e lookup |
| Histórico público | Hash e block number EVM                   | Assinatura e slot Solana                            |
| Produto           | Interface RETRY integrada                 | Mesma identidade e navegação, adaptadas para Solana |

## 7. Bibliotecas instaladas e justificativa

`@solana/kit@8.5.0`, `@wallet-standard/app@1.1.1`, `@wallet-standard/base@1.1.1` e `@wallet-standard/features@1.1.1`, com versões exatas. O Kit fornece validação de endereços e RPC com inteiros precisos. Wallet Standard fornece descoberta, conexão e eventos.

Foi avaliada a alternativa `@solana/react`; o contexto mínimo atual evita instalar plugins de assinatura/envio e uma segunda camada de estado para um escopo de identidade e leitura. Nenhum SDK DEX ou `web3.js` legado foi adicionado preventivamente. SDKs que exigirem outra geração de cliente serão isolados em adaptadores quando houver escopo financeiro aprovado. Referência: [SDK oficial Solana](https://solana.com/docs/clients/official/javascript).

## 8. Bibliotecas e módulos retirados

Retirados das dependências diretas: `@coinbase/wallet-sdk`, `@metamask/connect-evm`, `@retry/web3`, `@walletconnect/ethereum-provider`, `viem` e `wagmi`. O lockfile foi recalculado; a instalação registrou remoção de 293 pacotes. O workspace deixou de compilar `packages/retry-web3` e `examples/web3-playground`, retirados desta branch com recuperação pelo Git.

Os testes específicos desses módulos foram substituídos por cobertura Solana correspondente: ambiente, endereço, precisão, provider, eventos, saldo, mint, mercado, armazenamento, SSR/export e navegador. Testes independentes de validação, formatação, assets e matemática/gráficos foram mantidos. Não se afirma equivalência numérica com a quantidade de testes EVM anteriores, pois os protocolos têm modelos diferentes.

## 9. Carteiras suportadas e limites da evidência

Phantom, Solflare e Backpack são descobertas quando anunciam Wallet Standard Solana. Testes automatizados exercitam implementações simuladas das três. Verificados conexão, rejeição, cancelamento, conta alterada/vazia, desconexão, restauração silenciosa e remoção do registro. Não são solicitadas assinaturas.

**Carteiras reais testadas nesta execução: nenhuma.** A matriz desktop/móvel e o procedimento manual estão em [SOLANA_WALLET_INTEGRATION.md](../SOLANA_WALLET_INTEGRATION.md). Compatibilidade do padrão não equivale a comprovação de cada versão de extensão ou navegador móvel.

## 10. RPC e clusters

Devnet é o padrão; Mainnet é leitura opt-in. Os RPCs públicos oficiais foram consultados para conferir `getGenesisHash`, com os hashes completos registrados em [configuração de redes](../SOLANA_NETWORK_CONFIGURATION.md). Cada leitura verifica cluster, tem timeout, até duas tentativas e cancelamento. Erros são sanitizados. Não há saldo estimado nem substituição por zero.

Um RPC dedicado precisa ser configurado para tráfego público consistente. O prefixo `NEXT_PUBLIC_BASE_PATH` é caminho de hospedagem e continua necessário ao Pages; seu nome não indica integração Base. WebSocket é configuração reservada, sem assinatura ativa de eventos nesta versão.

## 11. Provider único

`RetrySolanaProvider` concentra identidade, carteiras, cluster, estados e ações de conexão. Header, Portfolio, Create e Trade leem o mesmo contexto. `QueryClient` é criado por instância; queries incluem cluster, RPC e endereço conforme o tipo de dado.

O provider verifica correspondência entre endereço base58 e bytes da chave pública. Gerações de sessão impedem respostas atrasadas após cancelamento/desconexão. A seleção do cluster altera o RPC do aplicativo; não executa troca de rede na extensão. A conexão silenciosa só usa a última carteira previamente registrada pelo aplicativo.

## 12. Header

Preservados logo RETRY, navegação, pesquisa, menu móvel e botão da carteira. O seletor apresenta Devnet/Mainnet. O menu mostra endereço, SOL real, Explorer, cópia, atualização e desconexão; carteiras ausentes têm links oficiais de instalação. Estado de configuração inválida e rejeição são visíveis.

## 13. Portfolio

Mostra endereço conectado, nome da carteira, cluster do RPC e saldo SOL, convertendo lamports com aritmética inteira. A leitura com falha fica **“Balance unavailable”**. Troca de conta/cluster usa chave de cache diferente. Contas SPL, tokens criados e histórico pessoal não são indexados: a interface informa a limitação e não cria holdings, PnL ou operações fictícias.

## 14. Discover

Hero, artes, filtros, ordenação e layout preservados. Cadastro vazio por falta de um mint revisado. Busca por endereço base58 é sensível a maiúsculas/minúsculas; nome/ticker podem ser buscados sem essa distinção. Um endereço fora do catálogo permite inspeção, sem gerar um lançamento RETRY. Categorias de lançamentos e graduados permanecem vazias e explicativas.

## 15. Trade

Buy/Sell, input, saldo e composição visual preservados. A moeda de pagamento é SOL; não há chamada ERC-20. Quote, rota e network fee não são inventadas. Botão de execução desabilitado no elemento HTML. Presets de valores e slippage da versão antiga foram retirados; nenhum parâmetro financeiro foi aprovado nesta entrega.

O gráfico existente aceita candles Solana validados, mantém modos candle/linha, intervalos, zoom, arraste, escala log e reset. ATH é apenas o maior valor observado na janela de dados disponível; não é uma certificação do máximo de toda a existência de um token.

## 16. Create

Preservados metadados, preview, validação de URLs, tipo/tamanho/assinatura de imagem, progresso e rascunho local. Launch continua desabilitado. A chave `retry:solana:token-draft:v2` copia apenas campos compatíveis do rascunho anterior. Preserva o registro antigo e dados de outros aplicativos; não usa limpeza global do navegador. Não restaura contratos, preço ou flags de rede antigos.

## 17. Serviços de mercado e atividade

Reutilizados os provedores existentes, com adaptadores novos para Solana: GeckoTerminal primário e Dexscreener fallback. URLs são formadas em hosts permitidos e usando mints/pools validados. Solicitações têm timeout; respostas validam chain, endereço, número finito e consistência OHLCV. Pool primária exige preço positivo, liquidez mínima de US$ 1.000 e atividade recente; isso é filtro de exibição, não recomendação nem validação para swap.

Consulta pública real confirmou formato de pools, metadata OHLCV e trades Solana no GeckoTerminal: 20 pools retornadas, 3 candles solicitados e atividade com assinatura/slot. Foi usado WSOL apenas como sonda de formato, sem cadastrar destaque ou copiar suas métricas para a interface. A documentação do [Dexscreener](https://docs.dexscreener.com/api/reference) confirma endpoint por `chainId`; a execução de fallback também é coberta com respostas simuladas.

Somente Mainnet chama provedores de mercado. Devnet informa indisponibilidade e nunca recebe preço Mainnet. Supply é lido do mint; FDV derivado não substitui market cap. Metadata, pool owner e extensões do DEX ainda não estão auditados para execução. Indexação pública não certifica legitimidade ou segurança de um token.

## 18. Arquitetura futura dos programas

[SOLANA_ARCHITECTURE.md](../SOLANA_ARCHITECTURE.md) define responsabilidades propostas de configuração, estado por lançamento, vaults, curva, migração, taxas e indexação. Inclui PDAs, validação de contas, CPI com programas permitidos, autoridade de upgrade e invariantes. Não foram criados programas Rust, IDLs fictícias, instruction builders ou endereços de deploy RETRY.

## 19. Modelagem econômica

SPL usa supply raw `u64`. Um bilhão de tokens com 9 decimals exige `10^18` unidades e cabe; com 18 exige `10^27` e excede `u64`. A combinação de 1 bilhão/9 é uma proposta em análise, não decisão aprovada. A implementação contém tipos e teste de limite, não emissão.

Taxas, reservas, curva, distribuição, graduação, quote asset, autoridade, burn/lock e rent precisam de especificação própria. Nenhum número em ETH da Base virou SOL automaticamente. Ver [decisões pendentes](../SOLANA_ECONOMIC_DECISIONS.md) e [modelo SPL](../SOLANA_TOKEN_MODEL.md).

## 20. Pesquisa Raydium e Meteora

[SOLANA_DEX_RESEARCH.md](../SOLANA_DEX_RESEARCH.md) compara LaunchLab/CPMM com DBC/DAMM v2, incluindo fees, migração, LP/position NFT, escrow permanente, burn e testes. As fontes primárias foram consultadas na data deste relatório. Há mudanças recentes documentadas em distribuição de LP Raydium e destino de novas pools DBC; exemplos antigos não devem virar configuração atual.

Não foi escolhida uma DEX definitivamente. Falta prova técnica autorizada no ambiente de teste, com programa/IDL/config verificados e evidência da retirada bloqueada e do direito a taxas. Nenhum lock ou pool foi executado nesta migração.

## 21. Testes executados

| Verificação                                     | Resultado registrado                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm install` após retirada EVM                | Concluído; lockfile atualizado                                                          |
| `pnpm test`                                     | 78 testes passaram em 11 arquivos, incluindo integração React                           |
| `pnpm lint`                                     | Passou com zero warnings                                                                |
| `pnpm typecheck`                                | Passou após corrigir bytes readonly e fixture                                           |
| `pnpm test:e2e` com `PLAYWRIGHT_CHANNEL=chrome` | 16 cenários passaram, desktop e mobile                                                  |
| Cenário adicional Mainnet/canvas/atividade      | Passou em desktop e mobile: canvas, modos, zoom, log, reset e assinaturas               |
| `pnpm build:pages`                              | Concluído como parte do teste de navegador, export `/launchpadlendaria/`                |
| `pnpm build` e varredura do export              | Build Node passou; sem contrato antigo e endpoints Base pesquisados no export           |
| `git diff --check`                              | Sem erros de whitespace na revisão inicial                                              |
| `pnpm peers check`                              | Aviso herdado: plugins ESLint declaram suporte até 9, projeto usa 10.13.0; lint executa |

O primeiro teste Playwright não iniciou porque o navegador empacotado não estava instalado; o download expirou. O Chrome já instalado foi usado com sucesso. Duas expectativas textuais iniciais dos testes foram alinhadas aos estados reais da UI; o produto não passou a aceitar endereços EVM. Uma falha real de restauração/eventos foi corrigida e coberta por integração.

Capturas de Discover, Portfolio e Terminal foram inspecionadas em desktop/mobile. Não houve overflow horizontal nos cenários verificados. Estes testes não comprovam uso de extensões reais nem disponibilidade contínua de serviços externos.

Verificações adicionais: `pnpm format:check` passou; `pnpm audit --prod` não encontrou vulnerabilidades conhecidas de produção.

## 22. GitHub Actions

CI valida formatação, lint, tipos, testes, build Node, export estático e navegador. Permissões de conteúdo são somente leitura. Automação EVM e publicação Pages foram retiradas desta branch. `preview-validation.yml` permite gerar artefato manual de revisão, sem publicar.

O site existente em `main` não foi atualizado. Status e links da execução remota serão registrados após o push do Draft PR; teste local não é apresentado como CI remoto concluído.

## 23. Arquivos modificados

Principais alterações: `package.json`, lockfile e workspace; `.env.example`; `README.md`; workflow CI e Playwright; layout, Header, Shell, providers, Discover, Create, Trade, token card e páginas Portfolio/Token; tipos de mercado, formatação e migração de draft. Documentos Base receberam aviso histórico. O diff do PR é a lista definitiva por arquivo.

| Arquivos principais                                                             | Motivo                                                                 |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/components/providers.tsx`, `src/app/layout.tsx`                            | Provider e estilos Solana, metadata do produto                         |
| `src/components/layout/header.tsx`, `shell.tsx`                                 | Carteiras, seletor de cluster, busca e identidade Solana               |
| `src/components/discover/discover.tsx`, `src/components/tokens/token-card.tsx`  | Catálogo vazio e consultas por mint/cluster                            |
| `src/components/trade/trade-panel.tsx`, `src/components/create/create-flow.tsx` | Preview adaptado, execução desabilitada e parâmetros antigos retirados |
| `src/app/token/page.tsx`, `src/app/portfolio/page.tsx`                          | Entradas dos componentes Solana                                        |
| `src/hooks/use-token-draft.ts`                                                  | Migração restrita de metadados                                         |
| `src/lib/market/types.ts`, `errors.ts`, `src/components/market/primitives.tsx`  | Identidade Solana, assinatura, slot e proveniência                     |
| `src/app/globals.css`                                                           | Retirada de marca Base obsoleta; regras gerais do design preservadas   |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.env.example`         | Nova stack e configuração pública                                      |
| `.github/workflows/ci.yml`, `playwright.config.ts`                              | CI Solana sem publicação e teste do export                             |

Inventário completo de arquivos criados, modificados e retirados: [manifesto de arquivos](RETRY_SOLANA_FILE_MANIFEST.md).

## 24. Arquivos criados e retirados

Criados provider/UI Solana, configurações de cluster e catálogo, RPC/address/token-model, adaptadores de mercado e search, queries, terminal/lookup/portfolio Solana, migração de storage, testes unitários/integração/navegador, workflow de prévia sem publicação, sete guias Solana e este relatório.

Entradas centrais novas: `src/components/wallet/solana-provider.tsx`, `solana-wallet.tsx`, `solana-status.tsx`, `solana.css`; `src/config/solana.ts`, `tracked-mints.ts`; `src/lib/solana/address.ts`, `rpc.ts`, `token-model.ts`; `src/lib/market/solana-market.ts`, `solana-token-search.ts`; `src/hooks/use-solana-market.ts`; `src/lib/draft-storage.ts`; `src/components/market/solana-terminal.tsx`, `solana-lookup.tsx`; `src/components/portfolio/solana-portfolio.tsx`.

Os sete guias novos são `docs/SOLANA_ARCHITECTURE.md`, `SOLANA_WALLET_INTEGRATION.md`, `SOLANA_NETWORK_CONFIGURATION.md`, `SOLANA_TOKEN_MODEL.md`, `SOLANA_LAUNCHPAD_ROADMAP.md`, `SOLANA_ECONOMIC_DECISIONS.md` e `SOLANA_DEX_RESEARCH.md`. O manifesto lista também os novos testes e a automação.

Retirados módulos EVM e playground, arquivos de configuração Base, hooks e adapters EVM, componentes de status/portfolio/terminal antigos substituídos, rota Base, imagem do token, script de consulta antigo e testes específicos substituídos. A retirada é da árvore atual; o histórico e as branches continuam preservados.

## 25. Problemas encontrados e resolução

O checkout original estava desatualizado frente à versão integrada: resolvido com inspeção de branches e worktree da head mais recente. A revisão automática rejeitou uma transformação ampla em lote; esse helper não foi executado. O trabalho prosseguiu com patches explícitos e remoções revisadas de arquivos rastreados.

Os testes identificaram restauração silenciosa indevida após conexão manual, que invalidava listeners de conta: resolvida marcando a tentativa explícita e cobrindo StrictMode, eventos e desconexão. Tipos readonly do Wallet Standard e fixture do navegador foram adaptados. Aviso de peers ESLint permanece documentado. Download do Chromium indisponível foi contornado pelo Chrome local, sem desabilitar testes.

## 26. Segurança e limites

Sem seed/private key, assinaturas, aprovações EVM, envio de transação, airdrop, deploy, criação de mint/pool, custódia ou recursos financeiros. Queries RPC limitadas às leituras necessárias. Cluster é verificado por genesis. URLs de Explorer são fixas; imagens remotas de tokens não são carregadas automaticamente. Flags públicas não desbloqueiam operações.

Não houve auditoria independente. Mints lidos, listas DEX e nomes de carteira não são certificados de segurança. Extensões Token-2022, pool ownership, governança externa e direitos de LP precisam de revisão antes de execução. O export Pages não aplica os headers do servidor Node. RPCs e APIs públicos têm limites e podem falhar. Configurações públicas com chave nunca devem conter segredos.

## 27. Pendências e próximos passos

1. Executar matriz de carteiras reais, inclusive navegadores móveis, com leitura Devnet/Mainnet comparada ao Explorer.
2. Escolher RPC dedicado e validar CORS, quotas e restrições públicas antes de tráfego público.
3. Aprovar economia e simulações; escolher política de emissão, autoridades e padrão de metadata.
4. Comparar integração DEX em ambiente de teste autorizado, com IDL/programa/config verificados e prova de lock/custódia de taxas.
5. Implementar indexação de SPL/ATA, metadados e histórico por assinatura com finality e reconciliação.
6. Só então implementar protocolo financeiro, testes de propriedades, auditoria e operação. Publicação e Mainnet exigem autorização própria.

## 28. Links GitHub

- [Branch da migração](https://github.com/ArthurBudagMatsuda/launchpadlendaria/tree/migration/retry-solana).
- [Comparação com main](https://github.com/ArthurBudagMatsuda/launchpadlendaria/compare/main...migration/retry-solana).
- [Fonte integrada inicial](https://github.com/ArthurBudagMatsuda/launchpadlendaria/commit/b5a19d4986a22b02951ac7e702e4af04f76a3e31).
- [Relatório nesta branch](https://github.com/ArthurBudagMatsuda/launchpadlendaria/blob/migration/retry-solana/docs/reports/RETRY_BASE_TO_SOLANA_MIGRATION_REPORT.md).
- [Actions](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions).

Links do Draft PR e das execuções específicas serão adicionados após criação/publicação da branch.

## 29. Conclusão

A infraestrutura ativa da RETRY foi adaptada para Solana mantendo a identidade visual e os componentes independentes de blockchain. O estágio entregue é de conexão, consulta e preparação técnica. Não equivale a um protocolo financeiro pronto para lançar. O próximo marco é uma especificação econômica Solana aprovada e uma prova DEX em ambiente autorizado.
