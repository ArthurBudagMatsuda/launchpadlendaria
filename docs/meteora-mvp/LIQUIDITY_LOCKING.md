# Bloqueio permanente da liquidez graduada

Código: `src/lib/meteora/curve.ts` (config), `src/lib/meteora/damm-v2.ts` (`verifyLockedLiquidity`, `checkLock`), `src/components/launch/graduation-panel.tsx` (prova na tela), `tests/chain/meteora-flow.chain.ts` (provas e testes negativos). Graduação em si: [GRADUATION.md](GRADUATION.md).

## Política

| Parâmetro da config DBC                     | Valor  | Conferido on-chain por `configMismatches`                                                                                                                  |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `partnerPermanentLockedLiquidityPercentage` | 50     | sim                                                                                                                                                        |
| `creatorPermanentLockedLiquidityPercentage` | 50     | sim                                                                                                                                                        |
| `partnerLiquidityPercentage` (livre)        | 0      | sim                                                                                                                                                        |
| `creatorLiquidityPercentage` (livre)        | 0      | sim                                                                                                                                                        |
| Vesting (`lockedVesting`)                   | nenhum | indiretamente: o supply fixo é exatamente a parte vendida na curva mais a depositada na graduação, e o teste de chain confere essas duas quantias on-chain |

Ou seja: 100% da liquidez que vai para o DAMM v2 fica travada para sempre, metade numa posição do parceiro (o fee claimer da config RETRY) e metade numa posição do criador. Ninguém, nem a RETRY, pode retirar o principal. Quem tem a NFT de uma posição só pode sacar as taxas de LP que ela rende.

## Como o bloqueio acontece

Na instrução `migration_damm_v2`, o programa DBC:

1. cria a pool DAMM v2 com o SOL da curva (menos a taxa de migração da Meteora) e os tokens reservados para a graduação;
2. cria duas posições, com NFTs cujos mints foram gerados no navegador para essa transação;
3. chama `permanent_lock_position` do `cp_amm` para cada uma;
4. entrega uma NFT ao parceiro e a outra ao criador.

**Resto de arredondamento**: o DBC arredonda para baixo a parte travada de cada posição. O que sobra, no máximo 1 unidade de liquidez, fica destravado na posição do criador. Medido: exatamente 1 unidade, contra cerca de 4,1 × 10³² unidades travadas por posição. A afirmação exata é "toda a liquidez graduada travada para sempre, exceto 1 unidade de arredondamento".

## A prova, lida do estado dos programas

`verifyLockedLiquidity(pool DAMM v2)`:

1. lê **todas** as posições da pool (`getAllPositionsByPool`, `getProgramAccounts` no `cp_amm`);
2. para cada posição, acha quem tem a NFT: a conta PDA da posição no Token-2022 ou, se a NFT foi movida, a única conta com saldo 1 (`getTokenLargestAccounts`);
3. calcula as taxas sacáveis de cada posição (`getUnClaimLpFee`);
4. `checkLock` ordena as posições pela liquidez travada para sempre. As duas maiores são as posições graduadas; as outras são de quem abriu posição depois (reportadas à parte, sem falhar a prova).

`verified = true` só quando:

- há exatamente 2 posições graduadas;
- cada uma tem `vested_liquidity = 0` e `unlocked_liquidity ≤ 1`;
- a soma de `permanent_locked_liquidity` de todas as posições é igual ao total que a própria pool registra (`permanentLockLiquidity`);
- esse total é maior que zero.

A tela mostra "Lock verified on-chain", a porcentagem da liquidez da pool travada para sempre, as unidades destravadas (arredondamento), o vesting e os donos das NFTs. Se a prova falhar, a tela mostra "Lock check did not pass" e pede cautela; se o RPC não responder, diz que o bloqueio não pôde ser lido. Nunca afirma o bloqueio sem a prova. O teste no navegador contra o validador confere "Lock verified on-chain" depois da graduação e de novo depois do saque de taxas de LP.

## Resultado medido

Validador com os programas clonados da Devnet e da Mainnet ([execução 40972474049](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40972474049), commit `6247354`; os mesmos números nas execuções anteriores consultadas):

| Posição                    | `permanent_locked_liquidity`                | `unlocked` | `vested` |
| -------------------------- | ------------------------------------------- | ---------- | -------- |
| uma das duas (com a sobra) | 411.657.202.295.550.785.824.274.880.615.505 | 1          | 0        |
| a outra                    | 411.657.202.213.054.352.498.513.200.089.599 | 0          | 0        |

`verified = true`, travado = 100% (arredondado para baixo em 6 casas; o teste exige mais de 99,999999%), `permanentLocked + unlocked = liquidez total da pool`, nenhuma outra posição, uma NFT com o fee claimer da config e a outra com o criador.

## Testes negativos (todos no validador, nas duas variantes de binário)

Cada tentativa é enviada sem preflight, de propósito, para que o próprio `cp_amm` a recuse on-chain:

| Tentativa                                                           | Recusa do `cp_amm`           |
| ------------------------------------------------------------------- | ---------------------------- |
| criador retira a liquidez travada (`remove_liquidity`)              | 6023 `InsufficientLiquidity` |
| criador retira mais do que a sobra destravada                       | 6023 `InsufficientLiquidity` |
| estranho retira a liquidez da posição do parceiro (RETRY)           | 6053 `InvalidAuthority`      |
| estranho retira tudo (`remove_all_liquidity`) da posição do criador | 6053 `InvalidAuthority`      |
| criador fecha a própria posição travada                             | 6039 `PositionIsNotEmpty`    |
| estranho saca as taxas de LP do criador                             | 6053 `InvalidAuthority`      |

E o caso permitido: o criador saca as próprias taxas de LP (0,007610420 SOL), a liquidez travada fica igual e a prova continua `verified`.

Assinaturas em [DEVNET_E2E_RESULTS.md](DEVNET_E2E_RESULTS.md).

## Do que isso depende

- **Do programa `cp_amm` da Meteora**: o bloqueio é uma regra do programa, não da RETRY. O `cp_amm` é atualizável pela autoridade da Meteora (ver [PROGRAMS_AND_NETWORKS.md](PROGRAMS_AND_NETWORKS.md)). Os testes provam o comportamento dos binários de 29/10/2026; um upgrade pode mudá-lo. O workflow registra o hash dos binários a cada execução.
- **Da config RETRY**: as porcentagens são conferidas on-chain antes de qualquer lançamento. Uma config diferente não é reconhecida como RETRY.
- **Não depende de nenhuma chave da RETRY**: a RETRY não tem autoridade sobre as posições.

## Limites conhecidos

- **Identificação das posições graduadas pela ordem de tamanho.** Se alguém abrir depois uma posição e travar para sempre mais liquidez do que uma das posições graduadas, essa posição entra entre as "duas maiores" e uma graduada passa para a lista "outras". A liquidez graduada continua travada (nada disso a destrava), mas a tela pode mostrar donos errados ou deixar de confirmar a prova. Custaria travar para sempre cerca de metade da liquidez da pool. Correção possível: tirar os mints das NFTs graduadas da própria transação de migração (contas `first_position_nft_mint` e `second_position_nft_mint`).
- **NFTs são transferíveis.** Quem receber a NFT recebe o direito às taxas de LP, nunca ao principal. A prova acompanha o dono atual.
- **Prova lida, não auditada.** A leitura usa o RPC configurado; um RPC desonesto poderia mentir. Conferir no explorer o estado das contas `Position` é a verificação independente.
- **Devnet pública**: ainda sem graduação; ver [DEVNET_E2E_RESULTS.md](DEVNET_E2E_RESULTS.md).
