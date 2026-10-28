# Worker de metadados RETRY

Guarda o JSON de metadados e a imagem de cada token lançado pela RETRY, endereçados pelo SHA-256 do conteúdo. Existe porque o GitHub Pages não executa servidor. Roda no plano gratuito da Cloudflare (Workers + KV).

## Endpoints

| Método e caminho          | O que faz                                                                                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/metadata`       | Recebe `{name, symbol, description, image (data URL PNG/JPEG/WebP ≤ 2 MB), website?, twitter?, telegram?}`. Aceita só origens de `ALLOWED_ORIGINS`, corpo ≤ 3 MB, revalida os campos e os bytes da imagem, aplica `UPLOADS_PER_HOUR` por IP. Responde `{uri, image}`. |
| `GET /v1/m/<sha256>.json` | JSON de metadados (formato Metaplex), cache imutável, CORS aberto.                                                                                                                                                                                                    |
| `GET /v1/i/<sha256>`      | Imagem, com o tipo verificado, `nosniff`, cache imutável.                                                                                                                                                                                                             |

O mesmo conteúdo sempre gera a mesma URI. Uma URI nunca passa a apontar para outro conteúdo, e o app confere o hash ao ler de volta.

## Implantação (conta Cloudflare do proprietário)

```bash
cd infra/metadata-worker
npx wrangler login
npx wrangler kv namespace create METADATA     # copie o id para wrangler.toml
npx wrangler deploy                            # imprime a URL pública
```

Depois:

1. Em `wrangler.toml`, ajustar `PUBLIC_URL` para a URL impressa e `ALLOWED_ORIGINS` para a origem do site (`https://arthurbudagmatsuda.github.io`), e implantar de novo.
2. No build do GitHub Pages, definir `NEXT_PUBLIC_RETRY_METADATA_URL` com a mesma URL (https).

Nenhuma chave secreta é necessária: o Worker não assina nada e não guarda dados pessoais além do contador por IP (hash, expira em ~1 hora).

## Testes

`tests/metadata-worker.test.ts` roda o Worker com um KV em memória e o cliente real do app (`src/lib/meteora/metadata-upload.ts`): upload, leitura de volta, idempotência, origem recusada, campos inválidos, imagem com tipo falso, limite por IP e host que devolve conteúdo diferente do hash. O e2e on-chain no navegador usa o mesmo Worker em processo.

## Limites

O limite por IP é uma barreira simples contra spam, não uma garantia. Não há moderação de conteúdo. Para a Mainnet, avaliar moderação de imagens e nomes e um painel para bloquear conteúdo abusivo (a URI on-chain é imutável, mas o Worker pode parar de servir um arquivo).
