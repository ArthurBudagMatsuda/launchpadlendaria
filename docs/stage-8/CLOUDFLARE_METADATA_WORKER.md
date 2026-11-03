# Metadata Worker publicado

Serviço **`retry-metadata-devnet-beta`**, versão **`4834ea3c-21ef-4608-b9c4-8756c538a13b`**, compatibilidade `2026-10-23`. Código existente preservado; sem nova base de dados ou migração para R2. [Configuração pública](../../infra/devnet-beta/public-settings.json) e [inventário remoto](evidence/cloudflare-deployment.json).

`workers.dev` e URLs de versões estão desativados. O serviço é invocado pelo binding **METADATA_SERVICE** do Pages. Sua superfície pública de leitura é `https://retry-solana-devnet-beta.pages.dev/v1/…`, não uma URL workers.dev inventada.

| Rota verificada                              | Resultado                                          |
| -------------------------------------------- | -------------------------------------------------- |
| GET `/v1/i/<sha256>` e `/v1/m/<sha256>.json` | 200, hash e MIME válidos, sem credenciais          |
| GET `/v1/metadata`                           | 401, sessão indisponível                           |
| POST `/v1/metadata`, origem correta          | 503, autorização não configurada; nenhuma gravação |
| POST com origem não aprovada                 | 403                                                |
| Hash inválido / traversal                    | 404                                                |

Access não foi ativado: a conta exigiu cartão e autorização de excedentes, recusados pelo proprietário. Issuer e AUD permanecem vazios, fazendo upload falhar fechado. Não inserir tokens em NEXT_PUBLIC nem substituir autenticação por CORS. A credencial administrativa do Wrangler fica criptografada no cofre Windows e não foi enviada ao GitHub/frontend.

Revisão: corpo limitado, tipos de imagem/dimensões, campos, URLs, hash, conflitos, erros, CORS, JWT e rate binding mantidos. **27 testes Worker** fazem parte da suíte. O runtime local testou assinatura RSA com emissor fictício e KV em disco. Isso não é um login Access remoto aprovado.

Plano Workers Free verificado no painel: US$ 0 base. Limites e ressalvas em [KV](KV_STORAGE_VALIDATION.md). O upload de tamanho máximo sob CPU Free não foi validado remotamente. Procedimento de deploy corrigido em [Runbook](OPERATIONAL_RUNBOOK.md); a preparação antiga do PR #10 não é o comando reproduzível atual.
