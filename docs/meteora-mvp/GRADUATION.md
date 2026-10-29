# Graduação para o DAMM v2

Código: `src/lib/meteora/graduation.ts`, `src/lib/meteora/pools.ts` (status e coluna do Discover), `src/lib/meteora/damm-v2.ts` (pool graduada e prova do bloqueio) e `src/components/launch/graduation-panel.tsx`.

## Estados de um lançamento

Calculados apenas do estado on-chain da pool (`VirtualPool`), da config e da existência da pool DAMM v2:

| Status             | Condição                                                      | Na tela                     |
| ------------------ | ------------------------------------------------------------- | --------------------------- |
| `active`           | reserva de SOL abaixo de 80% do threshold                     | "Bonding curve active"      |
| `near-graduation`  | ≥ 80% do threshold                                            | "Near graduation"           |
| `graduation-ready` | reserva ≥ threshold e `migrationProgress = LockedVesting (2)` | "Awaiting migration"        |
| `migrating`        | reserva ≥ threshold e `migrationProgress` em outro estado     | "Migration in progress"     |
| `graduated`        | `isMigrated = 1` e a pool DAMM v2 existe                      | "Graduated"                 |
| `needs-attention`  | `isMigrated = 1` mas a pool DAMM v2 não foi encontrada        | "Migration needs attention" |

O progresso é `quoteReserve / migrationQuoteThreshold` em basis points. O painel mostra o SOL que falta, o threshold de 10 SOL e a pool DAMM v2 de destino (derivada da config pública FixedBps100, do mint e do WSOL).

No Discover cada lançamento fica em uma coluna: **Graduated**; **Near graduation** (80% ou mais, curva completa aguardando a migração ou migração que precisa de atenção); **New on RETRY** (ativado nas últimas 24 horas); senão **Active**. Os cards graduados mostram preço e FDV na graduação e "Trades on DAMM v2". Ver [TOKEN_DISCOVERY.md](TOKEN_DISCOVERY.md).

## Como a curva completa

A compra que alcança o threshold é feita com `PartialFill`: o programa usa só o SOL necessário e devolve o resto na mesma transação. A tela avisa antes ("This buy completes the curve."). A partir daí o DBC recusa novas compras e vendas (`PoolIsCompleted`), o formulário diz "The curve is complete. Trading resumes on DAMM v2 after graduation." e o painel de graduação oferece "Graduate to DAMM v2". Sem vesting configurado, o próprio swap que completa a curva deixa `migrationProgress = 2`, que é o estado que `migration_damm_v2` exige.

## Migração para o DAMM v2

- **Mainnet**: o keeper da Meteora migra automaticamente as pools em SOL com threshold de pelo menos 10 SOL. Por isso o threshold RETRY é 10 SOL. Isso não foi testado (Mainnet travada); confirmar com a Meteora faz parte do [checklist](MAINNET_RELEASE_CHECKLIST.md).
- **Devnet**: não há keeper. O painel mostra o botão de migração manual. A instrução `migration_damm_v2` é permissionless: qualquer carteira pode enviá-la e paga só a taxa de rede e o aluguel das contas novas. As posições de LP não ficam com quem paga.
- `prepareMigration` recusa antes de montar se o recurso `graduate` estiver desligado, se o RPC for de outro cluster, se a curva não completou ou se o token já graduou ("This token already graduated."), se a config DAMM v2 não pertencer ao `cp_amm` e se a pool authority do DBC estiver sem SOL. Depois usa `client.migration.migrateToDammV2` do SDK. A allowlist só aceita a instrução `migration_damm_v2` com a pool, a config, a pool authority, a pool DAMM v2 derivada, os mints, os cofres e o pagador esperados. Os dois mints de NFT de posição são gerados no navegador e assinam a transação.
- **Segunda migração**: além da recusa da RETRY, o teste envia a migração de novo direto ao programa, sem preflight, e o DBC recusa on-chain com 6022 `NotPermitToDoThisAction`; a liquidez da pool DAMM v2 não muda.

### O "aluguel emprestado" (achado real nos testes)

O programa DBC cria as contas do DAMM v2 usando a **pool authority do DBC** (`FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM`) como pagadora e cobra o mesmo valor de volta do pagador da transação dentro da mesma instrução (`flash_rent`, no código-fonte do DBC: "Someone have to fund 1 SOL for pool authority for flash rent"). Ou seja, essa conta precisa ter SOL no cluster. A Meteora mantém esse saldo; a RETRY não controla nem deposita nada nela.

No primeiro teste com os programas clonados, a pool authority tinha 0 SOL no validador local e a migração falhou na simulação com `Transfer: insufficient lamports 0, need 2770080`, tanto com os binários de Devnet quanto com os de Mainnet. A correção foi:

1. o validador de testes passa a clonar também a conta da pool authority do cluster (com o saldo real dela);
2. `prepareMigration` recusa antes de pedir assinatura, com mensagem clara, se a pool authority estiver sem SOL;
3. o workflow registra o saldo dessa conta em Devnet e Mainnet a cada execução (linhas `POOL_AUTHORITY_SOL`).

## Continuidade de preço

`graduationPriceGap` compara o preço marginal final da curva com o preço em que a pool DAMM v2 abre (o `migrationSqrtPrice` da config, que a migração grava na pool nova). Os dois são lidos on-chain e o painel mostra "Curve ended at … (+x% to DAMM v2)". Medido: 5 × 10⁻⁸ SOL por token nos dois lados, diferença de 0%. Na migração a Meteora retém 0,2% da liquidez (constante do programa): 10,000000001 SOL na curva viram 9,98 SOL na pool DAMM v2.

## Travamento da liquidez

Config RETRY: 50% da liquidez graduada para o parceiro e 50% para o criador, **as duas partes 100% travadas para sempre** (`permanentLockedLiquidityPercentage`), 0% livre, sem vesting. Na migração o DBC chama `permanent_lock_position` do DAMM v2 para cada posição e passa as NFTs das posições para o fee claimer da config e para o criador. Quem tem a NFT coleta as taxas de LP da pool graduada (1%), mas **não pode retirar a liquidez**. O DBC arredonda a parte travada para baixo, e a sobra (1 unidade de liquidez nos testes, contra cerca de 4,1 × 10³² travadas por posição) fica destravada na posição do criador: a afirmação exata é "toda a liquidez travada para sempre, exceto 1 unidade de arredondamento".

O painel de graduação lê as posições da pool on-chain e só mostra "Lock verified on-chain" quando a prova passa. A prova, as tentativas de retirada recusadas e os limites estão em [LIQUIDITY_LOCKING.md](LIQUIDITY_LOCKING.md).

## Depois da graduação

A página do token continua a mesma: o formulário negocia contra a pool DAMM v2 do lançamento ("Graduated: trades go to this token's Meteora DAMM v2 pool"), os detentores das posições veem "Your LP fees" com o saque, e o gráfico tem as duas fontes (curva e DAMM v2). Ver [DAMM_V2_TRADING.md](DAMM_V2_TRADING.md).

## Resultado medido

No GitHub Actions, com os binários de Devnet e com os de Mainnet ([execução 40972474049](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40972474049), commit `6247354`; os mesmos valores desde a [primeira execução da etapa 3](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40769483758)):

- migração confirmada, pool DAMM v2 criada, `isMigrated = 1`, status `graduated`;
- custo total para quem enviou: **0,032518200 SOL** (0,000015 de taxa de rede, 3 assinaturas; o resto é aluguel das contas novas do DAMM v2, parte dele adiantado pela pool authority e devolvido na mesma instrução), entre 270 e 301 mil compute units;
- as duas posições com `permanent_locked_liquidity` ≈ 4,1166 × 10³², `vested_liquidity = 0`, `unlocked_liquidity = 1` numa e `0` na outra; prova do bloqueio verificada;
- uma NFT de posição com o fee claimer da config e a outra com o criador;
- continuidade de preço de 0% e segunda migração recusada pelo programa;
- no navegador contra o validador, a graduação pela página do token e a prova do bloqueio na tela.

O aluguel do validador é maior que o da Devnet e da Mainnet: convertido, a migração custaria cerca de 0,0237 SOL nesses clusters (estimativa). SOL emprestável da pool authority em 29/10/2026: 99,226635387 na Devnet e 68,824058017 na Mainnet. **Não executado na Devnet pública** (graduação não autorizada). Detalhes e assinaturas em [DEVNET_E2E_RESULTS.md](DEVNET_E2E_RESULTS.md).

## Recuperação

- Se a migração falhar ou expirar, a curva continua completa e qualquer pessoa pode tentar de novo. Não há fundos presos com o usuário. A RETRY nunca reenvia uma migração como transação nova; ao recarregar, a operação é reconciliada pelo estado da chain.
- Se o saldo da pool authority estiver vazio no cluster, a migração não pode ser feita por ninguém até a Meteora repor. A tela explica isso.
- Uma pool `needs-attention` (marcada como migrada sem pool DAMM v2 encontrada) não negocia; a tela mostra o estado em vez de supor.
- Na Mainnet, se o keeper atrasar, a migração manual continua disponível pelo mesmo botão, depois que a Mainnet for liberada.
