# Etapa 8 — preview público de leitura

**03/11/2026. Resultado: PARTIAL para a Beta transacional; PASS para o preview de leitura escolhido pelo proprietário.**

[Abrir RETRY](https://retry-solana-devnet-beta.pages.dev/) · [Versão publicada](https://retry-solana-devnet-beta.pages.dev/beta-version.json) · [Draft PR #11](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/11) · [Relatório completo](../reports/RETRY_STAGE_8_PUBLIC_DEVNET_BETA_REPORT.md).

O proprietário escolheu **“Sem cartão; publique o preview de leitura”** ao encontrar o cadastro de cobrança do Zero Trust. O frontend tem todas as operações financeiras desligadas pelo controle existente. O Worker foi publicado como serviço interno com leituras públicas pelo gateway Pages; POST continua fechado. Nenhum token ou swap novo foi enviado nesta etapa. Mainnet desabilitada, site antigo preservado, nenhum PR mesclado.

| Evidência                                                                            | Estado                                                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Preview separado, raiz, assets, rotas, desktop/mobile e dois tokens históricos reais | PASS                                                                          |
| KV remoto: imagem + JSON, hashes e MIME conferidos sem login                         | PASS                                                                          |
| Worker local: autenticação RSA, persistência em disco após restart e rate limiter    | PASS, ambiente LOCAL WORKER RUNTIME                                           |
| Upload público com sessão Access                                                     | BLOCKED por decisão de não ativar cobrança                                    |
| Phantom de testes: conexão, refresh, Portfolio e reconexão                           | PARTIAL, confirmado pelo proprietário; saldo 0 validado por RPC               |
| Create, buy/sell, graduação e DAMM v2 públicos novos                                 | BLOCKED no preview de leitura                                                 |
| Liquidez graduada                                                                    | PARTIAL: evidência apenas em validadores; um resíduo bruto não é 100% literal |

Os documentos abaixo registram diferenças e evidências desta entrega. As especificações anteriores continuam em [devnet-beta](../devnet-beta/README.md) e [meteora-mvp](../meteora-mvp/README.md).

- [Estado inicial](INITIAL_STATE.md), [Worker](CLOUDFLARE_METADATA_WORKER.md), [KV](KV_STORAGE_VALIDATION.md), [Preview](PREVIEW_DEPLOYMENT.md), [Ambiente](ENVIRONMENT_CONFIGURATION.md).
- [Phantom](PHANTOM_REAL_WALLET_TESTS.md), [Create](CREATE_TOKEN_DEVNET.md), [Buy/Sell](BUY_SELL_DEVNET.md), [Graduação](PUBLIC_GRADUATION.md), [DAMM v2](DAMM_V2_VALIDATION.md).
- [Liquidity lock](LIQUIDITY_LOCK_AUDIT.md), [RPC](RPC_RELIABILITY.md), [Dependências](DEPENDENCY_SECURITY_REVIEW.md), [Runbook](OPERATIONAL_RUNBOOK.md), [Gates](RELEASE_CHECKLIST.md).

As evidências [de navegador público](evidence/public-browser.json), [de KV remoto](evidence/public-kv-first-read.json), [da carteira](evidence/phantom-owner-and-balance.json) e dos validadores identificam explicitamente seu ambiente. Não misturar transações locais com assinaturas públicas.
