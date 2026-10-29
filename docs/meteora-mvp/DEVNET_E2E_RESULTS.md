# Resultados de ponta a ponta: validador e Devnet

Estado em 29/10/2026. Tudo aqui foi medido; estimativas aparecem marcadas como tal. O que cada nível prova está em [TESTING.md](TESTING.md). **Nenhuma transação foi enviada à Mainnet.**

## Resumo

| Ambiente                                                      | O que rodou                                                                                                     | Resultado                                       | Evidência                                                                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Validador no GitHub Actions, programas clonados da Devnet     | fluxo on-chain completo (21 testes) e o app no navegador (1 teste)                                              | aprovado                                        | [execução 40972474049](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40972474049), commit `6247354` |
| Validador no GitHub Actions, programas clonados da Mainnet    | o mesmo                                                                                                         | aprovado                                        | mesma execução                                                                                                             |
| Validador no container, binários das fixtures do SDK          | o mesmo                                                                                                         | aprovado                                        | execuções locais desta sessão (não versionadas)                                                                            |
| Devnet pública, carteira de teste descartável (PR #8)         | config registrada, criação com primeira compra, compra, venda, venda acima do saldo, slippage, saque do criador | 8 aprovados, 2 pulados                          | [docs/devnet/evidence/](../devnet/evidence/)                                                                               |
| Devnet pública: completar a curva, graduar, DAMM v2, bloqueio | não executado                                                                                                   | **pendente**: autorização e até 12 SOL de teste | —                                                                                                                          |
| Mainnet                                                       | nada                                                                                                            | proibido nesta tarefa                           | —                                                                                                                          |

## Validador com os programas da Meteora (GitHub Actions)

Workflow "RETRY Meteora on-chain tests", execução [40972474049](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40972474049) no commit `6247354`, 29/10/2026 23:20–23:22 UTC. Cada variante sobe um `solana-test-validator` (Agave 3.1.10) que clona do cluster os quatro programas, a config DAMM v2 de migração e a pool authority do DBC com o saldo real. A variante de Devnet clona também a config RETRY registrada (`8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N`); a de Mainnet cria uma config nova com os mesmos parâmetros. Os hashes dos binários testados são conferidos na própria execução ([PROGRAMS_AND_NETWORKS.md](PROGRAMS_AND_NETWORKS.md)).

Valores em SOL. "Variação" é a variação simulada do saldo de quem assina, sem a taxa de rede. O aluguel é o do validador (6.960 lamports por byte); a Devnet e a Mainnet cobram menos, ver [Custos por cluster](#custos-por-cluster).

| Passo                                        | Programas da Devnet                                                                                                 | Programas da Mainnet                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Config RETRY                                 | a registrada, clonada                                                                                               | criada: 0,008194960 (aluguel e rede)        |
| Criação com primeira compra de 0,1 SOL       | −0,126536960 · rede 0,00001 · 223.397 CU                                                                            | igual · 209.963 CU                          |
| Compra de 0,5 SOL                            | −0,502039280 (inclui 0,00203928 da conta do token, nova)                                                            | igual                                       |
| Venda de metade                              | +0,261505003                                                                                                        | igual                                       |
| Compra que completa a curva                  | −9,767824717 (preenchimento parcial até o threshold)                                                                | igual                                       |
| SOL emprestável da pool authority            | 99,226635387                                                                                                        | 68,824058017                                |
| Migração para o DAMM v2                      | custo total 0,032518200 · rede 0,000015 · 270.423 CU                                                                | igual · 289.923 CU                          |
| Posições de LP                               | criador e RETRY (`DbvhT2t9…`, o fee claimer registrado): permanente 4,1166 × 10³² cada; destravado 1 e 0; vesting 0 | o mesmo, com o fee claimer da config criada |
| Prova do bloqueio                            | verificada: 100% travado, 1 unidade de arredondamento, vesting 0                                                    | igual                                       |
| Continuidade de preço                        | curva 5 × 10⁻⁸ → DAMM v2 5 × 10⁻⁸ SOL por token (0%); 10,000000001 SOL na curva, 9,98 no DAMM v2                    | igual                                       |
| Segunda migração                             | recusada pelo DBC: `{"InstructionError":[0,{"Custom":6022}]}` (`NotPermitToDoThisAction`)                           | igual                                       |
| Compra de 0,2 SOL no DAMM v2                 | −0,200000000                                                                                                        | igual                                       |
| Venda no DAMM v2                             | recebeu 1,661645052 (mínimo cotado 1,645033551)                                                                     | igual                                       |
| Mínimo acima do possível no DAMM v2          | recusado on-chain: 6002 `ExceededSlippage`                                                                          | igual                                       |
| Cinco tentativas de retirar liquidez travada | todas recusadas: 6023 duas vezes, 6053 duas vezes, 6039                                                             | igual                                       |
| Estranho saca as taxas de LP do criador      | recusado: 6053 `InvalidAuthority`                                                                                   | igual                                       |
| Criador saca as taxas de LP                  | +0,007610420 (já sem a taxa de rede)                                                                                | igual                                       |
| Criador saca a parte dele das taxas da curva | 0,042527885                                                                                                         | igual                                       |
| Histórico decodificado                       | 17 transações, incluindo a segunda migração recusada                                                                | igual                                       |
| App no navegador (abaixo)                    | aprovado em 33,1 s                                                                                                  | aprovado em 40,3 s                          |

As compute units variam de execução para execução (criação entre 203 e 224 mil, migração entre 270 e 301 mil nas últimas execuções); os valores em SOL foram os mesmos em todas as execuções consultadas, desde a etapa 3.

<details>
<summary>Assinaturas da variante de Devnet (validador efêmero do CI: servem para cruzar com o artefato da execução, não existem num explorer)</summary>

| Passo                       | Assinatura                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Criação com primeira compra | `35zKvTL619dNe5AbDtrZDKu9GrZCPwagCqxKAEvCQP5htnNNgTCBaVrAaTv3kWmEcAqkqqhEzy1GFSh2Pfdyq5x9` |
| Compra de 0,5 SOL           | `2vmYYqVrTbKByhWKiFcAY9r3YCRFHpfRNkX9YVcc1tHdyFTxfn3dTUbYew8477dVWG1SdDzYndkdN9EN6WjTxFbd` |
| Venda de metade             | `5kLCNGRvqRGa9LuvhfANjiaXugowzYg84a7H6yvoj7gCiRuMfV81MJs8sTLCbwdWv3NLJKcjzPsht2XEJXcfMnwS` |
| Compra que completa a curva | `4UBuAb4rVKeYtTj4cQBWNypFLc2MeTzNHUW37L1Zxv1ycntc2koif5kYjtaJ9M56q15QJDk3RdQR7EGvtRbF5RG2` |
| Migração                    | `34Lach9Jg7xN4uTff5PxTV36NyZ8sDLtymBMWjipbw1ZKNPKKpJ9aTHiGdo83yMpYL8tB6MXKgih9msGgqeQbkoi` |
| Segunda migração (recusada) | `23K23dS3CK3jAGPvpB4zcNt1Rfyp41ehyVu8p2JxJoPTsG3DpvPAdxv5h4VkrD6Thmavxd41JNdLt7AuTsugnfYv` |
| Compra no DAMM v2           | `5Xc9NcixRw96UGyxaVnvAbSfDCKJwJcXrL1beS5fkiy8R7RUPyP4KKJ3cjcBCFx6xm8DV8etiZob4Eny3iJDZj7k` |
| Venda no DAMM v2            | `5CBn4aVn7cDC65w8A7rnwYfAUzkyZeuCzMnseKdaEiRHKUCPmFuXRVPDxftzJJMZFj6Nurx5hpBm3xU3oKfngqEf` |
| Slippage no DAMM v2         | `2rYSUrrUwZuktJh3A8abDzyghoiJFAP3NYxEfQjHaGctbYxT1msxGEt6eGdxPf35ZHfDGXrrSoYpMbqcwxPs2xoN` |
| Saque do criador (curva)    | `5APHa8Ve1L7hobHteDRv5VoDJz9cR4cfEKBVZWK8KoJtx6ENA8s2HGpyEPusYViNtbz6T3yzazvDdL21Pcm681nm` |

As tentativas de retirada recusadas e a variante de Mainnet estão nas anotações da execução. O JSON completo (`evidence-validator.json`) e as capturas de tela ficam no artefato `meteora-validator-<variante>-evidence` por 30 dias.

</details>

## O app no navegador contra o validador

`e2e/chain/meteora-browser.spec.ts` roda no mesmo validador, depois do fluxo, com o export estático do app (o mesmo build do Pages) e uma carteira de teste Wallet Standard que assina com uma chave do processo de teste. O Worker de metadados roda no processo do teste (KV em memória, JWT do Access assinado pelo teste). Passos, todos pela interface:

1. Conectar a carteira e criar "Browser Cat" (BCAT) com imagem; revisão de custo com 0,2 SOL de primeira compra; assinar e lançar.
2. Na página do token: comprar 0,1 SOL e vender 50%.
3. Comprar 10,5 SOL: a tela avisa "This buy completes the curve."; o programa usa só o necessário e devolve o resto.
4. "Graduate to DAMM v2": "Graduated. The DAMM v2 pool is live." e "Lock verified on-chain"; o mesmo formulário passa a negociar no DAMM v2.
5. Comprar 0,2 SOL no DAMM v2.
6. "Claim LP fees" do criador: "LP fees claimed. The locked liquidity did not move." e a prova do bloqueio continua verificada.
7. Portfolio: posição de LP "Permanently locked" e atividade com o lançamento e a graduação confirmados. Discover: o card do token pelo endereço do mint.
8. Exatamente sete assinaturas da carteira (lançamento, compra, venda, compra que completa, migração, compra no DAMM v2, saque de LP) e nenhum erro de console.

Valores na tela ao final da execução local (validador limpo, fixtures do SDK): preço 5,2 × 10⁻⁸ SOL, FDV 52 SOL, 10,179 SOL e 195,72 milhões de tokens na pool, "Trades on DAMM v2 · 1% fee"; atividade Launch 0,2 SOL / 59,81 M, Buy 0,1 / 27,46 M, Sell 0,1532 / 43,63 M, Buy 9,9574 / 756,37 M, Graduation, Buy DAMM v2 0,2 / 3,88 M, Fee claim DAMM v2; 0,041648 SOL de taxas do criador a sacar.

O teste prova o caminho da tela até o programa. Não prova uma extensão de carteira real nem o Worker implantado.

## Validador no container (fixtures do SDK)

O container desta sessão não alcança a Devnet nem a Mainnet. O validador local usa os binários de teste do repositório do SDK (`dynamic-bonding-curve-sdk`, commit `3a965ec` de 22/10/2026), que **não são** os da Devnet nem os da Mainnet:

| Programa                | sha256 da fixture                                                  | Bytes     |
| ----------------------- | ------------------------------------------------------------------ | --------- |
| DBC                     | `772a848c416bbc45e2dd9f13b9a90635eff1df313197db4b17067923f4675d90` | 1.694.641 |
| DAMM v2                 | `3937aeb36a940ae66d6fe99ebfd58873e22f9820b3274f3b1f88845bfca9b3fd` | 1.429.433 |
| Locker                  | `dbde6095550d627d24ab17c8c26872bae1c56a0c7d94ae68f09838ac7d066ea5` | 491.649   |
| Metaplex Token Metadata | `ddb0df2b6f6dc1ba19d9da8e2c0f7f1c25c3d1bcb28d456a0088798eb4465900` | 679.665   |

A config DAMM v2 de migração foi carregada dos bytes da Mainnet que o CI imprime, e a pool authority do DBC foi criada com 50 SOL (no CI ela vem do cluster). Resultados em 29/10/2026: fluxo on-chain 21 de 21, duas vezes; navegador 1 de 1 em 18,5 s num validador limpo. Diferenças em relação ao CI: a criação custa 0,000501120 SOL a mais (72 bytes de aluguel a mais com esses binários) e as compute units diferem. A segunda migração foi recusada com o mesmo erro 6022.

Decomposição medida nas transações locais (aluguel do validador):

- **Criação**: 0,1 SOL vão para o cofre da pool; 0,01 SOL vão para a conta de metadados do Metaplex além do aluguel dela (taxa do programa Metaplex; a RETRY não recebe nada); o resto é aluguel das contas novas (mint, metadados, pool, dois cofres e a conta do token do criador); a conta WSOL temporária é aberta e fechada na mesma transação.
- **Migração**: 0,0325032 SOL de aluguel de nove contas do DAMM v2 (pool de 1.112 bytes, duas posições, duas NFTs de posição, duas contas das NFTs e dois cofres) mais 0,000015 de rede. Parte do aluguel é adiantada pela pool authority do DBC e devolvida pelo pagador na mesma instrução. Nada além de aluguel e rede.
- **Compra no DAMM v2**: 0,2 SOL e 0,000005 de rede; a conta WSOL temporária é fechada na mesma transação.
- **Saque de LP**: o criador recebeu 0,00761542 SOL e pagou 0,000005 de rede.

## Devnet pública (PR #8)

Carteira de teste descartável `3r8gEonYHrXEao85oFAu2UzVgT1KsxFmWUZLWBd8G5B3`, chave no environment protegido `retry-devnet` e num backup local do proprietário; nunca no repositório nem no navegador. O smoke rodou pelo procedimento local do PR #8 (`scripts/manage-devnet-funder.mjs run-smoke`), porque o dispatch do workflow não está disponível fora da `main`.

| Tentativa | Código    | Resultado                                                                                                                                            | Evidência                                                                               |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1         | `e83cf8b` | falhou no RPC público: HTTP 429 e falha de rede em `getAccountInfo` ao preparar a compra; 5 aprovados, 3 falhas (1 causa e 2 dependentes), 2 pulados | [SMOKE_ATTEMPT_1_RPC_FAILURE.json](../devnet/evidence/SMOKE_ATTEMPT_1_RPC_FAILURE.json) |
| 2         | `4233212` | 8 aprovados, 0 falhas, 2 pulados ("complete the curve" e "migrate to DAMM v2", graduação não autorizada), 120,71 s                                   | [SMOKE_DEVNET_CONFIRMED.json](../devnet/evidence/SMOKE_DEVNET_CONFIRMED.json)           |

Transações da segunda tentativa, todas `finalized` na conferência de 29/10/2026 19:37 UTC ([CHAIN_CONFIRMATIONS.json](../devnet/evidence/CHAIN_CONFIRMATIONS.json)):

| Passo                                  | Transação                                                                                                                                           | Slot      | Medido                                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config RETRY registrada                | [5rKrTaNc…](https://explorer.solana.com/tx/5rKrTaNcbnwmysG9VpHRyeQ9zrbkY6cU2UUYckcNeKvv1TcnGWvvqovf19B2jR1F76G2VgastRkkbbNSrnXeasPK?cluster=devnet) | 516519451 | criada na tentativa 1 e reaproveitada na 2: conta de 1.048 bytes com 0,00597408 SOL, custo total 0,00598408 com a rede ([tentativa 1](../devnet/evidence/SMOKE_ATTEMPT_1_RPC_FAILURE.json)) |
| Criação com primeira compra de 0,1 SOL | [3nh1iy8t…](https://explorer.solana.com/tx/3nh1iy8tmTqZRDTdtBvKFTUUC4hPCLXXBrVB4QXhB9hJqJFANisp2ZDKDqAHq4h8ENsUQo9vqj8DBo9cVEWSaMr1?cluster=devnet) | 516520928 | −0,122070080 · rede 0,00001 · 166.312 CU                                                                                                                                                    |
| Compra de 0,5 SOL                      | [4dFMi1QJ…](https://explorer.solana.com/tx/4dFMi1QJuyTuvVJfBPJPS4PG9ufrpcLGkDGw9xcEuGahpDosesTAuQcyaeoFmxib6Vmjm2Fg6TRsuytRXFmRkCQF?cluster=devnet) | 516521010 | −0,501488440 · taxa 0,005 = 0,001 Meteora + 0,002 criador + 0,002 RETRY · impacto 15,58%                                                                                                    |
| Venda de metade                        | [37r53BzU…](https://explorer.solana.com/tx/37r53BzUER16sRQK8nuj1jBL64PLbfktbZnk22NQWvviLP3ud6UNTqT8HpvypTxydMUS7z1yJj8q6zmUobVs6hLn?cluster=devnet) | 516521097 | +0,261505003                                                                                                                                                                                |
| Saque do criador                       | [3BcbUyn3…](https://explorer.solana.com/tx/3BcbUyn3GaZv7TUgKZcV6cHzDBTnVJZ3BcYvDt22wyddhQaeKoJAjFTh4oXxSPVmCA3E9BHY1WB8DkaoCCAjWwiT?cluster=devnet) | 516521237 | 0,003456586 sacado                                                                                                                                                                          |

Venda acima do saldo e slippage foram recusados antes de qualquer envio. Mint `6WwkimyJfjEbeh7wSXYRZ6e26pmEyPLWwTUt9fTY1nUz` (nome "RETRY Devnet Test", ticker `RTEST`, metadados imutáveis, update authority = System Program), pool `2Lu2YaaHJLibHxzYG45b2y8YTyXhyGS2xqb23fZJhRpd`. Saldo da carteira de teste: 2,372300840 → 2,013648909 SOL nesta tentativa; 0,486351091 SOL consumidos nas duas tentativas, já com os reembolsos das chaves efêmeras.

**Não executado na Devnet pública**: completar a curva, migração, DAMM v2, prova do bloqueio e saque de LP. O harness marca esses passos como pulados, nunca como aprovados. Executar exige autorização separada de graduação e um teto de até 12 SOL de teste (ver [OPERATIONAL_RUNBOOK.md](OPERATIONAL_RUNBOOK.md)).

## Custos por cluster

O aluguel mínimo é definido por cluster. O workflow lê o de cada um (linhas `RENT`, só leitura) e, em 29/10/2026:

| Cluster                        | Lamports por byte (conta + 128 bytes) | Conta de token (165 bytes) | Mint (82 bytes) |
| ------------------------------ | ------------------------------------- | -------------------------- | --------------- |
| Validador local (Agave 3.1.10) | 6.960                                 | 0,00203928 SOL             | 0,0014616 SOL   |
| Devnet pública                 | 5.080                                 | 0,00148844 SOL             | 0,0010668 SOL   |
| Mainnet (leitura)              | 5.080                                 | 0,00148844 SOL             | 0,0010668 SOL   |

As medições batem com isso: a mesma criação custou 0,12653696 SOL no validador e 0,12207008 SOL na Devnet pública; a diferença (0,00446688) é exatamente o aluguel das contas novas (2.376 bytes, contando os 128 de cada conta) pela diferença de preço por byte. A mesma conta comparando a compra (conta do token nova) e a config dá o mesmo resultado. Como os binários da Devnet e da Mainnet geraram os mesmos valores no validador, as estimativas para a Mainnet usam os números medidos na Devnet pública:

| Operação                                  | Validador (medido) | Devnet pública (medido) | Mainnet (estimativa, nada enviado) |
| ----------------------------------------- | ------------------ | ----------------------- | ---------------------------------- |
| Criação com primeira compra de 0,1 SOL    | 0,12654696         | 0,12208008              | 0,12208008                         |
| Compra de 0,5 SOL com conta do token nova | 0,50204428         | 0,50149344              | 0,50149344                         |
| Config RETRY (uma vez por cluster)        | 0,00819496         | 0,00598408              | 0,00598408                         |
| Migração para o DAMM v2                   | 0,03251820         | não medido              | ≈ 0,0237386, paga por quem migra   |

Valores com a taxa de rede. A estimativa da migração supõe as mesmas contas e só converte o aluguel; na Mainnet a migração das pools RETRY é do keeper da Meteora.
