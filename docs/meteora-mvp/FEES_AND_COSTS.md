# Taxas e custos

Tudo aqui vem da config DBC RETRY (`src/lib/meteora/curve.ts`), das constantes do programa DBC (`PROTOCOL_FEE_PERCENT = 20`, `PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS = 20`), da pool DAMM v2 lida on-chain e de medições: no validador com os programas oficiais e na Devnet pública. A RETRY não cobra nenhuma taxa fora da config DBC. Não existe taxa escondida no frontend. **Medido** e **estimativa** estão sempre separados; nada foi enviado à Mainnet.

## Taxas de negociação na curva

|                     | % do valor negociado | Quem recebe               | Como sai                                                                   |
| ------------------- | -------------------- | ------------------------- | -------------------------------------------------------------------------- |
| Taxa total          | **1%** fixa          | —                         | cobrada em SOL pelo programa                                               |
| Meteora (protocolo) | 0,2%                 | Meteora                   | 20% da taxa, fixo no programa                                              |
| Criador do token    | 0,4%                 | carteira criadora da pool | `claim_creator_trading_fee`, botão "Claim to my wallet" na página do token |
| RETRY (parceiro)    | 0,4%                 | `feeClaimer` da config    | `claim_trading_fee` do parceiro (operação de tesouraria, fora do app)      |

Medido: a compra de 0,5 SOL pagou 0,005 SOL de taxa, dividida em 0,001 (Meteora), 0,002 (criador) e 0,002 (RETRY), no validador e na Devnet pública. No validador, o saque do criador recebeu exatamente o valor acumulado (0,042527885 SOL depois de ~10,6 SOL negociados na curva); na Devnet pública, 0,003456586 SOL depois de compra e venda.

A divisão aparece na tela de negociação a cada quote (`splitTradingFee`) e na tela de lançamento (`feeSchedule`).

## Taxas na pool DAMM v2 (depois da graduação)

|                     | % do valor negociado           | Quem recebe                                                                                                      | Como sai                                                      |
| ------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Taxa total          | **1%** (`FixedBps100`), em SOL | —                                                                                                                | cobrada pelo `cp_amm`                                         |
| Meteora (protocolo) | 0,2%                           | Meteora                                                                                                          | 20% da taxa (`protocolFeePercent` da pool)                    |
| Posições de LP      | 0,8%                           | as duas posições travadas, na proporção da liquidez: criador e fee claimer da config RETRY, cerca de metade cada | `claim_position_fee`, botão "Claim LP fees" de quem tem a NFT |

Medido no validador: uma compra de 0,2 SOL e uma venda de ~38,66 milhões de tokens pagaram 0,01903855 SOL de taxa, 0,00380771 para a Meteora e 0,01523084 para as posições; o criador sacou 0,00761542 SOL, exatamente a metade das posições, e a liquidez travada não mudou.

## Outras taxas

|                                          | Valor                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Criar pool (taxa RETRY)                  | 0                                                                                                       |
| Metadados do token (programa Metaplex)   | 0,01 SOL na criação, depositados na conta de metadados além do aluguel; a RETRY não recebe nada         |
| Taxa de migração do parceiro/criador     | 0%                                                                                                      |
| Taxa de liquidez da Meteora na graduação | 0,2% da liquidez migrada (constante do programa): 10,000000001 SOL na curva viraram 9,98 SOL no DAMM v2 |
| Referral                                 | nenhum                                                                                                  |
| Priority fee                             | a RETRY não acrescenta; a carteira pode acrescentar e o usuário vê na carteira                          |

## Custos de rede e aluguel

O aluguel mínimo é do cluster. Em 29/10/2026 a Devnet e a Mainnet cobravam 5.080 lamports por byte (contando 128 bytes por conta) e o validador local 6.960, então custos medidos no validador superestimam o aluguel em cerca de 37%. A conversão e as provas estão em [DEVNET_E2E_RESULTS.md](DEVNET_E2E_RESULTS.md#custos-por-cluster).

Valores em SOL, já com a taxa de rede, para quem assina:

| Operação                                   | Validador (medido)                  | Devnet pública (medido) | Mainnet (estimativa) | Observação                                                                                                       |
| ------------------------------------------ | ----------------------------------- | ----------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Criar token + primeira compra de 0,1 SOL   | 0,12654696                          | 0,12208008              | 0,12208008           | 0,1 de compra + 0,01 do Metaplex + aluguel de mint, metadados, pool, dois cofres e conta do token; 2 assinaturas |
| Compra de 0,5 SOL criando a conta do token | 0,50204428                          | 0,50149344              | 0,50149344           | o aluguel da conta do token fica com o usuário; o WSOL temporário é fechado na mesma transação                   |
| Venda                                      | recebe SOL; 0,000005 de rede        | igual                   | igual                | WSOL temporário fechado na mesma transação                                                                       |
| Saque de taxas do criador (curva)          | recebe SOL; 0,000005 de rede        | igual                   | igual                | —                                                                                                                |
| Migração para o DAMM v2                    | 0,03251820                          | não medido              | ≈ 0,0237386          | só aluguel de nove contas novas e 0,000015 de rede (3 assinaturas); na Mainnet quem migra é o keeper da Meteora  |
| Compra ou venda no DAMM v2                 | o valor negociado; 0,000005 de rede | não medido              | igual                | a carteira já tinha a conta do token; WSOL temporário fechado na mesma transação                                 |
| Saque de taxas de LP                       | recebe SOL; 0,000005 de rede        | não medido              | igual                | —                                                                                                                |
| Criar a config RETRY (uma vez por cluster) | 0,00819496                          | 0,00597408 (a conta)    | 0,00598408           | pago pelo parceiro                                                                                               |

Os binários da Devnet e da Mainnet geraram os mesmos valores no validador, por isso a estimativa da Mainnet usa o aluguel da Mainnet sobre as mesmas contas. Ela não substitui uma medição na Mainnet, que não foi autorizada. Com as fixtures do SDK no container, a criação custa 0,000501120 SOL a mais (contas maiores nesses binários).

Antes de assinar, a tela de lançamento mostra o custo simulado no próprio cluster: primeira compra, aluguel e taxas, taxa de rede e total. A tela de negociação reserva 0,01 SOL do saldo para rede e aluguel.

## Custos de operação da RETRY

| Item                                                          | Custo                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Site (GitHub Pages)                                           | R$ 0                                                                                                                                                                                                                                                                                                                                             |
| Worker de metadados (Cloudflare Workers + KV, plano gratuito) | R$ 0 dentro das cotas gratuitas, consultadas em 29/10/2026: KV com 1 GB, 100 mil leituras e mil gravações por dia. Cada envio novo grava dois objetos (imagem e JSON), então as gravações pesam primeiro, em torno de 500 lançamentos por dia. O limite de envios (10 por minuto por identidade do Access) usa o binding de rate limit, não o KV |
| RPC                                                           | público gratuito na Devnet; para Mainnet é recomendado um RPC pago (planos de entrada de provedores como Helius ou Triton), a definir                                                                                                                                                                                                            |
| Config DBC na Mainnet                                         | aluguel único da conta de config, pago pelo parceiro na criação (estimativa 0,00598408 SOL)                                                                                                                                                                                                                                                      |
| Testes                                                        | GitHub Actions do repositório e a carteira de teste da Devnet (0,486351091 SOL de teste consumidos nos dois smokes do PR #8); nenhum SOL real                                                                                                                                                                                                    |

Os limites do plano gratuito da Cloudflare devem ser confirmados na conta do proprietário no momento da implantação.
