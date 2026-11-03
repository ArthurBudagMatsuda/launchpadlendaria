# Runbook da Etapa 7

## 1. Preparar contas e revisar código

O proprietário deve criar/acessar Cloudflare e preparar Phantom de teste pessoalmente. A entrega GitHub usou credencial já gerenciada, sem exposição do token. Não enviar segredos. Abrir o worktree da Etapa 7, revisar diff/relatório e preservar o stack. Usar Node 24+ e pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test --maxWorkers=1 --pool=threads
pnpm test:metadata:bundle
pnpm test:e2e
pnpm test:beta:e2e
pnpm build
```

Os testes de navegador fazem builds diferentes na mesma pasta `out`; executá-los **em sequência**, não simultaneamente. O modo threads evita o prazo de inicialização de forks observado neste Windows. Não mascara falhas de testes.

## 2. Publicar somente os recursos Beta

Seguir [Worker](CLOUDFLARE_WORKER_DEPLOYMENT.md), conferir recursos existentes, plano Free, KV e Access de testadores. Gerar configs com valores reais; dry-run; publicar Worker e Pages separados da produção. Não colocar segredo no JSON público nem em NEXT_PUBLIC.

## 3. Validar armazenamento antes de assinar

Na URL estável real: confirmar versão/rede/aviso; usar Authorize uploads; conferir POST sem sessão recusado; enviar imagem e JSON; ler os dois sem login e após novo acesso. Conferir hashes, MIME e cache. Se continuar propagando, aguardar e retomar a revisão, sem assinar.

## 4. Executar operações pelo proprietário

Seguir [matriz de carteira](REAL_WALLET_TEST_MATRIX.md) e [Create/Trade](CREATE_TRADE_E2E.md). O proprietário confirma cada assinatura na Phantom. Operações são Devnet; não mover SOL de Mainnet nem usar carteira pessoal com ativos valiosos.

Antes de graduação, revisar saldo/reserva/custo e autorizar orçamento de teste. Seguir [graduação](PUBLIC_GRADUATION_E2E.md) e [bloqueio](LIQUIDITY_LOCK_EVIDENCE.md). Não tentar novamente uma migração confirmada.

## 5. Incidentes

- Upload 401/403: conferir sessão/política/origem/AUD; não retirar autenticação.
- 202/404 em conteúdo novo: aguardar propagação e verificar ambos os objetos; não marcar sucesso público antecipadamente.
- 409/503 de integridade: suspender uploads, conferir o objeto/backup com o proprietário; não substituir bytes silenciosamente.
- RPC 429: aguardar e reduzir tráfego. Sem reenvio financeiro cego.
- Confirmação perdida: reconciliar assinatura e contas antes de nova operação.
- Abuso/quota: revogar operador/suspender upload via Access. Não apagar metadados já referenciados só para liberar espaço.

## 6. Entregar no GitHub

A branch exclusiva já foi publicada e o Draft PR #10 tem base no PR #9. Conferir os checks do último HEAD, as evidências sanitizadas e os gates pendentes. Para alterações futuras, repetir essa revisão. Não aprovar automaticamente ambientes, mesclar PRs ou substituir o site antigo.
