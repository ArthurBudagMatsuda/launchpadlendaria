# Ambiente publicado

| Controle real do repositório                                          | Valor no build público                              |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_RETRY_DEVNET_BETA`                                       | `1`                                                 |
| `NEXT_PUBLIC_SOLANA_CLUSTER`                                          | `devnet`                                            |
| `NEXT_PUBLIC_BASE_PATH`                                               | vazio, raiz                                         |
| `NEXT_PUBLIC_RETRY_DISABLED_FEATURES`                                 | `all`                                               |
| `NEXT_PUBLIC_RETRY_METADATA_URL`                                      | vazio, upload indisponível no frontend              |
| `NEXT_PUBLIC_ENABLE_LIVE_TRADING` / `NEXT_PUBLIC_ENABLE_TOKEN_LAUNCH` | `false`, flags legadas não podem habilitar execução |
| RPC                                                                   | `https://api.devnet.solana.com`                     |
| `MAINNET_EXECUTION_ENABLED`                                           | constante `false`                                   |
| `MAINNET_APPROVAL` / config Mainnet                                   | `null` / `null`                                     |

Não foram criadas flags redundantes de operação. O modo público de leitura usa o bloqueio de funcionalidades existente; a rede também é travada pelo build Beta e por verificações nos builders. O gateway pode servir os objetos de teste, mas não é anunciado como um host de upload pronto.

Worker: PUBLIC_URL e ALLOWED_ORIGINS apontam para a origem estável Pages; Access vazio; KV e rate namespace reais. `validateBetaSettings(..., {readOnly:true})` exige Access vazio e continua recusando campos extras, IDs fictícios e origens inesperadas. O modo normal continua exigindo issuer/AUD verdadeiros.

As configurações geradas em `.qa/devnet-beta-config/{metadata,pages}/wrangler.json` não contêm credenciais. **Pages não aceita account_id no arquivo:** selecionar a conta com `CLOUDFLARE_ACCOUNT_ID`. **Pages não aceita caminho customizado de configuração:** executar com `--cwd` na pasta que contém `wrangler.json`.
