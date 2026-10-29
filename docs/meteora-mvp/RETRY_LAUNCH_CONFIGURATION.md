# Configuração DBC da RETRY

Fonte: `src/lib/meteora/curve.ts` (`RETRY_LAUNCH` e `retryCurveParams()`), construída com `buildCurve` do SDK oficial `@meteora-ag/dynamic-bonding-curve-sdk@2.0.0` (programa DBC 0.2.2). A config está **registrada na Devnet** (abaixo) e **não foi aprovada para a Mainnet**: os parâmetros que uma liberação usaria estão na folha [MAINNET_APPROVAL.md](MAINNET_APPROVAL.md), gerada do código.

## Programas usados

| Programa                                 | Endereço                                       | Observação                                       |
| ---------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Meteora DBC                              | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`  | mesmo endereço em Devnet e Mainnet               |
| Meteora DAMM v2 (cp-amm)                 | `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`  | destino da graduação                             |
| Meteora Locker                           | `LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn`  | usado pelo DBC em vesting; RETRY não usa vesting |
| Metaplex Token Metadata                  | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`  | metadados do token                               |
| Config DAMM v2 de migração (FixedBps100) | `Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp` | config pública da Meteora para LP de 1%          |

Os IDs são comparados com as constantes do SDK em `tests/meteora.test.ts`. O workflow `meteora-chain.yml` registra o hash dos binários do DBC, do DAMM v2 e do Locker em Devnet e Mainnet a cada execução (linhas `PROGRAM_HASH`).

## Parâmetros

| Parâmetro                            | Valor                                                     | Motivo                                                        |
| ------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------- |
| Tipo de token                        | SPL Token (não Token-2022)                                | maior compatibilidade com carteiras e DEXs; sem transfer hook |
| Supply total                         | 1.000.000.000                                             | fixo, igual para todo token RETRY                             |
| Decimals                             | 9                                                         | padrão Solana                                                 |
| Autoridade de mint                   | nenhuma após a criação                                    | sem mint ilimitado                                            |
| Autoridade de freeze                 | nenhuma                                                   | ninguém congela saldos                                        |
| Autoridade de metadados              | `Immutable` (`System Program`)                            | nome, símbolo e URI não mudam depois                          |
| Quote                                | SOL (WSOL `So11111111111111111111111111111111111111112`)  | —                                                             |
| Taxa de negociação                   | 1% fixa (`FeeSchedulerLinear` com início = fim = 100 bps) | simples de explicar; sem taxa dinâmica                        |
| Coleta de taxa                       | em SOL (`CollectFeeMode.QuoteToken`)                      | o criador recebe SOL, não o próprio token                     |
| Parte do criador                     | 50% do que sobra após a parte da Meteora                  | ver [FEES_AND_COSTS.md](FEES_AND_COSTS.md)                    |
| Taxa de criação de pool              | 0                                                         | RETRY não cobra para lançar                                   |
| Primeira compra com taxa mínima      | desligada                                                 | ninguém tem condição especial                                 |
| Threshold de graduação               | 10 SOL na curva                                           | mínimo do keeper da Meteora para pools em SOL                 |
| Supply na migração                   | 20%                                                       | vai para o DAMM v2 com o SOL arrecadado                       |
| Supply vendido na curva              | ~80%                                                      | resultado do `buildCurve`                                     |
| Destino                              | `MET_DAMM_V2`                                             | —                                                             |
| LP do DAMM v2                        | `FixedBps100` (1%)                                        | —                                                             |
| Taxa de migração do parceiro/criador | 0%                                                        | RETRY não cobra na graduação                                  |
| Liquidez travada para sempre         | 50% parceiro + 50% criador = 100%                         | ninguém pode retirar a liquidez graduada                      |
| Liquidez livre                       | 0%                                                        | —                                                             |
| Vesting / alocação do criador        | nenhuma                                                   | sem alocação escondida                                        |
| Leftover                             | 0                                                         | todo token não vendido vai para a liquidez                    |
| Ativação                             | por timestamp, imediata                                   | —                                                             |

## Números observados (validador local com os programas oficiais)

- Preço inicial ≈ 3,1 × 10⁻⁹ SOL por token, ou FDV inicial ≈ 3,1 SOL.
- Depois da primeira compra de 0,1 SOL: FDV 3,3134 SOL.
- Curva completa com 10,000000001 SOL: preço 5 × 10⁻⁸ SOL e FDV 50 SOL. Restam ~200 milhões de tokens no cofre para o DAMM v2.
- Compra de 0,5 SOL logo após o lançamento: impacto de preço de 15,58%.

O impacto alto no começo é consequência de FDV inicial pequeno com threshold de 10 SOL. Para Mainnet isso é uma decisão econômica do proprietário: o SDK também oferece `buildCurveWithMarketCap` e curvas com mais pontos, que suavizam o início. Mudar exige nova config (uma config DBC é imutável).

## Como a config é usada

1. `RETRY_DBC_CONFIGS` (`src/config/retry-protocol.ts`) guarda, por cluster, o endereço da config, o fee claimer gravado nela, a transação que a criou e o tipo do fee claimer. Devnet: `8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N`, fee claimer `DbvhT2t9yBY4nNsXZLjDhf7Aa13x3TsA83RdxQDhNAqD` (`feeClaimerKind: "ephemeral-test-key"`), criada em 29/10/2026 19:26:06 UTC pela transação `5rKrTaNc…` (slot 516519451), registrada no PR #8 (commit `4233212`). Mainnet: `null` por decisão.
2. Antes de montar qualquer transação, `configMismatches()` decodifica a config on-chain e compara 21 campos e todos os pontos da curva com o que `retryCurve()` gera. Qualquer diferença bloqueia a operação. Na criação, o fee claimer on-chain também precisa ser o registrado.
3. `listRetryPools()` usa `getProgramAccounts` no DBC com filtro de memória pelo endereço da config. Só aparecem tokens RETRY.
4. `validateRetryPool()` rejeita pools de outra config, com outro quote mint ou com mint diferente do esperado.

## Criação da config

Feita com `client.partner.createConfig2` do SDK. Nos testes (`tests/chain/meteora-flow.chain.ts`) e na config registrada da Devnet o parceiro é uma chave de teste efêmera. Isso significa que as taxas do parceiro e a posição de LP travada do parceiro dessa config ficam sem dono útil: aceitável em Devnet, inaceitável em Mainnet. A config da Devnet foi conferida com `configMismatches = []` antes do registro; o fluxo no validador clona essa mesma conta e confere de novo a cada execução do CI. Para Mainnet o `feeClaimer` e o `leftoverReceiver` precisam ser uma tesouraria (de preferência multisig, por exemplo Squads), e a config só pode ser criada depois da aprovação do proprietário.
