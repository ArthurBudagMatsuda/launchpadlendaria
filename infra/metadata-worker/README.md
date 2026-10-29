# Worker de metadados RETRY

Worker existente reutilizado com **KV persistente**, sem serviço duplicado. Imagem e JSON usam SHA-256; alterações podem ser detectadas, mas administradores podem apagar/substituir objetos. Persistência não garante imutabilidade ou disponibilidade eterna.

## Endpoints

| Método e caminho          | O que faz                                                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/metadata`       | Exige operador autenticado no Cloudflare Access e origem permitida. JSON ≤ 3 MB, PNG/JPEG/WebP ≤ 2 MB, validação de bytes/campos, rate binding por identidade. Responde `{uri, image, id, mediaType, storage}`. |
| `GET /v1/m/<sha256>.json` | JSON de metadados (formato Metaplex), cache imutável, CORS aberto.                                                                                                                                              |
| `GET /v1/i/<sha256>`      | Imagem, com o tipo verificado, `nosniff`, cache imutável.                                                                                                                                                       |

O mesmo conteúdo gera a mesma URI; o app confere o hash na releitura. KV é eventualmente consistente. Cache imutável não impede exclusão administrativa.

## Preparação e autorização

```bash
pnpm exec vitest run tests/metadata-worker.test.ts
pnpm test:metadata:bundle
```

O empacotamento é **dry-run local**, com IDs fictícios, sem criar recursos. Wrangler 4.156.0 e jose 6.2.14 estão fixados. JWT RS256 é verificado com issuer/audience/expiração e JWKS da conta; Origin não autentica. Binding de rate limit é aproximado por localização, não teto de gastos.

**Não implantado nesta etapa:** falta autenticação Cloudflare, IDs/domínio/Access reais e autorização do proprietário. [Procedimento completo, custos e condições de publicação](../../docs/cloudflare/RETRY_METADATA_WORKER_SETUP.md). Não sobrescrever recursos existentes nem habilitar cobrança.

Frontend não contém segredo compartilhado nem chave Solana. A sessão Access autoriza o POST; GETs são públicos. Falta de autorização/configuração fecha uploads.

## Testes

`tests/metadata-worker.test.ts` usa KV/limitador/Access simulados, com assinaturas JWT verificadas: upload, hash, repetição, origem, autenticação, expiração/issuer/audience, campos, imagens, limite, JSON/tamanho e falhas de storage/rede. O e2e on-chain mantém o Worker em processo. Nenhum desses testes comprova Cloudflare implantado.

## Limites

Não há moderação automática nem garantia de quota global. Access restringe o piloto a operadores autorizados. Quotas, retenção, cookies reais, persistência remota e origem final precisam ser conferidos antes da publicação. Nenhuma operação Mainnet é liberada.
