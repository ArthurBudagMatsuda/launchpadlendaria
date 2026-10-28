# RETRY — Solana launchpad foundation

Aplicação Next.js/React com identidade RETRY preservada, conexão Solana por Wallet Standard e leituras reais de SOL e mints. Devnet é o padrão. Mainnet é somente leitura. Nenhum lançamento, swap, assinatura, custódia ou programa financeiro está implementado.

## Estado atual

- **Discover:** hero, filtros, busca e navegação preservados. Catálogo vazio e “No featured token yet” até existir um mint Solana revisado. Nenhum ativo substituto foi escolhido automaticamente.
- **Token:** `/token/?cluster=devnet&mint=...` consulta um mint no cluster selecionado. Mainnet pode ler mercados GeckoTerminal/Dexscreener, candles e atividade pública; Devnet informa ausência de dados de mercado. O gráfico `lightweight-charts` e sua interação foram mantidos. Buy/Sell é apenas visual e o botão de execução está desabilitado.
- **Portfolio:** endereço da carteira, cluster do RPC, saldo SOL em lamports com precisão inteira e Explorer. Contas SPL, PnL e histórico pessoal ainda não são indexados.
- **Create:** validação de imagem/metadados e rascunho local preservados. O rascunho antigo compatível é copiado para uma chave Solana versionada, sem apagar o original. Criar token permanece desabilitado.
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
```

Em ambientes com Chrome já instalado pode-se definir `PLAYWRIGHT_CHANNEL=chrome` para o teste local. CI usa o Chromium instalado pelo Playwright. Os testes de navegador servem o export sob `/launchpadlendaria/` e simulam Wallet Standard/RPC; não fazem transações.

Copie `.env.example` para configuração local quando necessário. Todos os `NEXT_PUBLIC_*` são públicos. Não colocar chaves secretas, seed ou credenciais nos arquivos do frontend. Um RPC dedicado requer configuração de quota e origem; os RPCs públicos podem limitar tráfego. O genesis é verificado antes das leituras.

## Revisão e publicação

A migração está na branch `migration/retry-solana`, baseada na versão integrada `b5a19d4` de `main`. O trabalho é revisado por Draft PR. CI gera artefatos de teste; esta branch não contém job de publicação pública. Nenhuma alteração foi aplicada ao site público nem ao protocolo em Mainnet.

A revisão do PR #6 incorporou também `main` em `0fcc9e5`, preservando o histórico paginado do gráfico. Estado atual: revisão técnica com validação manual de extensões pendente. `test:rpc:live` é uma sonda opt-in de contas públicas, não um teste de carteira.

`build:pages` gera `out/`, `.nojekyll` e URLs sob `/launchpadlendaria`. O export continua compatível com GitHub Pages. Os headers do build Node não são configuráveis pelo Pages; escolher hospedagem/domínio e política de segurança antes de uma publicação autorizada.

## Documentação atual

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

Próximo passo: aprovar a economia Solana e os invariantes, depois executar uma prova de integração DEX em ambiente de teste autorizado. A documentação anterior da Base não define parâmetros atuais.
