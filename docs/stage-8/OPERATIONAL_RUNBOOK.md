# Runbook reproduzível — leitura pública

Node 24+, pnpm 11.25.0, worktree da Etapa 8. Não alterar o site GitHub Pages antigo.

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test --maxWorkers=1 --pool=threads
pnpm test:metadata:runtime
pnpm test:e2e
pnpm test:beta:e2e
```

Executar os testes de navegador **em sequência**, pois ambos substituem `out`. Neste Windows, o download do Chromium expirou; `PLAYWRIGHT_CHANNEL=chrome` usa o Chrome instalado em perfil de automação novo. No CI o Chromium oficial foi instalado normalmente. Não usar o perfil da carteira pessoal.

A sessão Wrangler atual usa credencial criptografada e chave no Windows Credential Manager. Não executar `auth token` imprimindo saída no terminal. O inspetor versionado captura o token internamente e só escreve metadados públicos. Permissões aprovadas: account/user read, Workers, Workers Scripts, KV e Pages write; nenhuma permissão para ativar planos pagos foi concedida.

```sh
node scripts/prepare-devnet-beta.mjs infra/devnet-beta/public-settings.json --read-only
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config .qa/devnet-beta-config/metadata/wrangler.json
```

Antes de publicar, conferir conta Free, inventário, IDs e branch. Definir `CLOUDFLARE_ACCOUNT_ID` com o ID do arquivo público. No PowerShell: `$env:CLOUDFLARE_ACCOUNT_ID='7ae26dc0c12bbcb5f22f44482a493a07'`; `$env:NEXT_PUBLIC_RETRY_DISABLED_FEATURES='all'`.

```sh
pnpm build:beta
node node_modules/wrangler/bin/wrangler.js deploy --config .qa/devnet-beta-config/metadata/wrangler.json
node node_modules/wrangler/bin/wrangler.js pages deploy <caminho-absoluto-do-out> --cwd .qa/devnet-beta-config/pages --project-name retry-solana-devnet-beta --branch feat/retry-stage-8-public-devnet-beta --commit-hash <SHA-do-build-revisado> --commit-dirty false
node scripts/probe-beta-storage.mjs verify
pnpm test:beta:public-readonly <SHA-do-deployment>
```

Não recriar projeto/namespace existentes. A criação inicial do projeto precisou do modo Pages direto `--force` porque esta versão tentou delegar projeto novo para Workers. O próprio Wrangler informou que **não é necessário repetir esse flag** após a criação. Ele não é force-push. Pages rejeita `account_id` e `--config` customizado; os comandos acima já corrigem esses bloqueios observados.

Os dois objetos de sonda já existem; `probe-beta-storage` só prepara arquivos locais ou faz GETs, nunca grava remotamente. Não repetir seed administrativa sem conferir chaves/conteúdo. Não apagar metadados referenciados por tokens para limpar quota.

Incidentes: 429 → reduzir tráfego/aguardar; 404 novo → propagação sem reenvio; hash/MIME divergente → suspender uso; upload 503 é esperado neste modo. Não remover autenticação para obter upload funcional. Não ativar cartão/cobrança, Mainnet ou transações para testar a versão de leitura. Qualquer Beta transacional futura exige nova revisão, build e testes com aprovação humana das assinaturas.
