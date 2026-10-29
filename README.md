# RETRY — Solana launchpad foundation

Aplicação Next.js/React com identidade RETRY preservada e Wallet Standard. A branch do PR #8 implementa integração **Meteora DBC/DAMM v2 candidata a testes Devnet**, sobre a migração do PR #6. Mainnet permanece bloqueada. Config RETRY e Worker não estão provisionados: funcionalidades implementadas não significam ciclo público já validado.

## Estado atual

- **Discover:** listagem on-chain filtrada pela config RETRY; sem config, estado vazio honesto.
- **Token:** leituras e preparação de quotes/compra/venda DBC; execução depende de config revisada, simulação e carteira. Gráfico/PnL completos dependem de indexação. Mainnet não executa operações.
- **Portfolio:** identidade, SOL, holdings e pools RETRY conforme dados on-chain disponíveis; sem atividade inventada.
- **Create:** rascunho/preview preservados; preparação de lançamento SPL/DBC com compra inicial opcional. Lançamento bloqueado enquanto config e host de metadados faltarem.
- **Carteiras:** Phantom, Solflare e Backpack por descoberta Wallet Standard. Testes usam carteiras simuladas; validação com extensões reais está pendente.

A aplicação ativa não usa serviços EVM, ERC-20 ou o antigo token Base. O histórico Git e os documentos marcados como históricos preservam a implementação anterior.

## Desenvolvimento e verificação

Node 24+ e pnpm 11.25.0. As versões Solana estão fixadas no lockfile: Kit 8.5.0 e Wallet Standard 1.1.1.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:pages
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:rpc:live
pnpm test:devnet:readiness
pnpm test:metadata:bundle
```

Em ambientes com Chrome já instalado pode-se definir `PLAYWRIGHT_CHANNEL=chrome` para o teste local. CI usa o Chromium instalado pelo Playwright. Os testes de navegador servem o export sob `/launchpadlendaria/` e simulam Wallet Standard/RPC; não fazem transações.

Copie `.env.example` para configuração local quando necessário. Todos os `NEXT_PUBLIC_*` são públicos. Não colocar chaves secretas, seed ou credenciais nos arquivos do frontend. Um RPC dedicado requer configuração de quota e origem; os RPCs públicos podem limitar tráfego. O genesis é verificado antes das leituras.

## Revisão e publicação

A implementação está em `feat/retry-meteora-dbc-mvp`, PR #8 Draft, empilhada sobre `migration/retry-solana`. CI gera artefatos e testa validadores locais; esta branch não publica o site. O teste público financiado é manual e protegido, ainda bloqueado por secret/financiamento e presença do workflow na default branch. Sem merge ou alteração da demonstração pública.

A revisão do PR #6 incorporou também `main` em `0fcc9e5`, preservando o histórico paginado do gráfico. Estado atual: revisão técnica com validação manual de extensões pendente. `test:rpc:live` é uma sonda opt-in de contas públicas, não um teste de carteira.

`build:pages` gera `out/`, `.nojekyll` e URLs sob `/launchpadlendaria`. O export continua compatível com GitHub Pages. Os headers do build Node não são configuráveis pelo Pages; escolher hospedagem/domínio e política de segurança antes de uma publicação autorizada.

## Documentação atual

- [Relatório de desbloqueio Devnet e infraestrutura](docs/reports/RETRY_DEVNET_UNBLOCK_AND_INFRASTRUCTURE_REPORT.md)
- [Carteira exclusiva e inserção segura do secret](docs/devnet/RETRY_DEVNET_FUNDER_SETUP.md)
- [Segurança do Actions e bloqueio de dispatch](docs/devnet/RETRY_GITHUB_ACTIONS_SECURITY.md)
- [Procedimento de testes públicos](docs/devnet/RETRY_PUBLIC_DEVNET_TESTS.md)
- [Worker, armazenamento e custos](docs/cloudflare/RETRY_METADATA_WORKER_SETUP.md)
- [Phantom real e preview](docs/testing/RETRY_PHANTOM_REAL_WALLET_TESTS.md)
- [Relatório completo da migração](docs/reports/RETRY_BASE_TO_SOLANA_MIGRATION_REPORT.md)
- [Revisão do PR #6 e correções](docs/reports/RETRY_PR6_REVIEW_AND_WALLET_VALIDATION.md)
- [Matriz de carteiras reais e simuladas](docs/testing/SOLANA_REAL_WALLET_TEST_MATRIX.md)
- [Arquitetura](docs/SOLANA_ARCHITECTURE.md)
- [Carteiras e matriz manual](docs/SOLANA_WALLET_INTEGRATION.md)
- [Configuração de redes e RPC](docs/SOLANA_NETWORK_CONFIGURATION.md)
- [Modelo SPL](docs/SOLANA_TOKEN_MODEL.md)
- [Decisões econômicas pendentes](docs/SOLANA_ECONOMIC_DECISIONS.md)
- [Pesquisa de DEX](docs/SOLANA_DEX_RESEARCH.md)
- [Roadmap](docs/SOLANA_LAUNCHPAD_ROADMAP.md)

Próximo passo: proprietário preparar o funder e ambiente protegido; validar ciclo público Devnet, Worker real e Phantom em origem autorizada. Economia candidata não está aprovada para Mainnet. A documentação anterior da Base é histórica.
