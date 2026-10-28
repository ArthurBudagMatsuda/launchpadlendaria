# Relatório da Etapa 4: dados reais de mercado na Base

- **Branch:** `feat/retry-real-market-data` em `ArthurBudagMatsuda/launchpadlendaria`, criada a partir da ponta da PR #2 (`f18d017`)
- **Pull request:** [#3 (Draft)](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/3), com base na `main` desde que a PR #2 entrou nela (28/10/2026, 12:37 UTC). Antes, a base era `feat/retry-frontend-web3-integration`
- **Data:** 28/10/2026
- **Escopo:** trocar os dados de mercado fictícios do RETRY por dados reais e somente leitura da Base, sem refazer o app, sem mexer na carteira e sem ligar nenhuma operação financeira.

## 1. Resumo Executivo

O RETRY deixou de mostrar o catálogo fictício. Discover, página do token e Portfolio agora mostram somente dados reais da Base mainnet, cada um com a fonte e a hora da atualização. O que um provedor não informa aparece como **Unavailable**, nunca como zero ou estimativa.

- **Token principal:** `0xB200000000000000000000585fd80C20af698f01` foi verificado na Base mainnet (chain 8453) por leituras on-chain feitas num workflow somente leitura do GitHub Actions.
  - É um token **B20**, o padrão nativo de tokens da Base, na variante ASSET.
  - Nome "one life, its worth an attempt", símbolo `worth`, 18 casas decimais e supply de 1.000.000.000.
  - Não tem relação com a RETRY. Aparece como **"Tracked on RETRY · External token"**, nunca como lançamento da RETRY.
- **Fontes:**
  - GeckoTerminal é a fonte primária (pools, velas OHLCV e trades).
  - DEX Screener é o fallback, só para pools e estatísticas.
  - As duas são APIs públicas, sem chave, chamadas pelo navegador.
  - A identidade do token vem do RPC da Base.
- **Gráficos reais:** velas de 5m, 15m, 1h, 4h e 1d da pool primária. Intervalos sem negociação ficam vazios, sem interpolação.
- **Trading continua desligado:** não há cotação, rota, approve, assinatura nem envio de transação.
- **Hospedagem:** o app continua funcionando como export estático no GitHub Pages. Não há API de servidor, segredo, dependência nova nem variável de ambiente nova.
- **Testes:** 80 testes Vitest (56 novos), 34 testes Playwright (17 cenários × desktop e Pixel 7), `format:check`, `lint`, `typecheck`, `build` e `build:pages`. Tudo passa localmente com Node 24 e no GitHub Actions (seção 19).
- **Preview:** com a aprovação de Iam, a Etapa 4 foi publicada no preview em 28/10/2026 às 04:22 UTC. Às 12:39 UTC o site passou a sair da `main`, que ainda não tem a Etapa 4. Ela volta ao site quando esta PR entrar na `main`.

## 2. Estado Inicial

| Item                  | Estado antes do trabalho (`f18d017`, ponta da PR #2)                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App                   | Next.js 16.4 (App Router, export estático), React 19, TypeScript estrito, Tailwind 4, wagmi 3 e viem 2 via `@retry/web3`, TanStack Query 5, Recharts 3                                      |
| Discover              | 15 tokens fictícios em `src/data/tokens.ts`, três estágios de curva, filtros de progresso, ordenação por market cap e volume, selo "Demo Data"                                              |
| Página do token       | `/token/[id]` para os IDs do catálogo (`orbit`, `based`, …), histórico de preço gerado por senos e cossenos, atividade inventada, estimativa de compra com razão fixa de 250.000 tokens/ETH |
| Portfolio             | Conta conectada e saldo real de ETH nativo; posições e histórico marcados como não indexados                                                                                                |
| Carteira              | `@retry/web3`: EIP-6963, MetaMask SDK, Coinbase Wallet, WalletConnect opcional, Base Sepolia como rede padrão e Base aceita para leitura                                                    |
| Testes                | 24 Vitest no app e 26 Playwright (13 cenários × 2), todos passando                                                                                                                          |
| Preview público       | Publicado a partir de `feat/retry-integrated-preview`, sem a Etapa 4                                                                                                                        |
| Ambiente desta sessão | O container não alcança o RPC da Base nem as APIs de mercado. Por isso as evidências ao vivo vieram de um workflow somente leitura no GitHub Actions (seção 5)                              |

## 3. Auditoria dos Dados Fictícios

| Onde                                                   | O que havia                                                                                        | Risco se fosse para produção                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `src/data/tokens.ts`                                   | 15 tokens inventados (nome, ticker, descrição, preço, volume, market cap, progresso de curva, cor) | Parecer um mercado real                            |
| `src/services/token-provider.ts`                       | `generateHistory()` com `Math.sin`/`Math.cos`, trades inventados, filtros sobre o catálogo         | Gráfico e atividade falsos                         |
| `src/types/token.ts`                                   | Tipos do catálogo (Token, PricePoint, Trade, BondingCurveState…)                                   | Modelo sem rede, sem endereço e sem proveniência   |
| `src/components/trade/terminal.tsx`, `price-chart.tsx` | Página do token sobre o catálogo e gráfico de área com o histórico gerado                          | Gráfico falso                                      |
| `src/components/trade/trade-panel.tsx`                 | Estimativa de compra e venda com razão fixa de 250.000 tokens/ETH                                  | Cotação inventada                                  |
| `src/components/ui/feedback.tsx`                       | `DemoLabel` ("Demo Data")                                                                          | Nenhum, era o rótulo                               |
| `src/lib/format.ts`                                    | `DEMO_NOW` (relógio fixo em 26/10/2026 15:00 UTC) e `age()`                                        | Idades falsas                                      |
| `src/components/tokens/token-card.tsx`, `discover.tsx` | Cards, filtros de progresso de curva e ordenação por market cap do catálogo                        | Métricas inventadas                                |
| `src/app/token/[id]/page.tsx`                          | Rotas estáticas geradas a partir do catálogo                                                       | Páginas para tokens inexistentes                   |
| `public/tokens/*.svg`                                  | Ilustrações originais dos tokens fictícios                                                         | Nenhum depois da troca: não são mais referenciadas |
| Placeholder do Create (`e.g. Orbit Cat`)               | Exemplo de nome num campo de formulário                                                            | Nenhum: é exemplo de entrada, não dado de mercado  |

## 4. Alterações nos Dados Demonstrativos

- O catálogo, o gerador de preços e os trades inventados foram para `tests/fixtures/demo-market.ts`, marcado como **TEST FIXTURE ONLY**. O teste antigo virou `tests/demo-fixture.test.ts`, com os mesmos 10 casos, agora importando a fixture. Nenhum teste foi apagado.
- Saíram de `src`:
  - `src/data/tokens.ts`;
  - `src/services/token-provider.ts`;
  - `src/types/token.ts`;
  - `src/components/trade/terminal.tsx` e `price-chart.tsx`;
  - `src/app/token/[id]/page.tsx`;
  - o `DemoLabel`, o `DEMO_NOW`, o `age()` e a razão de 250.000.
- Ficaram, de propósito:
  - `public/tokens/*.svg` e `scripts/generate-assets.mjs`, porque apagar arte é decisão de design e ela não aparece mais no app;
  - o placeholder do Create.
- Um novo teste, `tests/no-mock-leakage.test.ts`, falha se:
  1. código de produção importar fixture ou os módulos antigos;
  2. o código de mercado usar `Math.random`, `generateHistory` ou `Math.sin`, ou os marcadores da demo;
  3. um nome do catálogo aparecer em produção (fora do placeholder do Create);
  4. a configuração de tokens rastreados estiver inválida;
  5. o endereço do token principal aparecer fora de `src/config/featured-assets.ts`.
- No export estático, nenhum HTML contém preço, e o único nome da demo que sobra é o placeholder do Create.

## 5. Verificação do Token Principal

As leituras foram feitas pelo script `scripts/verify-market-data.mjs`, que só faz chamadas `eth_*` de leitura e GETs HTTP. Ele roda no workflow `.github/workflows/market-data-verify.yml` (permissão `contents: read`, nunca publica nada). Evidências: runs [40623949754](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40623949754) (bloco 53.183.474) e [40624224187](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40624224187) (bloco 53.183.561), ambas em 28/10/2026.

| Verificação                          | Resultado                                                                                                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formato e checksum                   | Válido. Checksum: `0xB200000000000000000000585fd80C20af698f01`                                                                                                                                                                                                     |
| Rede do RPC                          | `eth_chainId` = 8453 (Base mainnet)                                                                                                                                                                                                                                |
| Código no endereço                   | 1 byte, `0xef`. É o marcador dos tokens B20, que são precompiles em Rust. Um teste de "bytecode maior que zero" sozinho seria enganoso                                                                                                                             |
| Proxy                                | Slots EIP-1967 (implementation, admin, beacon) vazios. Não é proxy EIP-1967 nem clone EIP-1167                                                                                                                                                                     |
| Verificação em explorador            | Não confirmada. O Blockscout respondeu 403, e o BaseScan não foi consultado porque a API dele exige chave. Com o código `0xef` de precompile, não há código-fonte de contrato para verificar do jeito usual: a identidade vem da fábrica B20 e das leituras ERC-20 |
| `name()` / `symbol()` / `decimals()` | "one life, its worth an attempt" / `worth` / 18                                                                                                                                                                                                                    |
| `totalSupply()`                      | 1.000.000.000.000.000.000.000.000.000 unidades = 1.000.000.000 tokens                                                                                                                                                                                              |
| Fábrica B20 (`0xB20f…0000`)          | `isB20` = true, `isB20Initialized` = true. Byte 10 do endereço = `0x00`, variante ASSET                                                                                                                                                                            |
| `contractURI()`                      | `ipfs://bafkreif2dl3lqoipfn7eow6j3yfz45b75oqjec4zxpzux3r43gbnr2dslm`. Não foi carregado nem usado: metadados de marca não verificados                                                                                                                              |
| `owner()`                            | A chamada falhou. Nenhum dono foi identificado                                                                                                                                                                                                                     |
| Logs de Transfer recentes            | `eth_getLogs` falhou no RPC público. Holders não foram indexados                                                                                                                                                                                                   |
| Mesmo endereço em outras redes       | Base Sepolia: `isB20Initialized` = false e `name()` reverte. Ethereum, Arbitrum e Optimism: sem código                                                                                                                                                             |

**Conclusão:** é um token B20 real e ativo na Base mainnet. O endereço válido não prova legitimidade e nada liga o token à RETRY. Por isso ele aparece como token externo rastreado, sem logo, site ou redes sociais, já que nenhum desses metadados foi verificado. Existe um token **impostor**, `0x5e5Ff0170d13049e0e048F8eabc98f8FBd4eEFD1`, com o mesmo nome e símbolo (`worth`), pareado contra o verdadeiro. O token é identificado sempre por chain + endereço, nunca pelo símbolo.

Tokens B20 podem dar ao emissor controles de mint, pausa e políticas de transferência. Os papéis deste token não foram revisados, e a página diz isso explicitamente.

## 6. Pools de Liquidez

No momento da verificação, o GeckoTerminal listou 20 pools na primeira página e o DEX Screener listou 25 pares para o token.

| Pool                                                | Situação                    | Liquidez (USD)    | Motivo                                                                  |
| --------------------------------------------------- | --------------------------- | ----------------- | ----------------------------------------------------------------------- |
| worth/ETH, Uniswap v4, `0x6cf637a8…3514`            | **Primária** (configurada)  | ≈ 190,9k a 191,0k | ETH nativo como cotação, a mais profunda, listada pelos dois provedores |
| worth/USDC 5%, Uniswap v4                           | Elegível                    | ≈ 59,2k           | USDC como cotação, acima de $1.000, com trades em 24 h                  |
| worth/USDC 4,989% e 4,75%                           | Elegíveis quando têm trades | ≈ 1,9k a 2,0k     | Pouco acima do mínimo                                                   |
| "worth / worth 0.25%"                               | **Excluída**                | ≈ 267,7k          | O token impostor é a base e o verdadeiro é a cotação                    |
| Pools worth/ETH e worth/USDC com taxa de 6,5% a 90% | Excluídas                   | $3 a $296         | Abaixo de $1.000 (poeira)                                               |
| cbETH/worth, Aerodrome Slipstream                   | Excluída                    | ≈ $1,18           | O token é a cotação e a liquidez é irrisória                            |

A pool primária foi criada em 15/08/2026 e tinha cerca de $0,88M a $0,91M de volume em 24 h. O GeckoTerminal chama a DEX de `o1-launchpad` e o DEX Screener de `uniswap` com o rótulo `v4`. Os IDs de pool do Uniswap v4 têm 32 bytes, não são endereços.

**Política de pool primária** (`src/lib/market/pool-selection.ts`):

1. O endereço rastreado precisa ser o token base da pool.
2. A cotação precisa ser ETH nativo, WETH ou USDC da Base.
3. A pool precisa ter preço em USD, liquidez de pelo menos $1.000 e pelo menos um trade em 24 h.
4. As elegíveis são ordenadas por liquidez, depois volume de 24 h, depois ID.
5. A pool configurada em `src/config/featured-assets.ts` vence enquanto continuar elegível. Se ela sumir ou deixar de ser elegível, a página avisa e usa a mais profunda.
6. Pools nunca são somadas: preço, liquidez e volume exibidos são sempre de uma pool.

A página mostra quantas pools são elegíveis, quais foram excluídas e por quê.

## 7. Fontes de Dados

| Fonte                                                          | Uso no RETRY                        | CORS / chave                              | Limite e cache                                                         | Observações                                                                                        |
| -------------------------------------------------------------- | ----------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [GeckoTerminal API](https://www.geckoterminal.com/dex-api)     | **Primária:** pools, OHLCV e trades | `*`, sem chave; preflight aceita `Accept` | 30 chamadas/min no plano gratuito; `max-age=30, s-maxage=60`           | API "in Beta", sem SLA. `market_cap_usd` vem igual ao `fdv_usd`, então não é usado como market cap |
| [DEX Screener API](https://docs.dexscreener.com/api/reference) | **Fallback:** pools e estatísticas  | `*`, sem chave                            | `max-age=30`. Limite do endpoint de tokens não confirmado nesta sessão | Não tem OHLCV nem trades. Também informa `marketCap` = `fdv`                                       |
| RPC da Base (`mainnet.base.org` ou `NEXT_PUBLIC_BASE_RPC_URL`) | Identidade do token e saldos        | Público                                   | Limitado; produção precisa de RPC dedicado                             | Uma chamada Multicall3 `aggregate3` por token                                                      |
| Blockscout (`base.blockscout.com`)                             | Não usado                           | —                                         | —                                                                      | Respondeu 403 (desafio do Cloudflare) nas três execuções                                           |
| BaseScan                                                       | Só links de explorador              | —                                         | —                                                                      | Nenhum dado é lido de lá                                                                           |

**Decisão:** opção A, APIs públicas chamadas pelo navegador.

- **Por quê:** funciona no GitHub Pages estático, não expõe segredo e não gera custo. As duas APIs enviam `Access-Control-Allow-Origin: *`, o que as execuções do workflow confirmaram.
- **Alternativas descartadas por enquanto:**
  - Proxy próprio com cache, como um Cloudflare Worker: exige infraestrutura e autorização de custo.
  - CoinGecko Pro: exige uma chave que não pode ir para o bundle do navegador.
  - Blockscout: respondeu 403.
- **O fallback é transparente:** o RETRY só usa o DEX Screener quando o GeckoTerminal falha ou não tem pool elegível, e então a linha de fonte diz "(fallback)". Velas e trades só existem no GeckoTerminal. Quando ele falha, o gráfico e a atividade dizem que estão indisponíveis, em vez de mostrar outra coisa.

**Termos de uso (lidos em 28/10/2026):**

- GeckoTerminal: a [página de suporte da CoinGecko](https://support.coingecko.com/hc/en-us/articles/22612838274841-Does-GeckoTerminal-have-an-API) diz que a API "is in Beta release", com limite de 30 chamadas/min no plano gratuito. Nas páginas lidas não há termos de uso, regra de atribuição nem regra de uso comercial.
- DEX Screener: os [API Terms & Conditions](https://docs.dexscreener.com/api/api-terms-and-conditions) (atualizados em 18/08/2023) permitem uso comercial e não comercial, mas a licença é revogável. Eles proíbem tornar os serviços da API "available for third parties" e produtos que concorram diretamente com o DEX Screener, e podem mudar a API sem aviso.

Esses pontos precisam de revisão antes de um lançamento em produção (seção 20).

## 8. Arquitetura Implementada

```text
src/config/featured-assets.ts   tokens rastreados: endereço, relação, pool configurada, verificação
src/lib/market/
  decimal.ts            decimais exatos (bigint escalado): parse, multiplicação, comparação
  types.ts              TokenRef, PoolMarket, CandleSeries, TradeList, Provenance
  validate.ts           validadores de JSON, campo a campo; rótulos sem caracteres de controle/bidi
  http.ts               allowlist de hosts, timeout de 10 s, erros tipados
  errors.ts             MarketDataError (RATE_LIMITED, HTTP_ERROR, TIMEOUT, NETWORK, INVALID_RESPONSE…)
  networks.ts           Base 8453: IDs dos provedores, ETH/WETH/USDC, URLs do explorador
  providers/            adaptadores GeckoTerminal e DEX Screener (únicos que conhecem o JSON de cada um)
  pool-selection.ts     política de pool primária
  market-service.ts     primária → fallback, com registro das falhas
  onchain.ts            identidade on-chain (Multicall3 aggregate3 + fábrica B20)
  metrics.ts            FDV exato, valor de saldo, frescor live/stale
  token-search.ts       busca por nome, ticker ou endereço e ordenação
src/hooks/use-market.ts         consultas TanStack Query (chaves com chain, token, pool e intervalo)
src/components/market/          token em destaque, página do token, gráfico, busca por endereço, primitivas
```

- **Proveniência:** todo valor normalizado carrega `source`, `chainId`, `token`, `poolId`, `retrievedAt` e, quando o provedor informa, `observedAt`. A UI mostra fonte, horário em UTC, idade e o selo **Live** ou **Stale**. Um dado é "stale" depois de duas vezes o intervalo de atualização, ou quando a última atualização falhou.
- **Números:** preço, liquidez, volume e FDV são strings decimais exatas. O `Intl.NumberFormat` recebe a string, sem passar por float. As velas usam `number` só porque o gráfico desenha números. A variação percentual também é `number`, porque só serve para exibição.
- **Falhas:**
  - 429 vira `RATE_LIMITED`, com `Retry-After` lido, e não é repetido.
  - Timeout, erro de rede e 5xx são repetidos uma vez.
  - JSON malformado ou sem o formato esperado vira `INVALID_RESPONSE`. Uma série de velas com mais da metade das linhas inválidas é rejeitada inteira.
  - Falha do RPC (`RPC_FAILED`) é diferente de "sem contrato" ou "não é ERC-20".
- **Atualização:**
  - Pools e trades a cada 60 s; velas de 60 s (5m) a 10 min (4h, 1d). Tudo pausa em aba em segundo plano.
  - Uma página de token faz cerca de 3 requisições por minuto ao GeckoTerminal, bem abaixo do limite.
  - A identidade on-chain fica em cache por 5 min.
- **Entrada do usuário:** a única entrada que vira requisição é um endereço, validado com `isAddress`/`getAddress` do viem. Os caminhos das APIs são montados só com endereço e ID de pool validados. O cliente HTTP recusa caminhos que não começam com `/` ou que começam com `//`, e nenhuma URL fornecida pelo usuário é buscada.

## 9. Gráficos Reais

| Intervalo | Pedido ao GeckoTerminal           | Janela  |
| --------- | --------------------------------- | ------- |
| 5m        | `minute`, aggregate 5, 288 velas  | 24 h    |
| 15m       | `minute`, aggregate 15, 288 velas | 3 dias  |
| 1h        | `hour`, aggregate 1, 168 velas    | 7 dias  |
| 4h        | `hour`, aggregate 4, 180 velas    | 30 dias |
| 1d        | `day`, aggregate 1, 365 velas     | 1 ano   |

- O pedido usa `currency=usd&token=<endereço>`, e a resposta só é aceita se `meta.base` for o token rastreado. Assim o gráfico nunca mostra o preço do outro lado do par.
- **Normalização** (`normalizeCandles`):
  - descarta linha com timestamp inválido, anterior a 2023 ou fora do alinhamento do intervalo;
  - descarta preço negativo ou zero, high abaixo de open ou close, low acima de open ou close, e volume negativo;
  - remove duplicadas (vale a versão mais nova) e ordena da mais antiga para a mais nova.
- **Lacunas:** um intervalo sem negociação fica vazio. O gráfico insere linhas vazias, o modo linha usa `connectNulls={false}` e a linha de fonte informa quantos intervalos ficaram sem trades. Não há interpolação nem preenchimento com o último preço.
- **Exibição:** velas ou linha, barras de volume, tooltip com O/H/L/C/Vol formatados com 4 dígitos significativos, horários em UTC, sem animação. O Recharts é carregado sob demanda.
- **Evidência ao vivo** (pool primária, pedidos de até 300 velas):
  - Run [40624224187](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40624224187): 5m com 300 velas, 15m com 300, 4h com 222 e 1d com 62, desde 15/08/2026, com preço inicial de $0,00000435. O 1h recebeu 429 mesmo depois de uma nova tentativa, por causa do IP compartilhado do runner.
  - Run [40629723131](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40629723131): os cinco intervalos responderam 200. 5m e 15m vieram com 300 velas, 1h com 155 (depois de uma nova tentativa após 429), 4h com 222 e 1d com 62. Os trades recentes também vieram (300, o mais novo no bloco 53.185.356, às 04:00:59 UTC).
  - No app, um 429 mostra "Price history is unavailable" com o botão "Try again".

## 10. Homepage e Discover

- A faixa de dados mostra **"Real Base data · Read-only"**, no lugar de "Demo Data".
- **Token em destaque:** nome e símbolo lidos do RPC, selo B20, preço, variação de 24 h, volume e liquidez da pool primária, FDV calculado e **Market cap: Unavailable** ("Circulating supply is not verified"). Tem um botão "Open market" e uma linha com fonte, pool, horário e frescor. O subtítulo deixa claro: "Tracked on RETRY · not a RETRY launch".
- **Colunas:**
  - "Tracked on Base" mostra o token rastreado, com preço, volume, variação e liquidez reais.
  - "New on RETRY" e "Graduated" mostram estados vazios honestos ("No RETRY launches yet", "Nothing has graduated yet").
- **Busca** por nome, ticker (com ou sem `$`) ou endereço, completo ou por prefixo de pelo menos 4 caracteres. Um endereço completo que a RETRY não rastreia gera o card **"Not tracked on RETRY"**, que leva a `/token/?address=0x…`.
- **Ordenação** por liquidez ou volume de 24 h, com valores ausentes no fim. Filtro de liquidez mínima.
- **Marca do token:** monograma gerado a partir do símbolo verificado. Logos de terceiros não são carregados, porque a procedência não foi verificada e a requisição exporia o IP do visitante.

## 11. Token Detail

- `/token/base/<endereço>/` é gerada no build para cada token de `TRACKED_ASSETS`, com `dynamicParams = false`. Rotas desconhecidas dão 404 de verdade.
- As URLs antigas da demo (`/token/orbit/` e parecidas) deixaram de existir, porque eram páginas de tokens que nunca existiram. Os links internos apontam para as rotas novas, e as demais rotas (`/`, `/create/`, `/portfolio/`) continuam iguais.
- **Cabeçalho:** nome e símbolo do RPC, selo "Tracked on RETRY · External token", "Base mainnet · Chain 8453", selo "B20 · Asset", botão de copiar endereço e link do BaseScan. Se os metadados on-chain mudarem em relação ao snapshot verificado, aparece um aviso.
- **Estatísticas:** preço em USD com a variação de 24 h, preço em ETH, volume de 24 h da pool, liquidez da pool, **FDV · calculated** (supply on-chain × preço da pool primária) e **Market cap: Unavailable**. Abaixo, a faixa de variações (5m, 1h, 6h, 24h), compras e vendas em 24 h e holders "Unavailable".
- **Gráfico:** seção 9.
- **Market activity:** os trades de todos os participantes na pool primária, rotulados "All traders · primary pool · not your wallet". Mostra tipo, quantidade, preço, valor, trader e tempo, com links para a transação e o endereço no BaseScan. Trades marcados como anômalos pelo provedor ficam ocultos e contados.
- **Pools:** elegíveis com o selo "Primary", motivo da escolha e resumo das exclusões.
- **Trade:** compra mostra o saldo de ETH; venda mostra o saldo do token via `balanceOf`. Quote "Not available", Route "None verified", Network fee "Not estimated", Execution "Disabled" e o botão "Trading Coming Soon".
- **About:** rede, padrão, bytecode (precompile `0xef`), decimais e supply. Bonding curve e graduação aparecem como "Not applicable" e holders como "Not indexed". Há um aviso sobre os controles de emissor do B20.
- **Busca por endereço** (`/token/?address=0x…`): qualquer contrato da Base. Endereço sem código gera "No contract at this address on Base"; contrato sem ERC-20 gera "This contract is not an ERC-20 token"; RPC de outra rede gera um diagnóstico. Dados de mercado só aparecem depois que o contrato responde como token.

## 12. Portfolio e Activity

- A aba **Tracked tokens** mostra o saldo da carteira conectada em cada token rastreado, lido com `balanceOf` na Base mainnet, seja qual for a rede da carteira. O valor aparece como "≈ $X at the pool price", rotulado como derivado do preço da pool. Não há PnL porque não existe custo de aquisição conhecido. Se a leitura falhar, aparece "Unavailable" e nenhum saldo é presumido.
- Outros tokens da carteira não são indexados, e a página diz isso.
- A aba **Activity** diz que o histórico da carteira não é indexado e aponta para a atividade de mercado de cada token, que é de todos os participantes e não da carteira.

## 13. Hosting e GitHub Pages

- O `build:pages` gera `/`, `/create/`, `/portfolio/`, `/token/`, `/token/base/0xb200000000000000000000585fd80c20af698f01/`, `/404/` e `.nojekyll`, tudo sob `/launchpadlendaria`.
- Os dados de mercado são buscados pelo navegador do visitante, então o HTML exportado não contém preço (verificado no `out/`).
- Não há API routes, servidor nem segredo. Nenhuma variável `NEXT_PUBLIC_` nova foi criada.
- Esta etapa não alterou o `pages.yml`. Desde o merge da PR #2 (28/10/2026, 12:37 UTC), ele publica o site só a partir da `main`. Os pushes desta branch não publicam nada, e o merge desta PR na `main` publica a Etapa 4 no site.
- **Preview:** com a aprovação de Iam, a Etapa 4 foi juntada na branch temporária `feat/retry-integrated-preview` (`60d6bb6`, merge normal e sem conflitos) e publicada em 28/10/2026 às 04:22 UTC, depois de passar por lint, typecheck, testes, build e testes de navegador na combinação. Às 12:39 UTC, a publicação da `main` substituiu esse preview. A branch temporária não deve receber push nem disparo manual, porque isso sobrescreveria o site da `main`.
- **Risco:** se um provedor mudar a política de CORS ou os limites, os números afetados passam a mostrar "Unavailable". Nesse caso seria preciso um cache próprio no servidor (seção 20).

## 14. Arquivos Criados e Modificados

**Criados (34):**

- **Verificação:**
  - `scripts/verify-market-data.mjs`
  - `.github/workflows/market-data-verify.yml`
- **Configuração:**
  - `src/config/featured-assets.ts`
- **Camada de mercado:**
  - `src/lib/market/decimal.ts`, `errors.ts`, `http.ts`, `market-service.ts`
  - `metrics.ts`, `networks.ts`, `onchain.ts`, `pool-selection.ts`
  - `token-search.ts`, `types.ts`, `validate.ts`
  - `providers/geckoterminal.ts`, `providers/dexscreener.ts`
- **Hooks:**
  - `src/hooks/use-market.ts`
- **UI:**
  - `src/components/market/candle-chart.tsx`, `featured-token.tsx`, `pool-label.ts`
  - `primitives.tsx`, `token-lookup.tsx`, `token-terminal.tsx`
  - `src/components/portfolio/tracked-balances.tsx`
- **Rotas:**
  - `src/app/token/[chain]/[address]/page.tsx`
  - `src/app/token/page.tsx`
- **Testes:**
  - `tests/market-math.test.ts`, `market-providers.test.ts`, `market-onchain.test.ts`
  - `token-search.test.ts`, `no-mock-leakage.test.ts`
  - `tests/fixtures/market-responses.ts`, `tests/fixtures/demo-market.ts`
- **Relatório:**
  - este arquivo

**Modificados (20):**

- **App:**
  - `src/app/globals.css`: estilos de mercado, ajustes para celular e remoção de regras mortas da demo
  - `src/app/layout.tsx`, `src/app/page.tsx`
- **Componentes:**
  - `src/components/discover/discover.tsx`, `discover-from-url.tsx`
  - `src/components/tokens/token-card.tsx`
  - `src/components/trade/trade-panel.tsx`
  - `src/components/portfolio/portfolio.tsx`
  - `src/components/layout/header.tsx`, `shell.tsx`
  - `src/components/ui/feedback.tsx`
  - `src/lib/format.ts`
- **Testes:**
  - `tests/integration/app-wallet.test.tsx`
  - `e2e/fixtures.ts`, `e2e/app-wallet.spec.ts`
- **Outros:**
  - `.gitignore`
  - `README.md`, `docs/ARCHITECTURE.md`, `docs/PREVIEW.md`, `docs/integration/GITHUB_PAGES.md`

**Removidos ou movidos (7):**

- `src/data/tokens.ts`, `src/services/token-provider.ts`, `src/types/token.ts`
- `src/components/trade/terminal.tsx`, `src/components/trade/price-chart.tsx`
- `src/app/token/[id]/page.tsx`
- `tests/token-provider.test.ts`, que virou `tests/demo-fixture.test.ts`

## 15. Dependências e Variáveis de Ambiente

- **Dependências:** nenhuma nova. `package.json`, `pnpm-lock.yaml` e `pnpm-workspace.yaml` não mudaram. A camada de mercado usa só o que já existia: viem, wagmi, TanStack Query e Recharts.
- **Variáveis de ambiente:** nenhuma nova e nenhuma chave de API. A leitura da Base mainnet usa o transporte que o `@retry/web3` já configurava (`NEXT_PUBLIC_BASE_RPC_URL`, por padrão `https://mainnet.base.org`), também quando a rede padrão da carteira é Base Sepolia.
- **Node:** 24 (24.22.1 nesta sessão) e pnpm 11.25.0.

## 16. Testes

| Comando                                                                            | Resultado                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                                                   | Passou no CI; o lockfile não mudou                                                   |
| `pnpm format:check`                                                                | Passou                                                                               |
| `pnpm lint` (`--max-warnings 0`)                                                   | Passou, 0 avisos                                                                     |
| `pnpm typecheck`                                                                   | Passou                                                                               |
| `pnpm test` (Vitest)                                                               | **10 arquivos, 80 testes, todos passando**                                           |
| `pnpm build`                                                                       | Passou; `/token/base/0xb200…8f01` gerada como SSG                                    |
| `NEXT_PUBLIC_BASE_PATH=/launchpadlendaria pnpm build:pages`                        | Passou; rotas da seção 13 exportadas                                                 |
| `pnpm test:e2e` (Playwright, Chromium)                                             | **34 de 34 passando** (17 cenários × desktop Chrome e Pixel 7), em cerca de 1 minuto |
| Cada commit intermediário                                                          | `tsc --noEmit` e Vitest passando em `a46f942`, `17742e7` e `efa129f`                 |
| `pnpm --filter @retry/web3 check` (módulo da carteira, sem alterações nesta etapa) | Passou: typecheck, Biome (61 arquivos), **12 arquivos e 126 testes** Vitest e build  |
| `pnpm --filter retry-web3-playground exec playwright test` (bancada Web3)          | Passou: **22 de 22** (11 cenários × desktop e celular)                               |

Testes Vitest por arquivo:

- **Novos (56):**
  - `market-providers` (25): adaptadores, IDs malformados, formato inválido, série do lado errado do par, mapeamento de intervalos, trades orientados e anômalos ocultos, DEX Screener, política de pools contra o impostor, pool configurada ausente, rede errada, 429 com `Retry-After`, JSON malformado, timeout, falha de rede e allowlist, fallback e falha total.
  - `market-math` (12): decimais exatos, FDV, frescor, formatação, normalização de velas e lacunas.
  - `market-onchain` (9): B20 com metadados, sem código, não ERC-20, rede errada, decimais fora do intervalo, rótulos com caracteres de controle, falha do RPC e endereço inválido.
  - `no-mock-leakage` (5).
  - `token-search` (5).
- **Existentes (24):** `demo-fixture` (10), `validation` (7), `asset-path` (3), `format` (2) e a integração da carteira em jsdom (2), que agora também confere que a página do token mostra dados de mercado e nenhum dado da demo.

Cenários Playwright novos ou alterados:

- token em destaque com valores reais, FDV e market cap indisponível;
- busca por nome, ticker, prefixo e endereço, com o diagnóstico de endereço sem contrato;
- Token Detail completo, com estatísticas, troca de intervalo, lacunas, atividade, pools, trade desligado, leituras só de `eth_chainId`/`eth_getCode`/`eth_call` na mainnet e ordem do layout no celular;
- fallback para o DEX Screener quando o GeckoTerminal responde 429;
- falha total dos provedores, sem nenhum preço, seguida de recuperação com "Try again";
- saldo do token rastreado no Portfolio e no painel de venda.

Os testes usam respostas gravadas dos provedores (`tests/fixtures/market-responses.ts`, copiadas das execuções do workflow), RPC simulado e carteira EIP-6963 simulada. O e2e bloqueia qualquer host fora da allowlist.

**Não testado nesta sessão:** a interface contra as APIs ao vivo num navegador real, porque o container não tem rede para a Base nem para os provedores (as respostas ao vivo foram verificadas pelo workflow, mas não renderizadas), e carteiras reais.

**Não se aplica:** credenciais de API ausentes, porque nenhum provedor usado exige chave. Não houve falhas preexistentes nem regressões nos comandos acima.

## 17. Segurança

- **Somente leitura:** nenhum `writeContract`, `sendTransaction`, assinatura, approve, permit ou transferência. O e2e confere que a carteira não recebeu nenhuma chamada de `sign`, `send` ou `approve`. `financialActionsEnabled` continua `false`.
- **Rede:**
  - Requisições de mercado só para `api.geckoterminal.com` e `api.dexscreener.com`, com timeout.
  - Nenhuma URL vinda do usuário é buscada; a única entrada usada em requisição é um endereço validado.
  - Links externos usam `rel="noopener noreferrer"`.
- **Dados não confiáveis:**
  - Toda resposta é validada campo a campo.
  - Nomes e símbolos, do provedor ou do contrato, passam por `asLabel`, que remove caracteres de controle, zero-width e overrides bidi (Trojan Source), e têm tamanho limitado.
  - Hashes e IDs são validados antes de virarem links. O React escapa todo o texto e não há `dangerouslySetInnerHTML`.
- **Identidade:**
  - O token é sempre identificado por chain + endereço.
  - Pools do token impostor nunca são elegíveis.
  - O RPC precisa responder com o chain ID esperado.
  - Metadados on-chain que mudarem geram aviso.
- **Métricas:** FDV nunca é apresentado como market cap. Market cap fica indisponível enquanto o supply circulante não for verificado.
- **Privacidade:** nenhum logo ou imagem de terceiros é carregado.
- **Segredos:** nenhum; o bundle só tem as variáveis públicas que já existiam.
- **Código-fonte:** a revisão encontrou caracteres bidi invisíveis escritos literalmente numa regex nova. Eles foram trocados por escapes `\u…`, e o repositório foi varrido sem outras ocorrências.

## 18. Problemas Encontrados

1. **Sem rede no container.** Base RPC, GeckoTerminal, DEX Screener e o download de artefatos do GitHub estavam bloqueados. Solução: um workflow somente leitura, com os logs lidos pela API do GitHub.
2. **A primeira sondagem de OHLCV escolheu a pool do impostor**, porque ordenava por reservas, e depois levou 429. Solução: só pools com cotação ETH/WETH/USDC, chamadas espaçadas e uma nova tentativa depois do 429. A mesma lição virou a política de pools do app.
3. **429 no OHLCV de 1h** no IP compartilhado do runner. Na execução seguinte, o 1h respondeu depois de uma nova tentativa. O app trata o 429 como indisponível, sem dado substituto.
4. **B20 com código `0xef`.** Um teste de "tem bytecode" seria enganoso. A identidade usa a fábrica B20 e as leituras ERC-20.
5. **O `multicall` do viem com `allowFailure`** transformava falha do RPC em "não é ERC-20". Solução: uma chamada `aggregate3` direta, em que erro do RPC vira `RPC_FAILED`.
6. **Market cap dos provedores igual ao FDV**, tanto no GeckoTerminal quanto no DEX Screener. Não é usado.
7. **Reset de CSS global** (`p { margin: 0 }` e `a { color: inherit }` fora de camada) que vence os utilitários do Tailwind 4. Os componentes novos usam classes próprias. O problema já existia em partes do Portfolio e não foi alterado.
8. **Caracteres bidi literais numa regex** (seção 17), corrigidos.
9. **Blockscout respondeu 403** e o `eth_getLogs` falhou no RPC público, então holders ficaram fora.
10. **Teste de layout no celular:** valores reais longos ("0.000000775 ETH") quebravam a grade de estatísticas. O CSS foi ajustado e revisado com capturas de tela no desktop e no Pixel 7.

## 19. GitHub

- **Branch:** `feat/retry-real-market-data`, a partir de `f18d017`. Nenhum push na PR #2, nenhum force push e nada na `main`. Depois que a PR #2 entrou na `main`, a `main` foi trazida para esta branch com um merge normal, sem conflitos.
- **Commits:**
  - `728fb88` ci(market-data): live read-only evidence for the featured Base token
  - `de71998` ci(market-data): probe OHLCV on an eligible pool and respect the rate limit
  - `a46f942` feat(market): validated Base market data layer with provenance
  - `17742e7` feat(chart): OHLCV candles with real gaps and exact price formatting
  - `efa129f` feat(ui): real Base market data on Discover, Token Detail and Portfolio
  - `9bad240` refactor(demo): move the fictional catalogue into test fixtures
  - `5ffba2e` docs: describe the real market data flow and its hosting limits
  - `b1c6e95` docs(report): Stage 4 real market data report (pt-BR)
  - `8814e4b` docs(report): Web3 module results, explorer check and final status
  - `5ef1e04` merge: main @ bff482a (PR #2 merged) into Stage 4
  - um commit final que atualiza este relatório e o `docs/PREVIEW.md` para o fluxo novo do Pages
- **Pull request:** [#3](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/3), em Draft, sem auto-merge, atribuída a CapotaVelha.
  - O pedido de revisão para CapotaVelha foi recusado pelo GitHub, porque a sessão publica como CapotaVelha, que é o autor da PR.
  - A base era `feat/retry-frontend-web3-integration`, para o diff mostrar só a Etapa 4. A PR #2 entrou na `main` em 28/10/2026 (`bff482a`), e esta PR passou a apontar para a `main`.
- **GitHub Actions** (CI = `RETRY quality checks`: formatação, lint, typecheck, Vitest, builds e Playwright):
  - `728fb88`: CI e workflow de verificação passaram ([40623949696](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40623949696), [40623949754](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40623949754)).
  - `de71998`: os dois passaram ([40624224204](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40624224204), [40624224187](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40624224187)).
  - `5ffba2e`, a primeira versão com todo o código da Etapa 4, passou em tudo:
    - CI no push ([40629723139](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40629723139)): os jobs `validate` e "Browser tests (static export, desktop and mobile)" passaram.
    - CI na PR ([40629769840](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40629769840)): passou.
    - Nova verificação ao vivo ([40629723131](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40629723131), de 03:59 a 04:01 UTC): passou. Os detalhes estão na seção 9.
  - `b1c6e95` e `8814e4b`, só de documentação, também passaram no push e na PR. O CI do merge com a `main` aparece na PR #3.
- **GitHub Pages:** o preview com a Etapa 4 saiu da branch temporária (`60d6bb6`, publicado em 28/10/2026 às 04:22 UTC) e foi substituído às 12:39 UTC pelo site da `main` (seção 13).

## 20. Pendências (Critical/High/Medium/Low)

**Critical**

- Nenhuma para um preview somente leitura.

**High**

1. Revisar os termos dos provedores antes de produção. A cláusula do DEX Screener sobre disponibilizar a API "for third parties" é ambígua para um app web. A API do GeckoTerminal está em beta e nenhum dos dois tem SLA. Para tráfego real, avaliar um plano pago ou um cache próprio no servidor, o que exige autorização de infraestrutura e custo.
2. Merge desta PR na `main`, o que publica a Etapa 4 no site.
3. Teste manual num navegador real, no desktop e no celular, contra as APIs ao vivo: CORS, limites e tempos reais.

**Medium**

4. Holders e supply circulante não são indexados. Market cap continua indisponível até haver um indexador ou outra fonte verificável.
5. Os papéis de emissor do B20 deste token (mint, pausa, políticas) não foram revisados.
6. O `contractURI` (IPFS) não foi carregado nem verificado. Por isso não há logo, site nem redes sociais.
7. Só a primeira página de pools do GeckoTerminal (20) é lida. Basta para a pool primária, mas a lista não é exaustiva.
8. IPs compartilhados podem levar 429. O app mostra "Unavailable" e tenta de novo no próximo intervalo.
9. O RPC público da Base tem limites; produção precisa de um RPC dedicado.

**Low**

10. A arte demo em `public/tokens/` não é mais usada (decidir se apaga).
11. O placeholder "e.g. Orbit Cat" no Create.
12. O reset de CSS global anula utilitários Tailwind em `p` e `a`, o que afeta espaçamentos antigos do Portfolio.
13. Nos tokens só há monograma, até existir uma fonte de logo verificada.

## 21. Próximos Passos

1. Iam revisa esta PR e faz o merge na `main`. O merge publica a Etapa 4 no site, porque o `pages.yml` da `main` publica a cada push.
2. Com o site publicado, conferir no desktop e no celular a página do token, o gráfico em cada intervalo, a busca por endereço e o saldo no Portfolio com uma carteira real.
3. Revisar os termos do GeckoTerminal e do DEX Screener e decidir entre manter as APIs públicas, contratar um plano ou criar um cache próprio.
4. Depois do merge, apagar a branch temporária `feat/retry-integrated-preview`, com a aprovação de Iam, como prevê `docs/integration/GITHUB_PAGES.md`.
5. Planejar um indexador (holders, supply circulante, eventos da futura fábrica RETRY) antes de mostrar market cap ou tokens lançados na RETRY.
6. A Etapa 5 (contratos da fábrica, curva e graduação) continua separada, com especificação e auditoria próprias.
7. Trading de verdade só depois dos contratos auditados e de uma rota verificada: cotação vinda da rota real, simulação antes do envio e confirmação explícita na carteira. Até lá, o painel continua sem execução.

## 22. Conclusão

O RETRY agora mostra o mercado real de um token verificado na Base, com proveniência em cada número, uma política de pools que resiste ao token impostor, gráficos reais com lacunas preservadas e falhas de provedor visíveis, sem dado substituto. O catálogo fictício saiu do app e um teste impede que volte. Trading, carteira custodial e qualquer escrita on-chain continuam fora. A branch está publicada com a Draft PR #3, que aponta para a `main`; o merge dela publica a Etapa 4 no site.

**Situação:** a Etapa 4 está concluída no escopo pedido. Os 27 critérios de aceite têm evidência e nenhum ficou bloqueado. Falta registrar uma validação: ver a interface contra as APIs ao vivo num navegador real, no site, depois do merge desta PR.
