# RETRY — Solana Devnet: preview público de leitura (Etapa 8)

Launchpad Solana com **Meteora DBC → DAMM v2**, frontend Next.js/React e Wallet Standard. A implementação inclui criar tokens SPL, negociar na curva, graduar, verificar posições de liquidez e negociar após graduação.

**Estado em 03/11/2026:** [preview público de leitura online](https://retry-solana-devnet-beta.pages.dev/), commit publicado `1c5127a`. Worker e KV publicados, leituras públicas por hash verificadas. O proprietário escolheu não ativar o cadastro Cloudflare Access que exige cartão; uploads e todas as transações do preview estão desativados. Mainnet financeira permanece desabilitada em código.

O [site GitHub Pages](https://arthurbudagmatsuda.github.io/launchpadlendaria/) ainda serve a `main` histórica em Base. Ele não foi substituído. A evolução Solana está no stack Draft **#6 → #8 → #9 → #10 → #11**, sem merges automáticos.

Entrega atual: [Draft PR #11](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/11), [documentação Etapa 8](docs/stage-8/README.md) e [relatório completo](docs/reports/RETRY_STAGE_8_PUBLIC_DEVNET_BETA_REPORT.md). A conexão/refresh/Portfolio/reconexão da Phantom foram confirmados pelo proprietário, com 0 SOL verificado por RPC; não houve assinatura ou transação nova nessa sessão. Beta transacional pública e graduação permanecem pendentes. A [Etapa 7](docs/reports/RETRY_STAGE_7_SOLANA_DEVNET_BETA_REPORT.md) preserva o histórico da preparação.

## Desenvolver e verificar

Node 24+ e pnpm 11.25.0, com lockfile e SDKs fixados.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test --maxWorkers=1 --pool=threads
pnpm test:metadata:bundle
pnpm test:e2e --workers=2
pnpm test:beta:e2e
pnpm build
```

Dev local em `http://127.0.0.1:3000`. Os testes de navegador constroem exports diferentes e devem rodar em sequência. `threads` evita o timeout de inicialização do pool forks observado neste Windows.

## Builds e metadados

- `pnpm build`: aplicativo Next.js para hospedagem Node.
- `pnpm build:pages`: export histórico sob `/launchpadlendaria`.
- `pnpm build:beta`: export dedicado na raiz, Devnet-only, aviso de teste, gateway Pages e metadados na mesma origem HTTPS.

O Worker existente (`infra/metadata-worker/`) mantém imagens/JSON em KV por hash, com Access para testadores e rate limit. O cliente verifica ambos os objetos antes de preparar a transação, aguarda propagação limitada e permite retomar pelos GETs. Persistência não é garantia de imutabilidade administrativa ou disponibilidade eterna.

O build Beta define `NEXT_PUBLIC_RETRY_METADATA_URL=/`; a URL real será a origem estável do projeto Cloudflare isolado, após sua criação. Configuração pública real do Worker e Access é obrigatória. Sem ela, uploads falham fechados. Não inserir segredos em `NEXT_PUBLIC_*` ou arquivos versionados.

## Funcionalidades e limites

Discover lista pools da config RETRY; Token mostra estado, quotes, histórico e graduação; Create preserva rascunho e separa upload, simulação e assinatura; Portfolio mostra saldos/posições verificáveis. Não existe indexador completo, moderação automática ou promessa de histórico integral.

Phantom, Solflare e Backpack são descobertas pelo Wallet Standard. Testes simulados não comprovam compatibilidade com uma extensão real. Nenhuma assinatura de Phantom real ou graduação pública foi executada nesta etapa. O saldo público do funder histórico foi consultado sem chave; os dados e bloqueios estão no relatório.

Dois upgrades transitivos direcionados reduziram a auditoria de dez para quatro alertas; bigint-buffer e stream-json continuam documentados, sem supressão. Uma revisão de implementação não equivale a auditoria independente.

## Documentação atual

- [Relatório completo da Etapa 7](docs/reports/RETRY_STAGE_7_SOLANA_DEVNET_BETA_REPORT.md)
- [Índice Devnet Beta](docs/devnet-beta/README.md)
- [Publicação Worker/KV/Access](docs/devnet-beta/CLOUDFLARE_WORKER_DEPLOYMENT.md)
- [Preview separado](docs/devnet-beta/PREVIEW_DEPLOYMENT.md)
- [Runbook](docs/devnet-beta/OPERATIONAL_RUNBOOK.md)
- [Aceitação](docs/devnet-beta/RELEASE_CHECKLIST.md)
- [Segurança e dependências](docs/devnet-beta/SECURITY_FINDINGS.md)
- [Implementação Meteora e documentação técnica](docs/meteora-mvp/README.md)

Os relatórios das etapas anteriores e documentos Base permanecem como histórico. A configuração Mainnet não foi aprovada; nenhuma instrução deste README autoriza fundos reais, merge ou substituição do site público.
