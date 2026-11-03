# Preview separado em Cloudflare Pages

**URL atual: não publicada.** Conta Cloudflare indisponível. O endereço do GitHub Pages permanece inalterado e continua na versão Base.

## Build dedicado

```sh
pnpm build:beta
```

Gera `out/` na raiz do domínio, sem `/launchpadlendaria`. Define Devnet, aviso experimental, execução Mainnet bloqueada e `NEXT_PUBLIC_RETRY_METADATA_URL=/`. A barra significa **origem HTTPS atual**, não uma URL externa inventada. A URI devolvida pelo Worker usará o hostname estável real configurado em `PUBLIC_URL`.

O export inclui `_worker.js` (gateway para o Worker existente), `_routes.json` limitado a `/v1/*`, `_headers` e `beta-version.json` com commit-base do build, indicador de working tree suja, data e rede. Não publicar um artefato sujo como versão revisada. Os testes locais intermediários podem carregar esse indicador enquanto o trabalho está em andamento.

O build recusa cluster não Devnet e basePath não vazio. As configurações antigas `build` e `build:pages` continuam disponíveis; o workflow de produção GitHub Pages não foi alterado.

## Publicação depois da configuração do Worker

Usar os arquivos gerados pelo [procedimento do Worker](CLOUDFLARE_WORKER_DEPLOYMENT.md). Conferir que o projeto Pages é exclusivo da Beta e que sua production branch é a branch Etapa 7, nunca a `main` Base.

```sh
pnpm exec wrangler pages project list
pnpm exec wrangler pages project create <projeto-beta-real> --production-branch feat/retry-devnet-beta-stage-7
pnpm exec wrangler pages deploy out --config .qa/devnet-beta-config/wrangler.pages.json --project-name <projeto-beta-real> --branch feat/retry-devnet-beta-stage-7
```

Não executar `project create` se o projeto apropriado já existir. Estes comandos não foram executados nesta entrega. A URL precisa vir da resposta real da Cloudflare, não deste documento.

Access deve proteger apenas `/v1/metadata`. Usar a URL **estável** do projeto para lançar; aliases efêmeros de deployments não entram automaticamente no allowlist de origem nem substituem o hostname das URIs persistentes. O gateway encaminha o JWT injetado no edge; o Worker verifica issuer, AUD e assinatura.

## Verificação remota obrigatória

Abrir a URL real, conferir `beta-version.json`, rede Devnet, aviso, assets, rotas e ausência de erro de hidratação. Testar login no link Authorize uploads, POST negado sem sessão, upload aprovado com sessão e GETs públicos em janela sem login. Só então executar o roteiro de carteira. Não chamar uma verificação local de PREVIEW E2E.

Fontes: [Next estático em Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/), [service bindings](https://developers.cloudflare.com/pages/functions/bindings/#service-bindings).
