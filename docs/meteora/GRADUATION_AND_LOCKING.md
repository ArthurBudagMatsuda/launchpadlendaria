# Graduação e travamento de liquidez

Código: `src/lib/meteora/graduation.ts`, `src/lib/meteora/pools.ts` (status) e `src/components/launch/graduation-panel.tsx`.

## Estados de um lançamento

Calculados apenas do estado on-chain da pool (`VirtualPool`) e da config:

| Status             | Condição                                                      | Na tela                                                     |
| ------------------ | ------------------------------------------------------------- | ----------------------------------------------------------- |
| `active`           | reserva de SOL abaixo de 80% do threshold                     | "On the curve" (seção New do Discover)                      |
| `near-graduation`  | ≥ 80% do threshold                                            | "Graduating soon" (seção Graduating)                        |
| `graduation-ready` | reserva ≥ threshold e `migrationProgress = LockedVesting (2)` | "Ready to graduate"                                         |
| `migrating`        | `migrationProgress` em transição                              | "Graduating"                                                |
| `graduated`        | `isMigrated = 1`                                              | "Graduated" (seção Graduated), com link para a pool DAMM v2 |
| `needs-attention`  | combinação inesperada                                         | "Check status"                                              |

O progresso é `quoteReserve / migrationQuoteThreshold` em basis points. O painel mostra o SOL que falta, o threshold de 10 SOL e a pool DAMM v2 de destino (derivada da config pública FixedBps100, do mint e do WSOL).

## Como a curva completa

A compra que alcança o threshold é feita com `PartialFill`: o programa usa só o SOL necessário e devolve o resto na mesma transação. A partir daí o DBC recusa novas compras e vendas (erro `PoolIsCompleted`) e a tela troca a negociação pelo painel de graduação. Sem vesting configurado, o próprio swap que completa a curva deixa `migrationProgress = 2`, que é o estado que `migration_damm_v2` exige.

## Migração para DAMM v2

- **Mainnet**: o keeper da Meteora migra automaticamente as pools em SOL com threshold de pelo menos 10 SOL. Por isso o threshold RETRY é 10 SOL.
- **Devnet**: não há keeper. O painel mostra um botão de migração manual. A instrução `migration_damm_v2` é permissionless: qualquer carteira pode enviá-la e paga só a taxa de rede e o aluguel das contas novas. As posições de LP não ficam com quem paga.
- `prepareMigration` confere que a curva completou, que a config DAMM v2 existe e pertence ao programa cp-amm, e que a pool authority do DBC tem SOL (ver abaixo). Depois usa `client.migration.migrateToDammV2` do SDK. A allowlist só aceita a instrução `migration_damm_v2` com a pool, a config, a pool authority, a pool DAMM v2 derivada, os mints, os cofres e o pagador esperados. Os dois mints de NFT de posição são gerados no navegador e assinam a transação.

### O "aluguel emprestado" (achado real nos testes)

O programa DBC cria as contas do DAMM v2 usando a **pool authority do DBC** (`FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM`) como pagadora e cobra o mesmo valor de volta do pagador da transação dentro da mesma instrução (`flash_rent`, no código-fonte do DBC: "Someone have to fund 1 SOL for pool authority for flash rent"). Ou seja, essa conta precisa ter SOL no cluster. A Meteora mantém esse saldo; a RETRY não controla nem deposita nada nela.

No primeiro teste com os programas clonados, a pool authority tinha 0 SOL no validador local e a migração falhou na simulação com `Transfer: insufficient lamports 0, need 2770080`, tanto com os binários de Devnet quanto com os de Mainnet. A correção foi:

1. o validador de testes passa a clonar também a conta da pool authority do cluster (com o saldo real dela);
2. `prepareMigration` recusa antes de pedir assinatura, com mensagem clara, se a pool authority estiver sem SOL;
3. o workflow registra o saldo dessa conta em Devnet e Mainnet a cada execução (linhas `POOL_AUTHORITY_SOL`).

## Travamento da liquidez

Config RETRY: 50% da liquidez graduada para o parceiro e 50% para o criador, **as duas partes 100% travadas para sempre** (`permanentLockedLiquidityPercentage`), 0% livre, sem vesting.

Na migração o DBC chama `permanent_lock_position` do DAMM v2 para cada posição e depois passa a NFT da posição para o parceiro (fee claimer da config) e para o criador. Quem tem a NFT pode coletar as taxas de LP da pool graduada (1%), mas **não pode retirar a liquidez**.

O teste on-chain (`tests/chain/meteora-flow.chain.ts`, etapa "migrates to DAMM v2") lê as duas contas `Position` do DAMM v2 depois da migração e exige:

- `unlocked_liquidity = 0` e `vested_liquidity = 0`;
- `permanent_locked_liquidity > 0`;
- uma NFT com o parceiro e outra com o criador;
- `isMigrated = 1`, status `graduated`, e a pool DAMM v2 pertencendo ao programa cp-amm.

Os resultados de cada execução estão no relatório: [RETRY_METEORA_MVP_IMPLEMENTATION_REPORT.md](../reports/RETRY_METEORA_MVP_IMPLEMENTATION_REPORT.md), seções 21 a 23.

## Recuperação

- Se a migração falhar ou expirar, a curva continua completa e qualquer pessoa pode tentar de novo. Não há fundos presos com o usuário.
- Se o saldo da pool authority estiver vazio no cluster, a migração não pode ser feita por ninguém até a Meteora repor. A tela explica isso.
- Na Mainnet, se o keeper atrasar, a migração manual continua disponível pelo mesmo botão, depois que a Mainnet for liberada.
