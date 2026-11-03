# Gates de aceite — 03/11/2026

Estados: PASS, FAIL, BLOCKED, PARTIAL, NOT TESTED. **Preview de leitura: PASS. Beta transacional da missão original: PARTIAL / ainda não liberada.**

| Gate                | Estado  | Evidência / pendência                                                                                                                                            |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Infraestrutura  | PARTIAL | Worker, KV, URI e preview publicados e lidos; upload Access BLOCKED por escolha sem cartão                                                                       |
| B — Carteiras       | PARTIAL | Conexão/refresh/Portfolio/reconexão confirmados pelo proprietário; 0 SOL verificado; assinatura e matriz real completa NOT TESTED                                |
| C — Create          | BLOCKED | Interface abre; nenhum POST autenticado remoto, mint ou pool novos pela interface                                                                                |
| D — DBC Trading     | BLOCKED | Buy/sell públicos novos desligados; validadores locais PASS                                                                                                      |
| E — Graduation      | BLOCKED | Threshold 10 SOL, funder 2.013648909; modo de leitura; nenhuma migração pública                                                                                  |
| F — Liquidity       | PARTIAL | Inteiros/autoridades/testes negativos locais; resíduo 1, `fullyLocked=false`; prova pública ausente                                                              |
| G — Post Graduation | BLOCKED | DAMM v2 local PASS; nenhuma pool/quote/swap público novo                                                                                                         |
| H — Segurança       | PARTIAL | Mainnet false/config null; patch alto controlado; 3 moderados residuais; CI do HEAD deve ser conferido no PR; revisão independente e segurança Mainnet pendentes |

Critérios concretos de leitura aprovados: domínio exclusivo; commit conhecido e limpo; raiz/assets/rotas; identificação Devnet/sem fundos reais; todas as features financeiras off; POST fechado; leitura pública por hash; dois percursos públicos sem mocks; site antigo sem alteração.

Antes de qualquer liberação transacional: autorização de upload resolvida sem cobrança inesperada; testes remotos de tamanho máximo/Access; carteira de testes financiada; Create/Buy/Sell via interface; orçamento de graduação; migração/LP/DAMM públicos; saldos/fees/signatures/slots registrados. Não marcar esses itens PASS por testes locais. [Relatório](../reports/RETRY_STAGE_8_PUBLIC_DEVNET_BETA_REPORT.md), [checks atuais do PR](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/11/checks).
