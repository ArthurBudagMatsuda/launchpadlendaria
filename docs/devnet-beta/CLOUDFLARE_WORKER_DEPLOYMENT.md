# Worker e KV — publicação preparada

**BLOCKED:** `wrangler whoami` confirmou ausência de autenticação. O proprietário informou não ter o acesso disponível. Não foi possível listar recursos remotos; nenhum Worker, KV, Access, Pages ou plano pago foi criado. Nomes dos templates não comprovam recursos existentes.

## Arquitetura escolhida

Browser HTTPS → Pages `/v1/metadata` protegido por Access → service binding `METADATA_SERVICE` → **Worker existente** em `infra/metadata-worker/` → KV `METADATA` e rate binding `UPLOAD_RATE_LIMITER`.

O frontend e a API aparente têm a mesma origem, evitando dependência de cookies cross-site. O Worker continua separado para manter sua rate binding e suas validações, sem migração para R2. O gateway não possui segredo de serviço e não substitui a verificação criptográfica do JWT no Worker.

Leituras `/v1/m/*` e `/v1/i/*` ficam públicas: carteiras, explorers e o cliente precisam delas sem login. Proteger o site inteiro com Access quebraria essas URIs. A aplicação Access de testadores deve proteger somente o caminho **`/v1/metadata`**, incluindo GET de login e POST de upload.

## Preparação pelo proprietário

1. Criar/acessar a conta Cloudflare pessoalmente e verificar o plano Free. Não aceitar cobrança nesta etapa.
2. Executar `pnpm exec wrangler login` e `pnpm exec wrangler whoami`. Não copiar tokens para o chat.
3. Consultar recursos existentes com `pnpm exec wrangler kv namespace list` e `pnpm exec wrangler pages project list`; verificar o nome do Worker no painel. Reutilizar apenas recursos do piloto RETRY apropriados; colisão exige revisão.
4. Criar somente o namespace necessário com `pnpm exec wrangler kv namespace create METADATA --config infra/metadata-worker/wrangler.toml`. Registrar o ID real. Escolher um namespace numérico de rate limit não utilizado.
5. Criar projeto Pages **separado**, com a branch de produção do projeto Beta definida como `feat/retry-devnet-beta-stage-7`. Isso não é a produção financeira nem o GitHub Pages existente.
6. Configurar Access restrito aos testadores aprovados na URL real do projeto, somente `/v1/metadata`, com OPTIONS liberado ao Worker. Registrar issuer e AUD reais. Nenhum segredo administrativo vai para o navegador.

## Gerar configuração a partir de valores reais

Criar um JSON local somente com estas chaves públicas: `accountId`, `kvNamespaceId`, `rateNamespaceId`, `pagesProject`, `workerName`, `publicOrigin`, `accessTeamDomain`, `accessAudience`. Usar nomes dedicados `retry-...-beta` e `retry-metadata-...-beta`. `publicOrigin` deve ser a URL estável real `https://<pagesProject>.pages.dev`, sem barra final. Não inserir API token, cookie ou chave nesse arquivo.

```sh
node scripts/prepare-devnet-beta.mjs <arquivo-publico-local.json> --check
node scripts/prepare-devnet-beta.mjs <arquivo-publico-local.json>
pnpm test:metadata:bundle
pnpm exec wrangler deploy --dry-run --config .qa/devnet-beta-config/wrangler.worker.json
```

O gerador valida valores, recusa placeholders/credenciais desconhecidas e escreve configurações em `.qa/devnet-beta-config/`. Ele **não lista, cria ou publica recursos**, portanto a inspeção da conta é obrigatória antes de usar os arquivos.

Após conferir conta, recursos exclusivos e política Access, o comando de publicação é:

```sh
pnpm exec wrangler deploy --config .qa/devnet-beta-config/wrangler.worker.json --strict
```

Este último comando **não foi executado**. O bundle dry-run passou localmente: 53,21 KiB, gzip 14,58 KiB, com bindings fictícios restritos ao teste.

## KV, limites e custo

Documentação oficial consultada em 02/11/2026: Free com 100 mil leituras/dia, mil escritas/dia, 1 GB de armazenamento e valor de até 25 MiB. O piloto aceita imagens de até 2 MiB e corpo de 3 MB. Um lançamento novo grava imagem + JSON; repetições idênticas evitam gravação quando já visíveis. Quotas podem ser atingidas antes de 500 lançamentos/dia por falhas parciais ou concorrência.

KV é eventualmente consistente, inclusive para resultados negativos em cache. A confirmação na localização do upload não comprova disponibilidade em todas as regiões. O cliente aguarda e verifica publicamente os dois objetos antes de preparar uma transação. KV não é usado como nonce, exclusividade forte ou ledger financeiro. Não há garantia de imutabilidade permanente nem disponibilidade eterna: administradores podem apagar/substituir conteúdo; hashes detectam alterações.

Fontes: [limites KV](https://developers.cloudflare.com/kv/platform/limits/), [consistência](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [preços KV](https://developers.cloudflare.com/kv/platform/pricing/), [CORS com Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/), [rate binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
