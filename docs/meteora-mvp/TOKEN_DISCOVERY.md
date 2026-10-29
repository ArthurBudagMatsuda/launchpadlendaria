# Discover: listagem dos lançamentos RETRY

Código: `src/lib/meteora/pools.ts` (`listRetryPools`, `validateRetryPool`, `discoverCategory`), `src/lib/meteora/naming.ts`, `src/hooks/use-retry.ts` (`useRetryLaunches`, `useRetryLaunch`), `src/components/discover/discover.tsx`, `src/components/launch/launch-card.tsx`.

## Fonte da verdade: a própria chain

Não há indexador, banco de dados ou API da RETRY. A lista é lida dos programas a cada atualização:

1. `getPoolsByConfig(config RETRY)` do SDK: `getProgramAccounts` no programa DBC, filtrado por memória pelo endereço da config do cluster. Só pools criadas a partir da config RETRY chegam aqui.
2. A config é lida e decodificada uma vez por atualização.
3. Cada pool passa por `validateRetryPool`: dona = programa DBC, config = a da RETRY, quote = WSOL, endereço = PDA canônica de (WSOL, mint, config), e `configMismatches` vazio. Pool que falha é descartada, nunca mostrada.
4. Pool migrada só conta como graduada se a pool DAMM v2 derivada existir e pertencer ao `cp_amm`.
5. Os metadados Metaplex de todos os mints são lidos em lotes de 100 (`getMultipleAccountsInfo`). Imagem e descrição vêm do JSON off-chain, conferido contra o nome e o ticker on-chain (ver [METADATA_AND_STORAGE.md](METADATA_AND_STORAGE.md)).

Um token é identificado pelo **endereço do mint**. Um token com o mesmo nome ou ticker criado fora da RETRY (outra config, outro launchpad) não aparece nas colunas RETRY. Uma pool falsa com o mesmo mint, mas de outra config, tem outro endereço e é recusada.

Página do token (`/token/?cluster=…&mint=…`): `retryPoolAddress` deriva a PDA da pool RETRY do mint; se ela existir e passar na validação, abre a página RETRY do token. Qualquer outro mint vai para a página de leitura (do PR #6), sem negociação.

## Colunas

`discoverCategory(pool, agora)` põe cada lançamento em exatamente uma coluna, só com o estado da pool:

| Coluna          | Regra                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| New on RETRY    | ativado há menos de 24 h (`NEW_LAUNCH_SECONDS`) e ainda abaixo de 80% do threshold                              |
| Active          | negociando na curva, abaixo de 80% do threshold, ativado há 24 h ou mais                                        |
| Near graduation | 80% do threshold ou mais (`NEAR_GRADUATION_BPS`), ou curva completa aguardando a migração, ou migração pendente |
| Graduated       | `isMigrated = 1` e pool DAMM v2 existente; negocia no DAMM v2                                                   |

Não há coluna "Trending": ela exigiria histórico de volume indexado, e a RETRY não indexa. A coluna "Tracked on Solana" continua mostrando os tokens externos acompanhados (`src/config/tracked-mints.ts`), só leitura.

Cada coluna mostra 12 cartões e um "Show more". A busca filtra por nome, ticker (sem diferenciar maiúsculas) ou mint exato. A ordenação pode ser por mais recente, progresso da curva ou FDV.

## O cartão

| Campo                | De onde vem                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Nome, ticker, imagem | Metaplex on-chain e JSON conferido; sem metadados, o mint encurtado                      |
| Preço e FDV          | `sqrtPrice` da pool × supply fixo. FDV, não market cap                                   |
| Progresso            | reserva de SOL da curva ÷ threshold de 10 SOL                                            |
| Graduado             | "Price at graduation", "FDV at graduation" (preço final da curva) e "Trades on DAMM v2"  |
| Regras de nome       | aviso quando o lançamento passou do limite, e quantos lançamentos RETRY dividem o ticker |

## Atualização e custo de RPC

- Lista: a cada 20 s (`LAUNCHES_REFRESH_MS`), considerada fresca por 10 s.
- Página do token: a pool a cada 10 s (`POOL_REFRESH_MS`).
- Por atualização da lista: 1 `getProgramAccounts`, 1 leitura da config, 1 `getSlot`, uma leitura em lote de metadados por 100 mints, e uma leitura por pool migrada (existência da pool DAMM v2).

Limite conhecido: `getProgramAccounts` devolve todas as pools da config de uma vez. Com poucas centenas de lançamentos isso cabe num RPC público; com muitos milhares será preciso um RPC com índice ou um indexador. Os RPCs públicos também limitam requisições por IP (o smoke público da Devnet do PR #8 encontrou HTTP 429 e passou a espaçar leituras nos testes).

## Regras de nome e ticker (seção 12)

`src/lib/meteora/naming.ts`:

- no máximo 2 lançamentos RETRY por nome (`MAX_LAUNCHES_PER_NAME`);
- no máximo 2 por ticker (`MAX_LAUNCHES_PER_TICKER`);
- o mesmo criador não lança o mesmo par nome + ticker duas vezes.

Nomes são comparados com normalização NFKC, espaços colapsados e sem diferenciar maiúsculas; tickers com NFKC e em maiúsculas. A contagem é por cluster e só considera lançamentos RETRY.

### O que é garantido e por quem

| Controle                                       | Tipo                  | Quem garante                                           | O que não garante                                                                                                    |
| ---------------------------------------------- | --------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Tela Create recusa nome/ticker acima do limite | controle de interface | o app (`namingCheck`), com a lista on-chain atual      | quem chama o programa DBC direto com a config RETRY passa por cima; dois lançamentos simultâneos podem passar juntos |
| Discover marca o lançamento fora da regra      | regra de plataforma   | o app (`namingFlags`), do mais antigo para o mais novo | o lançamento continua existindo e negociável on-chain; a marca é informativa                                         |
| Backend                                        | não existe            | —                                                      | o Worker de metadados não confere nomes                                                                              |
| Identidade do token                            | garantia on-chain     | o endereço do mint e a PDA da pool                     | nada sobre nomes: nomes e tickers SPL não são únicos na Solana                                                       |
| Exclusividade global de ticker                 | **não existe**        | ninguém                                                | a RETRY não pode impedir o mesmo ticker em outro launchpad ou fora da RETRY, e não afirma isso                       |

Os primeiros dois lançamentos de um nome ou ticker ficam dentro da regra; os seguintes recebem a marca vermelha. Lançamentos sem metadados legíveis não entram na contagem.

## Testes

| Teste                                                                                                                                           | Nível                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `tests/meteora-naming.test.ts`: limites, repetição pelo mesmo criador, marcas do mais antigo para o mais novo, contagem de ticker compartilhado | unitário                                                                |
| `tests/meteora-damm.test.ts` "Discover columns from pool state": cada lançamento em exatamente uma coluna                                       | unitário                                                                |
| `tests/chain/meteora-flow.chain.ts` "lists the launch from the DBC program accounts, filtered by the RETRY config"                              | programas reais no validador; também no smoke público da Devnet (PR #8) |
| `e2e/solana-app.spec.ts` "preserved discovery, empty featured section, navigation and responsive layout"                                        | navegador, RPC simulado, desktop e mobile                               |
