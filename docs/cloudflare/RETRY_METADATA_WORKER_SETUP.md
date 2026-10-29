# RETRY — Configuração segura do Worker de metadados

Estado em 29/10/2026: **código e validação local preparados; deploy bloqueado por autenticação, recursos e autorização do proprietário**. `wrangler whoami --json` retornou código 1, sem autenticação disponível. Nenhum Worker, KV, R2, rota ou cobrança foi criado/alterado. A URL do template é placeholder.

## Armazenamento existente

`infra/metadata-worker/` já existia. Reutilizado Worker + **KV persistente**, sem backend duplicado ou migração obrigatória para R2. Imagem/JSON não têm TTL e usam chaves SHA-256; resposta inclui URI, hash, tipo e status `persistent-kv`.

KV é eventualmente consistente: releitura imediata em outra localização pode falhar. O cliente confere o JSON e recusa lançar se a releitura falhar. Repetir upload preserva o endereço do conteúdo. Não prometer atomicidade entre imagem/JSON ou concorrência ilimitada; escritas concorrentes na mesma chave podem falhar. Falhas parciais podem deixar objetos órfãos.

Hash permite detectar alterações, mas não impede substituição/exclusão administrativa nem garante disponibilidade eterna. Persistência e imutabilidade são propriedades distintas.

## Proteções

- Access restrito a operadores de teste autorizados, protegendo **somente `/v1/metadata`**; leituras `/v1/m/*` e `/v1/i/*` permanecem públicas.
- JWT RS256 verificado por `jose`, issuer/audience exatos, assinatura via JWKS da conta e expiração/claims obrigatórios. Header e Origin sozinhos não autenticam.
- Frontend envia cookie Access apenas no POST (`credentials: include`), sem segredo compartilhado ou chave Solana no servidor.
- CORS exato e credenciado somente para origem permitida; permitir preflight sem cookie conforme [documentação](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/). Se navegador bloquear cookie cross-site, usar origem de teste compatível/same-site; não remover autenticação. Integração real pendente.
- Corpo limitado durante streaming a 3 MB; imagem PNG/JPEG/WebP até 2 MB com assinatura real; JSON objeto; limites de campos/links; rejeição de credenciais em URL, SVG/HTML e conteúdo com tipo falso.
- Binding de rate limit por identidade: 10/60s proposto. A [API oficial](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) é aproximada por localização, não um teto global ou de faturamento.
- Sem configuração/binding, upload fechado; token inválido=401, limite=429, storage indisponível=503. Sem JWT/email/chave/payload sensível em logs.

## Valores reais a fornecer

| Nome                             | Informação do proprietário                                    |
| -------------------------------- | ------------------------------------------------------------- |
| `METADATA`                       | Namespace KV exclusivo do piloto                              |
| `PUBLIC_URL`                     | Origem HTTPS real, sem caminho/credenciais                    |
| `ALLOWED_ORIGINS`                | Origem exata do preview autorizado                            |
| `ACCESS_TEAM_DOMAIN`             | `https://<equipe-real>.cloudflareaccess.com`, sem barra final |
| `ACCESS_AUDIENCE`                | AUD da aplicação Access restrita                              |
| `UPLOAD_RATE_LIMITER`            | Namespace numérico não usado por outro projeto; 10/60s        |
| `NEXT_PUBLIC_RETRY_METADATA_URL` | URL HTTPS do Worker no build, sem token                       |

O nome `retry-metadata` vem do template existente; não comprova recurso publicado. Conferir colisões na conta e escolher nome próprio se preciso. Nada autoriza sobrescrever outros Workers.

## Procedimento reproduzível

Wrangler **4.156.0**, jose **6.2.14**, Node 24/pnpm 11.25.0. Versões fixadas; build de `workerd` permitido especificamente, sem desligar a política global.

1. Revisar/autorizar recursos e limites. Proprietário executa `pnpm exec wrangler login` e confere a conta com `pnpm exec wrangler whoami` em terminal privado. Não enviar token ao agente.
2. No dashboard, conferir nome, preparar Access restrito e escolher namespace exclusivo do rate limit. Preencher variáveis públicas e namespace numérico no template. Não habilitar plano pago.
3. Conferir KV com `pnpm exec wrangler kv namespace list`. Criar apenas o necessário: `pnpm exec wrangler kv namespace create METADATA --config infra/metadata-worker/wrangler.toml`. Copiar o ID retornado para `[[kv_namespaces]]`.
4. Testar: `pnpm exec vitest run tests/metadata-worker.test.ts` e `pnpm test:metadata:bundle`. O segundo usa IDs fictícios exclusivamente em `.qa/`, sem publicar. Bundle local: aproximadamente 46,5 KiB bruto/12,9 KiB gzip; isso não mede CPU em produção.
5. Com valores reais preenchidos: `pnpm exec wrangler deploy --dry-run --config infra/metadata-worker/wrangler.toml`. Conferir conta, nome, bindings e origem. Substituir todos os placeholders.
6. **Somente após autorização de deploy:** `pnpm exec wrangler deploy --config infra/metadata-worker/wrangler.toml --strict`. Nenhuma execução sem `--dry-run` ocorreu nesta entrega. Conflito remoto exige revisão, não sobrescrita.
7. Verificar origem real: sem sessão bloqueia; operador permitido recebe 201; JSON/imagem públicos e hashes corretos; CORS/preflight, cookies, 429 e persistência após reinício. Registrar URL/data/versão antes de configurar o preview.

São mais de três comandos porque autenticação, políticas, recursos e publicação são passos distintos; não esconder provisionamento ou cobrança em um único comando.

## Custos e R2

A [tabela KV](https://developers.cloudflare.com/kv/platform/pricing/) consultada em 29/10/2026 informa Free com 1 GB, 100 mil leituras/dia e mil escritas/dia; ultrapassar quotas pode fazer operações falharem. Dois objetos por novo upload já consomem duas escritas. Monitorar consumo; não prometer gratuidade ilimitada. Conferir [Workers](https://developers.cloudflare.com/workers/platform/pricing/) e limites/elegibilidade de Access na conta.

R2 foi avaliado e não é necessário ao piloto existente. [Exige assinatura via checkout](https://developers.cloudflare.com/r2/get-started/) e pode cobrar uso além da franquia; [preços](https://developers.cloudflare.com/r2/pricing/). Não ativado, nenhum bucket criado/inventado. Migração futura depende de decisão de retenção/custo própria.

## Retenção e abuso

Conteúdos sem TTL; manter backup e disponibilidade enquanto tokens dependerem das URIs. Revisar órfãos antes de excluir e evitar apagar metadados referenciados apenas para liberar quota. Access restringe operadores e permite revogar acesso/suspender uploads em incidente. Não há moderação automática: remoção administrativa de conteúdo abusivo afeta as URIs e deve ser registrada. Logs não devem guardar tokens, emails, imagens ou payloads completos.

## Evidência e limites

Testes locais cobrem upload/hash/repetição, JSON inválido/null, tamanho, imagem, links maliciosos, CORS, falta de autorização/configuração, assinatura/issuer/audience/expiração JWT, rate limit, falha de storage e rede. KV/Access/limitador são **simulados**. Não há URL Cloudflare validada, persistência remota, cookies reais, custo real ou upload público aprovado.
