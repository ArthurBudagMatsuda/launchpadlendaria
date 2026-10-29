# RETRY + Meteora: documentação do MVP

Estado em 29/10/2026. A RETRY lança tokens SPL como pools do **Meteora Dynamic Bonding Curve (DBC)** a partir de uma config RETRY por cluster, negocia na curva com SOL e, quando a curva completa, gradua a pool para o **Meteora DAMM v2** com toda a liquidez travada para sempre. A negociação continua na mesma página do token. A RETRY não tem programa on-chain próprio.

- Etapa 3 e desbloqueio da Devnet: PR #8 (`feat/retry-meteora-dbc-mvp`).
- Etapas 4, 5 e 6 (criação, negociação, graduação e DAMM v2): Draft PR #9 (`feat/retry-meteora-create-trade-graduate`), empilhado sobre o PR #8.
- Relatório das etapas 4 a 6: [RETRY_METEORA_STAGES_4_5_6_IMPLEMENTATION_REPORT.md](../reports/RETRY_METEORA_STAGES_4_5_6_IMPLEMENTATION_REPORT.md). Relatório da etapa 3: [RETRY_METEORA_MVP_IMPLEMENTATION_REPORT.md](../reports/RETRY_METEORA_MVP_IMPLEMENTATION_REPORT.md).

**Mainnet: travada.** `MAINNET_EXECUTION_ENABLED = false` é constante, não há config RETRY na Mainnet e nenhuma variável de ambiente liga operações financeiras. Ver [MAINNET_RELEASE_CHECKLIST.md](MAINNET_RELEASE_CHECKLIST.md).

## O que funciona e com que evidência

Níveis: U unitário, I integração, B navegador simulado, V validador local com os programas da Meteora, VB navegador contra o validador, D Devnet pública, R carteira real. Definições em [TESTING.md](TESTING.md).

| Recurso                                            | Devnet                                                       | Mainnet                         | Evidência mais forte                            |
| -------------------------------------------------- | ------------------------------------------------------------ | ------------------------------- | ----------------------------------------------- |
| Ler lançamentos RETRY (Discover, token, portfolio) | ligado                                                       | sem config RETRY, nada a listar | V, VB, D                                        |
| Criar token com primeira compra                    | ligado; precisa do Worker de metadados implantado (não está) | travado                         | V, VB, D                                        |
| Comprar e vender na curva                          | ligado                                                       | travado                         | V, VB, D                                        |
| Graduar para o DAMM v2 (migração manual)           | ligado                                                       | travado                         | V, VB; **D pendente**                           |
| Prova on-chain do bloqueio da liquidez             | ligado                                                       | leitura                         | V, VB; **D pendente**                           |
| Comprar e vender no DAMM v2                        | ligado                                                       | travado                         | V (compra e venda), VB (compra); **D pendente** |
| Sacar taxas do criador e de LP                     | ligado                                                       | travado                         | V, VB (LP), D (criador)                         |
| Carteiras reais (Phantom, Solflare, Backpack)      | **pendente**                                                 | —                               | simuladas (B, I)                                |

Os recursos são chaves separadas (`create`, `trade-curve`, `graduate`, `trade-damm`, `claim-fees`) em `src/config/retry-protocol.ts`. Na Devnet vêm ligados; `NEXT_PUBLIC_RETRY_DISABLED_FEATURES` só desliga.

## Documentos

| Documento                                                      | Assunto                                                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)                             | módulos, fluxo de uma transação, hooks, hospedagem, política de execução                       |
| [PROGRAMS_AND_NETWORKS.md](PROGRAMS_AND_NETWORKS.md)           | Program IDs, contas fixas, autoridades de upgrade, hashes dos binários, clusters, variáveis    |
| [RETRY_LAUNCH_CONFIGURATION.md](RETRY_LAUNCH_CONFIGURATION.md) | a config DBC RETRY: supply, curva, taxas, threshold, travamento; a config registrada na Devnet |
| [TOKEN_CREATION.md](TOKEN_CREATION.md)                         | criação do token com primeira compra, regras de nome, duplicatas, recuperação                  |
| [METADATA_AND_STORAGE.md](METADATA_AND_STORAGE.md)             | metadados on-chain e off-chain, Worker com Cloudflare Access, releitura e hash                 |
| [BONDING_CURVE_TRADING.md](BONDING_CURVE_TRADING.md)           | compra e venda na curva, WSOL, allowlist, resultados                                           |
| [QUOTE_AND_SLIPPAGE.md](QUOTE_AND_SLIPPAGE.md)                 | quotes da curva e do DAMM v2, validade, recotação antes de assinar, slippage                   |
| [TOKEN_DISCOVERY.md](TOKEN_DISCOVERY.md)                       | Discover: leitura pela config, colunas, cards, custo de RPC, regras de nome                    |
| [GRADUATION.md](GRADUATION.md)                                 | estados, conclusão da curva, migração para o DAMM v2, continuidade de preço, recuperação       |
| [DAMM_V2_TRADING.md](DAMM_V2_TRADING.md)                       | negociação depois da graduação na mesma página, taxas de LP                                    |
| [LIQUIDITY_LOCKING.md](LIQUIDITY_LOCKING.md)                   | política de travamento, prova on-chain, tentativas de retirada recusadas, limites              |
| [FEES_AND_COSTS.md](FEES_AND_COSTS.md)                         | taxas, custos medidos por operação e por cluster, custos de operação                           |
| [WALLET_INTEGRATION.md](WALLET_INTEGRATION.md)                 | quem assina o quê, o caminho de uma assinatura, situações de carteira                          |
| [SECURITY_MODEL.md](SECURITY_MODEL.md)                         | confiança, controles por camada, segredos, invariantes, riscos abertos                         |
| [TESTING.md](TESTING.md)                                       | níveis de evidência, comandos, suítes, matriz da seção 36, desempenho                          |
| [DEVNET_E2E_RESULTS.md](DEVNET_E2E_RESULTS.md)                 | resultados medidos: validador no CI, navegador, container e Devnet pública                     |
| [MAINNET_RELEASE_CHECKLIST.md](MAINNET_RELEASE_CHECKLIST.md)   | as 27 verificações antes da Mainnet e o estado de cada uma                                     |
| [MAINNET_APPROVAL.md](MAINNET_APPROVAL.md)                     | folha de parâmetros gerada do código, para a aprovação do proprietário                         |
| [OPERATIONAL_RUNBOOK.md](OPERATIONAL_RUNBOOK.md)               | comandos, validador local, Devnet pública, roteiro manual, incidentes                          |

Documentos relacionados fora desta pasta: [docs/SOLANA_WALLET_INTEGRATION.md](../SOLANA_WALLET_INTEGRATION.md) (conexão de carteiras, PR #6), [docs/devnet/](../devnet/) (carteira de teste da Devnet e evidências do smoke público, PR #8), [docs/cloudflare/RETRY_METADATA_WORKER_SETUP.md](../cloudflare/RETRY_METADATA_WORKER_SETUP.md) (implantação do Worker). Os metadados de teste continuam em [docs/meteora/devnet-metadata/](../meteora/devnet-metadata/), porque o endereço está gravado on-chain.

## Pendências que impedem um lançamento público

1. Worker de metadados implantado na conta Cloudflare do proprietário (sem ele, ninguém lança).
2. Testes com carteiras reais na Devnet.
3. Graduação, DAMM v2 e prova do bloqueio na Devnet pública (autorização e até 12 SOL de teste).
4. Para a Mainnet: aprovação dos parâmetros, tesouraria como fee claimer, revisão independente de segurança, tratamento dos alertas de dependências e autorização específica do proprietário.
