# RETRY + Meteora DBC — Arquitetura

Estado em 28/10/2026, branch `feat/retry-meteora-dbc-mvp` (empilhada sobre `migration/retry-solana`, PR #6). Devnet apenas. Mainnet bloqueada por constante no código.

## Ideia central

A RETRY não tem programa on-chain próprio. Cada token lançado pela RETRY é uma pool do **Meteora Dynamic Bonding Curve (DBC)** criada a partir de **uma única config de parceiro RETRY por cluster**. A config é o que identifica um token RETRY on-chain: o Discover lista as pools do programa DBC filtradas por essa config. Quando a curva completa, a pool gradua para **Meteora DAMM v2** com liquidez travada para sempre.

```mermaid
flowchart LR
  UI[Create / Token / Discover / Portfolio] --> Hooks[src/hooks/use-retry.ts]
  Hooks --> Ctx[MeteoraContext: Connection + cluster + config]
  Provider[RetrySolanaProvider: Wallet Standard + cluster + RPC] --> Ctx
  Ctx --> SDK[SDK oficial @meteora-ag/dynamic-bonding-curve-sdk 2.0.0]
  SDK --> Builder[Transação web3.js v1]
  Builder --> Guard[validateTransaction: allowlist de instruções e contas]
  Guard --> Sim[simulateTransaction]
  Sim --> Wallet[Wallet Standard solana:signTransaction]
  Wallet --> Check[validateSigned: a carteira não trocou nada]
  Check --> Store[(Registro da operação no navegador)]
  Store --> Send[sendRawTransaction + confirmação]
  Send --> Refresh[Invalidação das queries]
```

## Fonte única de verdade

- **Carteira, cluster e RPC** continuam vindo do `RetrySolanaProvider` do PR #6 (Wallet Standard + `@solana/kit`). Nada foi substituído.
- `meteoraContext(config)` (`src/lib/meteora/client.ts`) cria a `Connection` do web3.js v1 a partir do mesmo RPC e do mesmo cluster. O SDK da Meteora usa web3.js v1; o Kit continua servindo as leituras antigas.
- `assertCluster` confere o genesis hash do RPC antes de qualquer transação. Se o RPC não for do cluster selecionado, nada é montado.
- `walletSigner` (`src/lib/meteora/wallet-signer.ts`) adapta a conta Wallet Standard conectada ao `Transaction` do web3.js v1. A carteira só assina (`solana:signTransaction`, com a `chain` do cluster). Quem envia é a RETRY, para registrar a assinatura antes do envio.

## Módulos (`src/lib/meteora/`)

| Arquivo                             | Papel                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `sdk.ts`, `buffer-polyfill.ts`      | Único ponto de importação do SDK. Instala `Buffer` global antes, porque o SDK depende dele no navegador.                       |
| `programs.ts`                       | Program IDs (DBC, DAMM v2, Locker, Metaplex, SPL, WSOL), conferidos contra o SDK em teste.                                     |
| `client.ts`                         | `MeteoraContext`, `assertCluster`, `assertWritable` (política de execução).                                                    |
| `curve.ts`                          | `RETRY_LAUNCH`, `retryCurve()` (via `buildCurve` do SDK) e `configMismatches()`, que compara a config on-chain com a revisada. |
| `pools.ts`                          | Decodificação de `PoolConfig`/`VirtualPool`, validação de que a pool é RETRY, status, progresso, listagem.                     |
| `quotes.ts`                         | Quotes com `swapQuote2` do SDK sobre o estado lido da pool. Mínimo de saída, impacto de preço, conclusão de curva.             |
| `create-token.ts`                   | Criação da pool + primeira compra numa transação. Id de requisição para evitar duplicatas.                                     |
| `trade.ts`                          | Compra/venda com `swap2`, revalidando a quote contra o estado atual.                                                           |
| `graduation.ts`                     | Estado de graduação e migração manual para DAMM v2.                                                                            |
| `fees.ts`                           | Divisão das taxas, tabela de taxas, saque das taxas do criador.                                                                |
| `transactions.ts`                   | Allowlist, simulação, assinatura, verificação pós-assinatura, envio, confirmação e reconciliação.                              |
| `operations.ts`                     | Registro local das operações (localStorage) para recuperação após recarregar.                                                  |
| `metadata.ts`, `metadata-upload.ts` | Leitura Metaplex e upload/verificação dos metadados no host RETRY.                                                             |
| `errors.ts`                         | Uma frase por erro, para o usuário.                                                                                            |
| `format.ts`                         | Conversões exatas em `bigint` (lamports e unidades do token).                                                                  |

## Interface

- `src/hooks/use-retry.ts`: hooks de dados (`useRetryLaunches`, `useRetryLaunch`, `usePoolActivity`, `useRetryHoldings`) e o executor `useExecute`, que percorre os estágios e invalida as queries `["retry"]` e `["solana","balance"]` ao confirmar.
- `src/components/launch/`: painel de lançamento (Create, etapa 3), terminal de token RETRY, painel de compra/venda, painel de graduação, cartão do Discover e componentes de estado.
- Telas alteradas: `create-flow.tsx`, `discover.tsx`, `solana-lookup.tsx` (tokens RETRY vão para o terminal RETRY; outros mints continuam no terminal de leitura do PR #6), `solana-portfolio.tsx`.

## Hospedagem

- O site continua 100% estático no GitHub Pages. Não existe API route.
- Único serviço extra: o **Worker de metadados** (`infra/metadata-worker/`, Cloudflare Workers + KV, plano gratuito). Ele guarda JSON e imagem endereçados por SHA-256. Ver [CREATE_TOKEN_FLOW.md](CREATE_TOKEN_FLOW.md).
- RPC: o público do cluster por padrão, ou `NEXT_PUBLIC_SOLANA_RPC_URL`.

## Política de execução

`executionPolicy(cluster)` em `src/config/retry-protocol.ts`:

- Mainnet: sempre `mainnet-locked`, porque `MAINNET_EXECUTION_ENABLED = false` é constante. Nenhuma variável de ambiente liga operações financeiras; as antigas flags `NEXT_PUBLIC_*` agora lançam erro se alguém tentar ligá-las.
- Devnet: `config-missing` enquanto `RETRY_DBC_CONFIGS.devnet` estiver vazio; habilitado quando houver a config.

## O que não existe (de propósito)

- Programa Rust próprio, custódia, chave privada no frontend, swaps automáticos, Raydium, Base/Ethereum, curva própria.
- Taxa escondida: toda taxa vem da config DBC e aparece na interface.
