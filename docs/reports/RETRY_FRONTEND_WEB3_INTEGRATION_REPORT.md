# Relatório de integração: frontend RETRY (Etapa 1) + infraestrutura Web3 (Etapa 2)

- **Branch:** `feat/retry-frontend-web3-integration` em `ArthurBudagMatsuda/launchpadlendaria`
- **Data:** 27/10/2026
- **Escopo:** juntar o app Next.js da Etapa 1 e o módulo `@retry/web3` da Etapa 2 num único app, com carteira EVM real no header e todas as operações financeiras desligadas.

## 1. Resumo Executivo

O app RETRY da Etapa 1 agora usa o módulo `@retry/web3` como sua única camada Web3. O botão `Connect Wallet` do header abre o seletor do módulo (carteiras anunciadas via EIP-6963, MetaMask, Coinbase Wallet e WalletConnect quando configurado). Conectado, o header mostra o endereço abreviado e a rede, o menu da conta mostra endereço completo, rede, saldo real de ETH, link do Basescan, troca de rede e desconexão. A sessão continua ao navegar entre Discover, página do token (Trade), Create e Portfolio, e volta sozinha depois de recarregar a página. Base Sepolia (84532) é a rede padrão, Base (8453) é aceita somente leitura e qualquer outra rede mostra `Wrong Network` com o botão de troca.

Nenhuma operação financeira foi ligada: não há swap, approve, criação de token, escrita em contrato nem pedido de assinatura. Conectar só pede as contas da carteira.

O que foi verificado:

- 24 testes Vitest do app (os 20 da Etapa 1, 2 de integração React com o provider real e 2 de formatação), 125 testes do módulo (124 da Etapa 2 e 1 de regressão novo), 20 testes Playwright no export estático do GitHub Pages (10 cenários × desktop e Pixel 7) e os 22 testes Playwright do playground. Todos passam localmente e no GitHub Actions.
- `format:check`, `lint`, `typecheck`, `build` e `build:pages` passam.

O que **não** foi verificado: nenhuma carteira real foi usada no app integrado. Os testes usam uma carteira EIP-6963 simulada e RPC simulado. O app integrado também não foi publicado: o GitHub Pages continua mostrando as duas etapas separadas, e a troca está descrita em `docs/integration/GITHUB_PAGES.md` para quando for aprovada.

Durante a integração apareceram dois bugs, ambos corrigidos com teste de regressão: no módulo, o seletor de carteira reabria depois de desconectar; no app da Etapa 1, a página do token dava erro de hidratação do React quando o build rodava com Node 22, porque o Node 22 e o navegador formatam valores compactos em dólar de jeitos diferentes (`$12.40K` e `$12.4K`).

## 2. Estado Inicial

| Item                                  | Estado em 27/10/2026 antes do trabalho                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main` (`c1b0f89`)                    | README de uma linha ("claude fofuxo") e `.github/workflows/pages.yml`                                                                                                                            |
| `feat/etapa-1-foundation` (`2c8a156`) | App Next.js 16 completo (Discover, token, Create, Portfolio), pnpm, carteira própria (`src/config/wagmi.ts`, `wallet-button.tsx`, `use-wallet-balance.ts`). **Sem ancestral comum** com a `main` |
| `feat/etapa-2-web3` (`ab9b7d5`)       | `packages/retry-web3`, `examples/web3-playground`, `docs/web3/`, workflow `retry-web3.yml`, npm com `package-lock.json` por pacote. Parte da `main` (`ebfef93`). PR #1 em Draft, aberto          |
| `feat/retry-protocol-architecture`    | Trabalho de outra frente. Não foi tocado                                                                                                                                                         |
| Preview público (GitHub Pages)        | `/launchpadlendaria/` com a Etapa 1 e `/launchpadlendaria/web3/` com o playground da Etapa 2, montados por `pages.yml` a partir das duas branches                                                |
| Patch de integração                   | `docs/web3/etapa-1-integration.patch` na Etapa 2, testado numa cópia local da Etapa 1                                                                                                            |
| Testes de origem                      | Etapa 1: 20 Vitest. Módulo: 124 Vitest. Playground: 22 Playwright (11 × 2)                                                                                                                       |
| Carteiras reais testadas (26/10, Iam) | Phantom EVM, MetaMask e Coinbase Wallet conectaram no playground `/web3/`. Phantom EVM conectou na Etapa 1 (`/create/`) com o código de carteira antigo                                          |

Havia duas camadas de carteira paralelas: a da Etapa 1 (injected, Coinbase e WalletConnect configurados à mão) e a do módulo. O app publicado usava a da Etapa 1.

## 3. Estratégia Git

1. Worktree isolado em `/home/claude/wt/integration`, branch `feat/retry-frontend-web3-integration` criada a partir da `main` (`c1b0f89`). As branches das etapas não foram alteradas.
2. **Etapa 2 por merge normal** (`e3d0400`, pais `c1b0f89` e `ab9b7d5`). As duas têm ancestral comum (`ebfef93`), então o merge preserva os 26 commits da Etapa 2 sem reescrever nada. O único arquivo em comum, `pages.yml`, era idêntico.
3. **Etapa 1 por importação com proveniência** (`61e4765`). `git merge-base` não encontra ancestral comum entre a Etapa 1 e a `main`. Em vez de `--allow-unrelated-histories`, o commit adiciona a árvore exata de `2c8a156`, sem mudanças, com o autor original (`RETRY Development <dev@retry.local>`) e os trailers `Source-Branch: feat/etapa-1-foundation` e `Source-Commit: 2c8a156b784796f51fd2e028ba81af39936e3dd0`. A mensagem lista os três commits de origem (`4321e76`, `0d156f0`, `2c8a156`), que continuam no remoto. Sobreposições: `README.md` (o placeholder da `main` foi substituído pelo README da Etapa 1) e `pages.yml` (idêntico).
4. **Patch de integração** (`dade82d`): aplicação de `docs/web3/etapa-1-integration.patch`, sem conflitos.
5. Commits seguintes com mudanças pequenas e separadas por assunto (seção 16).

Não houve `--allow-unrelated-histories`, force push, rebase de branch publicada nem merge na `main`. O PR #1 (`feat/etapa-2-web3`) continua aberto: esta branch contém todos os commits dele, então fazer merge deste PR também leva o conteúdo do PR #1.

## 4. Arquitetura Antes/Depois

**Antes (dois apps independentes):**

```text
Etapa 1 (Next.js, pnpm)                      Etapa 2 (npm)
layout → Providers                           packages/retry-web3  (módulo, não usado pelo app)
  ├─ WagmiProvider(src/config/wagmi.ts)      examples/web3-playground (Vite)
  └─ QueryClientProvider                       └─ RetryWeb3Provider + componentes do módulo
header → wallet-button.tsx
portfolio / trade → use-wallet-balance.ts
```

**Depois (um app, uma configuração Web3):**

```text
src/app/layout.tsx
  └─ Providers (src/components/providers.tsx)
       └─ RetryWeb3Provider (@retry/web3): WagmiProvider + um QueryClient
            config = makeRetryWeb3Config()  ← src/config/web3.ts ← NEXT_PUBLIC_*
            ├─ Header: NetworkIndicator, ConnectWalletButton (seletor + menu da conta)
            ├─ Discover: catálogo demo (sem carteira)
            ├─ /token/[id] → TradePanel: WalletStatus + useRetryBalance
            ├─ /create → resumo: WalletStatus (lançamento desligado)
            └─ /portfolio: useRetryWallet, useRetryNetwork, useRetryBalance
examples/web3-playground  → mesma versão de @retry/web3 (workspace), ferramenta de dev
```

Workspace pnpm com três pacotes (`.`, `packages/retry-web3`, `examples/web3-playground`) e um único `pnpm-lock.yaml`. O app consome o módulo compilado (`workspace:*`); `dev`, `build`, `typecheck` e `test` compilam o módulo antes.

## 5. Arquivos Criados

| Arquivo                                                  | Para quê                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/config/web3.ts`                                     | Lê as variáveis `NEXT_PUBLIC_*` e cria a config do módulo (cookie, `ssr: true`). Veio do patch da Etapa 2 |
| `src/components/wallet/wallet-status.tsx`                | Bloco de estado da carteira usado no Trade e no Create (desconectado, conectado, rede errada com troca)   |
| `tests/integration/app-wallet.test.tsx`                  | Teste React do app inteiro (providers reais, header, navegação, Portfolio, Trade) com carteira simulada   |
| `tests/format.test.ts`                                   | Formatação em dólar igual no Node 22, no Node 24 e no navegador (seção 17)                                |
| `e2e/fixtures.ts`                                        | Carteira EIP-6963 simulada, RPC simulado (incluindo Multicall3), bloqueio de rede externa, helpers        |
| `e2e/app-wallet.spec.ts`                                 | 10 cenários Playwright no export estático, desktop e Pixel 7                                              |
| `playwright.config.ts`                                   | Build do export com base path `/launchpadlendaria` e servidor local na porta 4174                         |
| `scripts/serve-pages.mjs`                                | Servidor estático que imita o GitHub Pages (base path, barra final, `404.html`)                           |
| `docs/integration/GITHUB_PAGES.md`                       | Workflow proposto para publicar o app integrado, ordem dos passos e limites da hospedagem estática        |
| `docs/reports/RETRY_FRONTEND_WEB3_INTEGRATION_REPORT.md` | Este relatório                                                                                            |

## 6. Arquivos Modificados

**App (Etapa 1):**

- `src/components/providers.tsx`: `RetryWeb3Provider` no lugar de `WagmiProvider` + `QueryClientProvider`; aceita `config` opcional para os testes.
- `src/components/layout/header.tsx`: `NetworkIndicator` e `ConnectWalletButton` do módulo.
- `src/components/layout/shell.tsx`: link "Web3 test bench (dev tool)" no rodapé; texto do About diz que conectar nunca pede assinatura nem transação.
- `src/components/portfolio/portfolio.tsx`: hooks do módulo, nome da carteira ("Connected with …") e link do explorer.
- `src/components/trade/trade-panel.tsx`: hooks do módulo e `WalletStatus`. "Trading Coming Soon" continua só mostrando um aviso.
- `src/components/create/create-flow.tsx`: `WalletStatus` no resumo do lançamento. O botão de lançar continua desligado.
- `src/config/networks.ts`: reexporta as redes e a flag financeira do módulo.
- `src/lib/format.ts`: `minimumFractionDigits: 0` na notação compacta, para o HTML do build e o navegador mostrarem o mesmo valor (seção 17).
- `src/app/layout.tsx`: importa `@retry/web3/styles.css`.
- `src/app/globals.css`: variáveis `--rw3-*` ligadas aos tokens de cor do app e estilos de `.wallet-status`.
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.prettierignore`, `.gitignore`.
- `.github/workflows/ci.yml`: export do Pages como artefato e job de testes de navegador.
- `README.md`: reescrito para o app integrado.
- `docs/ARCHITECTURE.md`, `docs/PREVIEW.md`: fluxo com `@retry/web3` e aviso de que o preview ainda não é o app integrado.

**Módulo e playground (Etapa 2):**

- `packages/retry-web3/src/react/components/ConnectWalletButton.tsx`: correção do seletor que reabria (seção 17).
- `packages/retry-web3/test/components.test.tsx`: teste de regressão.
- `packages/retry-web3/package.json`: script `check` com pnpm.
- `examples/web3-playground/playwright.config.ts`: servidor com pnpm.
- `.github/workflows/retry-web3.yml`: npm → pnpm no workspace.
- `docs/web3/INTEGRATION_GUIDE.md`, `docs/web3/WALLET_INTEGRATION.md`: status "aplicado" e linhas do app integrado na matriz de verificação.

**Removidos:**

- `src/components/wallet/wallet-button.tsx`, `src/config/wagmi.ts`, `src/hooks/use-mounted.ts`, `src/hooks/use-wallet-balance.ts`: substituídos pelo módulo.
- `packages/retry-web3/package-lock.json`, `examples/web3-playground/package-lock.json`: o workspace usa só `pnpm-lock.yaml`.

`pages.yml`, o código Solidity e a simulação econômica (`feat/retry-protocol-architecture`) não foram alterados.

## 7. Dependências

| Pacote                                    | Versão resolvida         | Observação                                   |
| ----------------------------------------- | ------------------------ | -------------------------------------------- |
| next                                      | 16.4.3                   | Turbopack, App Router                        |
| react / react-dom                         | 19.3.1                   |                                              |
| wagmi                                     | 3.7.9                    | Uma cópia para app, módulo e playground      |
| viem                                      | 2.57.11                  |                                              |
| @tanstack/react-query                     | 5.104.5                  | Um `QueryClient` no app                      |
| @coinbase/wallet-sdk                      | 4.3.6                    | Fixado (já era na Etapa 1)                   |
| @metamask/connect-evm                     | 2.1.1                    | **Novo no app**, conector MetaMask do módulo |
| @walletconnect/ethereum-provider          | 2.26.0                   | Só é usado com Project ID válido             |
| @retry/web3                               | workspace                | **Novo no app**                              |
| @playwright/test                          | 1.63.0                   | **Novo** (dev)                               |
| @testing-library/react / dom / user-event | 16.3.3 / 10.4.2 / 14.6.8 | **Novos** (dev)                              |
| jsdom                                     | 29.1.1                   | **Novo** (dev)                               |
| vitest                                    | 5.0.5                    | App e módulo                                 |
| typescript                                | 5.9.3                    |                                              |

Gerenciador: pnpm 11.25.0 (`packageManager`), Node 24 (`engines`).

**Uma cópia de cada biblioteca.** Na primeira instalação o pnpm criou duas cópias do wagmi, porque o app e o módulo resolviam `use-sync-external-store` em versões diferentes (1.4.0 e 1.7.0), e isso gera dois contextos React do wagmi. O `overrides` em `pnpm-workspace.yaml` fixa 1.7.0. Depois disso `readlink -f` aponta wagmi, viem, react, react-dom, react-query, Coinbase SDK, WalletConnect e MetaMask SDK para o mesmo diretório nos três pacotes.

**Scripts de instalação:** `protobufjs` (dependência do SDK da MetaMask) fica com `allowBuilds: false`; o postinstall dele não é necessário.

**`pnpm audit --prod` (27/10):**

- **high**, `zod <4.6.6` (consumo de memória ao validar coleções grandes), via `abitype` dentro de viem, Coinbase SDK e WalletConnect. Já estava na Etapa 1. O app não valida entrada de usuário com zod.
- **moderate**, `uuid <11.1.1` (falta de verificação de limites quando um buffer é passado), via `@metamask/connect-evm`. Entrou com o conector MetaMask.

Nenhum override foi aplicado para essas duas: forçar versões maiores dentro de SDKs de carteira sem testar com carteira real é mais arriscado do que o alerta. Ficam como pendência (seção 19).

**Avisos de peer:** `eslint-plugin-import`, `eslint-plugin-jsx-a11y` e `eslint-plugin-react` (via `eslint-config-next`) ainda declaram suporte até ESLint 9, e o projeto usa ESLint 10. Já existia na Etapa 1; o lint passa.

## 8. Wallet Integration

- **Configuração única:** `src/config/web3.ts` chama `parseRetryWeb3Env` com as quatro variáveis `NEXT_PUBLIC_*` (lidas pelo nome literal, como o Next.js exige) e `createRetryWeb3Config` com cookie e `ssr: true`. O `Providers` cria a config uma vez por montagem (`useState`).
- **Conectores** (definidos no módulo): uma entrada por carteira anunciada via EIP-6963 (MetaMask, Phantom EVM, Rabby, Brave…), MetaMask SDK, Coinbase Wallet (extensão ou Smart Wallet), WalletConnect só com Project ID válido e `injected` legado só quando nenhuma carteira se anuncia. Nenhuma carteira aparece duas vezes; o teste de teclado do Playwright confere isso.
- **Sessão:** cookies `retry.wagmi.*` (id do conector, rede e lista pública de contas; nada secreto). Ao recarregar, o wagmi reconecta sem abrir a carteira.
- **SSR e hidratação:** o app é exportado como estático para o GitHub Pages, então o servidor não lê o cookie. O layout não passa `initialState`, o HTML sai com `Connect Wallet` e o navegador restaura a sessão depois de carregar. Assim as rotas continuam estáticas. Os testes Playwright recarregam uma rota profunda conectada e verificam que não há erro de console (incluindo erros de hidratação). No modo Node (`pnpm build && pnpm start`) dá para passar o estado do cookie ao provider; o guia de integração descreve isso, mas não foi ligado porque tornaria as rotas dinâmicas.
- **Eventos da carteira:** troca de conta e de rede feitas na carteira atualizam header, menu, Portfolio e Trade sem recarregar. A chave da consulta de saldo inclui endereço e rede, então o saldo da conta anterior nunca aparece.
- **Desconexão:** pelo menu ou pela carteira (revogar o site). As duas limpam a interface.
- **Operações financeiras:** a flag do módulo é `RETRY_FINANCIAL_OPERATIONS_ENABLED = false` no código, o app a reexporta como `financialActionsEnabled`, e não há variável de ambiente que a ligue. Os testes do módulo têm uma varredura de código que barra APIs de assinatura, envio e approve, e os testes de integração e Playwright registram todas as chamadas feitas à carteira e conferem que nenhuma é de assinatura, envio ou approve.

## 9. Base Network

| Rede         | Chain ID | Papel                                                         | RPC padrão                 |
| ------------ | -------- | ------------------------------------------------------------- | -------------------------- |
| Base Sepolia | 84532    | Rede alvo padrão (`NEXT_PUBLIC_DEFAULT_NETWORK=base-sepolia`) | `https://sepolia.base.org` |
| Base         | 8453     | Aceita, somente leitura, com aviso                            | `https://mainnet.base.org` |

- **Cenários:** rede alvo (ponto verde, tag `Testnet` na Sepolia, saldo), outra rede Base (funciona com aviso "read-only") e qualquer outra rede (`Wrong Network` no botão e no indicador, sem leitura de saldo, botão `Switch to Base Sepolia`).
- **Troca de rede** só acontece com clique do usuário. Troca recusada mostra a mensagem do módulo e não muda nada. Se a carteira não conhece a Base Sepolia, o wagmi pede para adicioná-la.
- **RPC:** endpoint próprio opcional por variável, senão o público da Base; tempo limite de 8 s e no máximo 2 novas tentativas para falhas temporárias (configuração do módulo). Rejeições do usuário nunca são repetidas.
- `NEXT_PUBLIC_DEFAULT_NETWORK=base` torna a Base a rede alvo. Continua somente leitura.

## 10. Header/Wallet UI

- O header da Etapa 1 manteve layout, busca e navegação. No lugar do botão antigo ficam `NetworkIndicator` e `ConnectWalletButton` do módulo, com as classes `network-button` e `wallet-button` do app.
- Estados do botão: `Connect Wallet`, `Connecting…` (só quando o usuário iniciou a conexão), endereço abreviado (`0x84A2...3F91`) e `Wrong Network` em vermelho.
- Menu da conta: endereço completo, `Copy Address`, nome da carteira, rede, saldo com atualização, `View on Basescan`, troca de rede e `Disconnect`. No desktop é um dropdown; até 480 px é um bottom sheet renderizado no `<body>`.
- Visual: as variáveis `--rw3-*` do módulo apontam para os tokens do app (`--panel`, `--border`, `--blue`, `--green`, `--red`, raio e sombra), então o seletor e o menu seguem o tema escuro do RETRY sem CSS duplicado.
- Acessibilidade: o seletor é um `dialog` com nome, mantém o Tab dentro dele enquanto está aberto e fecha com `Escape`; o teste Playwright abre com Enter e fecha com Escape.
- O Playwright confere que o menu fica dentro da tela e que não há rolagem horizontal no desktop e no Pixel 7. Capturas de tela do dropdown, do bottom sheet, do Trade, do resumo do Create e do `Wrong Network` foram revisadas durante o trabalho.

## 11. Portfolio

- Sem carteira: o estado vazio da Etapa 1 ("A home for your next chapter.") com o botão de conectar. Nenhum endereço ou saldo é inventado; o teste de integração confere que não aparece nenhum valor em ETH.
- Conectado: endereço completo, "Connected with <carteira>", rede, saldo real de ETH da rede ativa e link "View on Basescan".
- Rede errada: aviso e troca de rede, sem saldo.
- Falha de RPC: "Unavailable" e botão de tentar de novo, sem número (coberto no Playwright com RPC respondendo 503).
- Posições e histórico continuam com o estado "não indexado" da Etapa 1. Não existe indexador.

## 12. Discover/Trade/Create

- **Discover:** sem mudança de comportamento. O catálogo demo (15 tokens fictícios, marcados `Demo Data`) não depende da carteira. O Playwright confere o catálogo demo, a rede alvo com a carteira desconectada e as imagens com base path. Filtros e busca não mudaram e seguem cobertos pelos testes da Etapa 1.
- **Trade (`/token/[id]`):** o painel mostra `WalletStatus` (endereço e rede, ou rede errada com troca) e o saldo real em ETH no lugar da leitura antiga. A estimativa continua com a taxa ilustrativa fixa da Etapa 1, e o botão "Trading Coming Soon" só mostra um aviso. Nenhuma chamada de assinatura, envio ou approve acontece (verificado).
- **Create:** o fluxo de três passos e o rascunho local não mudaram. O resumo do lançamento mostra o estado da carteira e explica que conectar é opcional por enquanto. O botão de lançar continua desligado. O Playwright confere que o rascunho (com imagem) continua salvo depois de desconectar.

## 13. Testes Executados

Ambiente local: container Linux, Node 24.22.1 (a versão pedida em `engines`) e Chromium do Playwright 1.63.0. O GitHub Actions também usa Node 24. Os testes Playwright do app também foram rodados com um build feito no Node 22.22.0, que foi onde apareceu o erro de hidratação da seção 17.

| Comando                                                    | O que cobre                                                                      | Local, 27/10 | GitHub Actions |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------ | -------------- |
| `pnpm format:check`                                        | Prettier no app e na documentação                                                | Passou       | Passou         |
| `pnpm lint`                                                | ESLint, zero avisos                                                              | Passou       | Passou         |
| `pnpm typecheck`                                           | Módulo compilado + `next typegen` + `tsc --noEmit`                               | Passou       | Passou         |
| `pnpm test`                                                | 24 testes Vitest em 5 arquivos (20 da Etapa 1, 2 de integração, 2 de formatação) | 24/24        | Passou         |
| `pnpm build`                                               | Build Next.js para servidor Node                                                 | Passou       | Passou         |
| `pnpm build:pages`                                         | Export estático com `/launchpadlendaria`                                         | Passou       | Passou         |
| `pnpm test:e2e`                                            | 10 cenários × desktop Chrome e Pixel 7 no export estático                        | 20/20        | Passou         |
| `pnpm --filter @retry/web3 check`                          | Tipos, Biome, 125 testes Vitest e build do módulo                                | 125/125      | Passou         |
| `pnpm --filter retry-web3-playground exec playwright test` | 11 cenários × desktop e mobile no playground, depois da correção no módulo       | 22/22        | Passou         |

**Teste de integração React** (`tests/integration/app-wallet.test.tsx`), com o `Providers` real, o header, a navegação e as páginas, e uma carteira EIP-1193 simulada:

| Passos | O que o teste confere                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------- |
| 1      | App desconectado mostra `Connect Wallet` e Base Sepolia                                                   |
| 2–3    | Abrir o seletor e conectar                                                                                |
| 4–5    | Endereço e rede no header                                                                                 |
| 6      | Saldo de 0.0234 ETH vindo do RPC simulado da Base Sepolia, no menu                                        |
| 7–8    | Portfolio com o mesmo endereço, saldo, rede e nome da carteira                                            |
| 9–10   | Voltar ao Discover ainda conectado; o Trade mostra o mesmo saldo                                          |
| 11–12  | Troca de conta na carteira atualiza header e Trade (2 ETH)                                                |
| 13–14  | Troca para a Ethereum vira `Wrong Network`, o Trade esconde o saldo e a troca pelo painel volta à Sepolia |
| 15–16  | Desconectar pelo menu limpa header e Trade                                                                |

Ao final o teste confere: uma única solicitação de conexão durante toda a navegação, um único `QueryClient` com a consulta de saldo, flag financeira desligada, todas as chamadas RPC na rede 84532 e nenhuma chamada de assinatura, envio ou approve. Um segundo teste confere o Portfolio vazio sem carteira.

**Playwright no export estático** (`e2e/app-wallet.spec.ts`), servido em `/launchpadlendaria` como no GitHub Pages:

1. Todas as rotas, CSS e imagens com base path, sem erro de console; rota desconhecida cai no 404 do app.
2. Discover com o catálogo demo e a rede alvo desconectado.
3. Conectar no header; endereço, rede, 0.0234 ETH, Basescan, menu dentro da tela, sem rolagem horizontal; depois Portfolio, Discover e Trade com a mesma sessão.
4. Trade e Create sem operação financeira; rascunho com imagem sobrevive à desconexão.
5. Troca de conta e de rede na carteira, `Wrong Network`, volta para a Base Sepolia, Base Mainnet aceita.
6. Troca de rede recusada não finge sucesso.
7. RPC com erro 503 mostra "Unavailable" sem número e recupera ao tentar de novo.
8. Recarregar uma rota profunda conectada restaura a sessão sem erro de console.
9. Desconectar pelo menu e quando a carteira encerra a sessão.
10. Seletor aberto e fechado pelo teclado, sem entrada duplicada de carteira.

Esses testes provam o comportamento do app com uma carteira que segue os padrões EIP-1193/EIP-6963. Eles não provam compatibilidade com uma carteira real específica.

## 14. Carteiras Reais

Nenhuma carteira real foi usada no app integrado. Os resultados abaixo vêm do playground da Etapa 2 publicado em `/web3/`, testado por Iam em 26/10/2026; o app integrado usa o mesmo módulo, mas precisa do próprio teste.

| Carteira                  | Playground `/web3/` (mesmo módulo)                                                         | App integrado |
| ------------------------- | ------------------------------------------------------------------------------------------ | ------------- |
| Phantom (conta EVM)       | Passou: listada via EIP-6963, conectou, Base Sepolia, saldo real, desconectar e reconectar | **Pendente**  |
| Phantom (conta só Solana) | Ficava presa em `connecting`; corrigido no módulo; novo teste pendente                     | **Pendente**  |
| MetaMask (extensão)       | Conexão passou depois do aviso de domínio; rede errada, troca e desconexão sem retorno     | **Pendente**  |
| Coinbase Wallet           | Conexão passou; rede errada, troca e desconexão sem retorno                                | **Pendente**  |
| Rabby                     | Não testada                                                                                | **Pendente**  |
| WalletConnect             | Não testada (precisa de Project ID)                                                        | **Pendente**  |
| Carteiras em celular      | Não testadas                                                                               | **Pendente**  |
| RPC real Base Sepolia     | Passou (saldo lido de `sepolia.base.org`)                                                  | **Pendente**  |
| RPC real Base Mainnet     | Não testado                                                                                | **Pendente**  |

O ambiente onde este trabalho foi feito não alcança `github.io` nem os RPCs da Base (o proxy responde 403), então não foi possível nem abrir o preview público nem ler um saldo real daqui. O roteiro manual está em `docs/web3/WALLET_INTEGRATION.md`. Para testar o app integrado antes da publicação: `pnpm dev` ou `pnpm build:pages && pnpm preview:pages` numa máquina com a extensão instalada.

**Aviso da MetaMask:** em 26/10 a MetaMask marcou `arthurbudagmatsuda.github.io` como "Malicioso — sinalizado como não seguro" na tela de conexão. O aviso é sobre a reputação do domínio compartilhado `*.github.io`, não sobre algo que o app pede (o app só pede as contas). Status: **não resolvido e não verificado de novo** (sem acesso ao domínio daqui). Recomendação: publicar o RETRY no domínio próprio e, se continuar marcado, pedir revisão pela própria tela de aviso ou em `github.com/MetaMask/eth-phishing-detect`. O aviso não deve ser contornado nem escondido do usuário.

## 15. GitHub Actions

| Workflow                             | Gatilho                                                          | O que faz                                                                                                                                                                                               | Deploy |
| ------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `ci.yml` (RETRY quality checks)      | push e pull_request                                              | Job `validate`: install, format, lint, typecheck, test, build, `build:pages` e upload do export como artefato por 7 dias. Job `browser`: Playwright desktop + mobile, traces como artefato quando falha | Não    |
| `retry-web3.yml` (RETRY Web3 module) | push e pull_request em arquivos do módulo, playground e lockfile | Módulo (tipos, lint, testes, build) e Playwright do playground, agora com pnpm                                                                                                                          | Não    |
| `pages.yml`                          | push em `main`, `feat/etapa-1-foundation`, `feat/etapa-2-web3`   | **Sem alteração.** Publica as duas etapas separadas                                                                                                                                                     | Sim    |

Todas as actions estão fixadas por SHA, e as permissões são somente leitura (`contents: read`). Como esta branch não está no gatilho do `pages.yml`, os pushes dela não publicam nada. Fazer merge na `main` dispara o `pages.yml` atual, que republica as duas branches de etapa como estão hoje: o site público não muda. A troca do site para o app integrado é uma mudança separada, descrita em `docs/integration/GITHUB_PAGES.md`.

Execuções no commit `ee9af28`:

- RETRY quality checks: <https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40562177201> (passou: jobs `validate` e `browser`)
- RETRY Web3 module: <https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40562177312> (passou)

As execuções dos commits seguintes (correção de formatação e documentação) aparecem na aba Checks do PR.

## 16. GitHub Publication

- **Repositório:** <https://github.com/ArthurBudagMatsuda/launchpadlendaria>
- **Branch:** [`feat/retry-frontend-web3-integration`](https://github.com/ArthurBudagMatsuda/launchpadlendaria/tree/feat/retry-frontend-web3-integration), criada a partir da `main` `c1b0f89`
- **Push:** normal (`git push -u origin`), sem force push, direto no repositório oficial (não no fork)
- **PR:** Draft para `main`, sem merge automático (link na descrição do PR e na resposta final)

| Commit    | Descrição                                                                               |
| --------- | --------------------------------------------------------------------------------------- |
| `e3d0400` | merge: Etapa 2 (`feat/etapa-2-web3` @ `ab9b7d5`)                                        |
| `61e4765` | chore(repo): importa a Etapa 1 (`feat/etapa-1-foundation` @ `2c8a156`) com proveniência |
| `dade82d` | feat(web3): aplica o patch de integração do `@retry/web3` no app                        |
| `2fc2554` | chore(deps): um workspace pnpm e uma cópia do wagmi para app, módulo e playground       |
| `b329cc5` | fix(wallet): o seletor de carteira não reabre depois de desconectar                     |
| `3d1067d` | feat(wallet): estado real da carteira no Portfolio, Trade e Create                      |
| `8f1fda9` | test(integration): integração React e Playwright do app                                 |
| `ee9af28` | ci: valida o app integrado, o export do Pages e os testes de navegador                  |
| `8bc6c62` | fix(format): valores compactos em dólar iguais no build e no navegador                  |
| (este)    | docs: README, guia de publicação no Pages e este relatório                              |

## 17. Problemas Encontrados

| Problema                                                                                                                                                                                                                             | Solução                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Etapa 1 não tem ancestral comum com a `main` nem com a Etapa 2                                                                                                                                                                     | Importação da árvore com autor e commit de origem registrados (seção 3), sem `--allow-unrelated-histories`                                                                                                                                                                                           |
| Duas cópias do wagmi no `node_modules` (peers diferentes de `use-sync-external-store`), o que daria dois contextos React                                                                                                             | `overrides` para 1.7.0; verificado que app, módulo e playground usam a mesma cópia                                                                                                                                                                                                                   |
| Etapa 1 com pnpm e Etapa 2 com npm (`package-lock.json` por pacote)                                                                                                                                                                  | Workspace pnpm único; lockfiles npm removidos; `retry-web3.yml` e scripts migrados                                                                                                                                                                                                                   |
| **Bug no módulo:** depois de conectar pelo seletor e desconectar pelo menu, o seletor reaparecia aberto                                                                                                                              | O seletor era só escondido quando a conta aparecia, e o estado `aberto` ficava `true`. Agora é zerado quando a conta aparece. Teste de regressão no módulo; o PR #1 tem o mesmo bug e pode receber o commit `b329cc5`                                                                                |
| O conector simulado pede `wallet_requestPermissions`, não `eth_requestAccounts`                                                                                                                                                      | O teste conta qualquer um dos dois como a única solicitação de conexão                                                                                                                                                                                                                               |
| ESLint tratava o `use` das fixtures do Playwright como hook React                                                                                                                                                                    | Regra desligada só para `e2e/**`                                                                                                                                                                                                                                                                     |
| `pages.yml` ainda passa `VITE_DEFAULT_CHAIN` ao playground, nome que o playground não lê (ele lê `VITE_DEFAULT_NETWORK`)                                                                                                             | Sem efeito prático (o padrão já é Base Sepolia). Documentado e corrigido no workflow proposto; o `pages.yml` não foi mexido                                                                                                                                                                          |
| O README da `main` era um placeholder de uma linha                                                                                                                                                                                   | Substituído pelo README da Etapa 1 na importação e reescrito para o app integrado                                                                                                                                                                                                                    |
| O ambiente não alcança `github.io` nem os RPCs da Base                                                                                                                                                                               | Testes com carteira e RPC simulados; verificação real fica pendente e marcada como tal                                                                                                                                                                                                               |
| Erro de hidratação do React (#418) na página do token com build no Node 22: o servidor gera `$12.40K` e o Chrome `$12.4K`. Vem da Etapa 1 (`usd()` em `src/lib/format.ts`) e não aparece com Node 24, que é o do CI e do `pages.yml` | `minimumFractionDigits: 0` na notação compacta. Com isso o Node 22 e o Node 24 geram o mesmo texto, e o resultado no Node 24 não muda. Teste novo em `tests/format.test.ts` (falha antes da correção no Node 22). Todas as 18 rotas do export foram abertas sem erro de console com build no Node 22 |

## 18. Segurança

- **Segredos:** nenhuma chave privada, seed phrase, token de acesso ou credencial de RPC no código ou nos commits. Os únicos arquivos de ambiente versionados são os `.env.example` (valores vazios). A varredura do diff encontrou só endereços e strings de teste públicos.
- **Variáveis públicas:** só `NEXT_PUBLIC_DEFAULT_NETWORK`, as duas URLs de RPC e o Project ID do WalletConnect. Todas vão para o navegador; o README e os `.env.example` avisam para usar só endpoints públicos ou chaves restritas por domínio.
- **Sem operação financeira:** a conexão só pede contas. Não existe código de assinatura, envio de transação, approve, criação de token ou escrita em contrato no app. A flag do módulo é constante `false` e não há variável que ligue trading ou lançamento. Os testes verificam que nenhuma chamada desse tipo chega à carteira.
- **Saldos:** só leituras reais via RPC. Em erro o valor some e aparece "Unavailable"; não existe número estimado ou de fallback.
- **Dados de carteira:** o cookie `retry.wagmi.*` guarda só id do conector, rede e lista pública de contas. Nenhum dado de carteira é enviado a servidor (não há servidor).
- **Links externos:** explorer abre com `rel="noopener noreferrer"`.
- **CI:** permissões somente leitura, actions fixadas por SHA, nenhum segredo usado, nenhum deploy.
- **Hospedagem estática:** os cabeçalhos de segurança do `next.config.ts` só valem no modo Node; o GitHub Pages não os aplica. Para produção, usar um host que aplique CSP e os demais cabeçalhos.
- **Domínio:** o aviso de phishing da MetaMask no `*.github.io` (seção 14) não foi contornado; a recomendação é domínio próprio.
- **Dependências:** `zod` (high) e `uuid` (moderate) transitivos nos SDKs de carteira (seção 7).
- **Scripts de instalação:** só os pacotes listados em `allowBuilds` rodam scripts; `protobufjs` e `@reown/appkit` ficam desligados.

## 19. Pendências

**Crítica**

- Testar carteiras reais no app integrado (MetaMask, Coinbase Wallet, Phantom EVM, Rabby, WalletConnect, celular): conectar, rede errada, troca, desconexão e reconexão. Nada disso foi feito no app integrado.
- Decidir a publicação: o preview público ainda mostra as etapas separadas. Aplicar `docs/integration/GITHUB_PAGES.md` depois do merge, se aprovado.

**Alta**

- Aviso de domínio da MetaMask: domínio próprio para o RETRY e pedido de revisão se continuar marcado.
- Revisar e decidir o merge do PR #1 junto com este PR (este PR contém o PR #1). Se o PR #1 seguir sozinho, levar a correção `b329cc5` para ele.
- RPC dedicado para produção (os públicos da Base limitam requisições) e domínios permitidos no projeto Reown do WalletConnect.

**Média**

- `zod <4.6.6` e `uuid <11.1.1` transitivos: acompanhar atualização dos SDKs de carteira ou testar overrides com carteira real.
- Corrigir `VITE_DEFAULT_CHAIN` → `VITE_DEFAULT_NETWORK` no `pages.yml` (já incluído no workflow proposto).
- Remover as branches de etapa do gatilho dos `pages.yml` delas depois da troca, para não sobrescreverem o site integrado.
- Testar Base Mainnet com RPC real.

**Baixa**

- Atualizar o ESLint ou os plugins quando houver suporte oficial a ESLint 10 (avisos de peer).
- Outros navegadores (Firefox, Safari) podem formatar números de outro jeito; vale abrir as páginas de token neles e olhar o console antes da publicação.
- Carregamento dos SDKs de carteira no primeiro render (custo de bundle descrito em `docs/web3/WALLET_INTEGRATION.md`).

## 20. Próximas Etapas

1. **Parâmetros do protocolo:** fechar as decisões de `docs/TOKENOMICS_DECISIONS.md` (oferta, curva, taxas, limiar de graduação).
2. **Factory e ERC-20:** contratos de criação de token com testes e endereços registrados no registro de contratos do módulo (hoje `NOT_DEPLOYED`).
3. **Bonding curve:** compra e venda na curva, com limites e testes de propriedades.
4. **Graduação e lock de liquidez:** migração para DEX e trava de LP.
5. **Indexador:** eventos dos contratos para Discover, página do token, posições e histórico do Portfolio.
6. **Integração dos contratos no app:** ligar Trade e Create aos contratos atrás de uma flag revisada, com simulação antes de cada transação.
7. **E2E na Base Sepolia:** fluxo completo com carteiras reais e contratos de teste.
8. **Revisão de segurança:** auditoria dos contratos e da camada de transações antes de qualquer uso em mainnet.

## 21. Conclusão

A integração está feita numa branch própria, sem reescrever histórico, sem force push e sem tocar no deploy atual: o app da Etapa 1 usa o `@retry/web3` como única camada Web3, a carteira conecta no header e a sessão acompanha a navegação, com Base Sepolia como padrão, Base aceita e `Wrong Network` nas outras redes. Todas as verificações automatizadas passam, com carteira e RPC simulados. O que falta para considerar a carteira pronta para usuários é o teste com carteiras reais no app integrado e a publicação dele num domínio próprio. As operações financeiras continuam desligadas e dependem das etapas de contrato acima.
