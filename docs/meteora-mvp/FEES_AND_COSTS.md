# Taxas e custos

Tudo aqui vem da config DBC RETRY (`src/lib/meteora/curve.ts`), das constantes do programa DBC (`PROTOCOL_FEE_PERCENT = 20`, `PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS = 20`) e de medições on-chain no validador local com os programas oficiais. A RETRY não cobra nenhuma taxa fora da config DBC. Não existe taxa escondida no frontend.

## Taxas de negociação (na curva)

|                     | % do valor negociado | Quem recebe               | Como sai                                                              |
| ------------------- | -------------------- | ------------------------- | --------------------------------------------------------------------- |
| Taxa total          | **1%** fixa          | —                         | cobrada em SOL pelo programa                                          |
| Meteora (protocolo) | 0,2%                 | Meteora                   | 20% da taxa, fixo no programa                                         |
| Criador do token    | 0,4%                 | carteira criadora da pool | `claim_creator_trading_fee`, botão "Claim" na página do token         |
| RETRY (parceiro)    | 0,4%                 | `feeClaimer` da config    | `claim_trading_fee` do parceiro (operação de tesouraria, fora do app) |

Exemplo medido: compra de 0,5 SOL pagou 0,005 SOL de taxa, dividida em 0,001 (Meteora), 0,002 (criador) e 0,002 (RETRY). O teste de saque do criador recebeu exatamente o valor acumulado (0,042527885 SOL depois de ~10,6 SOL negociados), menos a taxa de rede.

A divisão aparece na tela de negociação a cada quote (`splitTradingFee`) e na tela de lançamento (`feeSchedule`).

## Outras taxas

|                                            | Valor                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Criar pool (taxa RETRY)                    | 0                                                                                      |
| Taxa de migração do parceiro/criador       | 0%                                                                                     |
| Taxa de liquidez da Meteora na graduação   | 0,2% da liquidez migrada (constante do programa)                                       |
| LP fee da pool DAMM v2 depois da graduação | 1% (FixedBps100), vai para quem tem as NFTs das posições travadas (parceiro e criador) |
| Referral                                   | nenhum                                                                                 |
| Priority fee                               | a RETRY não acrescenta; a carteira pode acrescentar e o usuário vê na carteira         |

## Custos de rede e aluguel (medidos)

Valores de `simulateTransaction` e do saldo real, em SOL. "Variação" é o que sai da carteira além da taxa de rede, já incluindo o valor negociado.

| Operação                                   | Variação simulada                                                 | Taxa de rede             | Observação                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Criar token + primeira compra de 0,1 SOL   | 0,127038080 (fixtures do SDK) · 0,126536960 (binários de Mainnet) | 0,00001 (2 assinaturas)  | sem a compra: ≈ 0,0265–0,0270 SOL de aluguel (mint, metadados, pool, cofres, ATAs) e taxas de programa |
| Compra de 0,5 SOL criando a conta do token | 0,502039280                                                       | 0,000005                 | 0,00203928 é o aluguel da ATA nova, que fica com o usuário                                             |
| Venda                                      | recebe SOL                                                        | 0,000005                 | WSOL temporário é fechado na mesma transação                                                           |
| Saque de taxas do criador                  | recebe SOL                                                        | 0,000005                 | —                                                                                                      |
| Migração para DAMM v2                      | 0,032518200 (total, com a taxa de rede)                           | 0,000015 (3 assinaturas) | o pagador reembolsa o aluguel que a pool authority da Meteora emprestou                                |
| Criar a config RETRY (uma vez por cluster) | 0,008194960 (total, com a taxa de rede)                           | 0,00001 (2 assinaturas)  | pago pelo parceiro; aluguel da conta de config                                                         |

A diferença entre as duas medições de criação vem dos binários usados (fixtures do SDK no container versus programas clonados da Mainnet no Actions).

Antes de assinar, a tela de lançamento mostra o custo simulado: primeira compra, aluguel e taxas, taxa de rede e total. A tela de negociação reserva 0,01 SOL do saldo para rede e aluguel.

## Custos de operação da RETRY

| Item                                                          | Custo                                                                                                                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site (GitHub Pages)                                           | R$ 0                                                                                                                                                                                                                                              |
| Worker de metadados (Cloudflare Workers + KV, plano gratuito) | R$ 0 dentro dos limites gratuitos (referência: 100 mil requisições/dia, 1 GB e 1.000 gravações/dia no KV). Cada upload faz 3 gravações (contador, imagem, JSON), então o limite de gravação é o primeiro a pesar, em torno de 300 lançamentos/dia |
| RPC                                                           | público gratuito em Devnet; para Mainnet é recomendado um RPC pago (planos de entrada de provedores como Helius ou Triton), a definir                                                                                                             |
| Config DBC na Mainnet                                         | aluguel único da conta de config, pago pelo parceiro na criação (0,00819496 SOL medido no validador)                                                                                                                                              |
| Testes                                                        | GitHub Actions do repositório; nenhum SOL real                                                                                                                                                                                                    |

Os limites do plano gratuito da Cloudflare devem ser confirmados na conta do proprietário no momento da implantação.
