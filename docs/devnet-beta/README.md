# RETRY — Solana Devnet Beta, Etapa 7

Estado em **02/11/2026 (Brasília)**: **PARTIAL — preparação local; publicação e validação real BLOCKED**. O proprietário informou não ter Cloudflare e Phantom de testes disponíveis. A credencial GitHub gerenciada foi encontrada e validada; a branch foi publicada e o [Draft PR #10](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/10) foi aberto. Não há URL Beta ou Worker publicado nesta entrega.

A base é o PR #9, `b7a88638b4cdb13bed2fb4fd24b110786cc00f2e`. A Etapa 7 está na branch `feat/retry-devnet-beta-stage-7`, em worktree separado. Nenhum PR anterior foi mesclado e o site GitHub Pages foi preservado.

## O que mudou

- Worker e KV existentes preservados; validação de contêiner/dimensões das imagens, integridade de objetos existentes e recusa de sobrescrita divergente.
- Resposta 202 para conteúdo em propagação; cliente verifica **JSON e imagem públicos**, com hashes e limites, antes de preparar qualquer transação. Um recibo permite retomar a verificação sem repetir o POST.
- Login de uploads explícito; sessão Access separada da carteira. Gateway Pages → Worker via service binding mantém uploads na mesma origem do site.
- `build:beta`: export na raiz, aviso de teste e restrição Devnet no provider, configuração e política. Mainnet continua bloqueada em código.
- Transporte RPC existente reutilizado no SDK, com fila limitada, espaçamento, prazo, backoff e sem repetição automática de envio.
- Atualizações direcionadas de toml e uuid: auditoria de produção passou de 10 alertas para 4. Não foram suprimidos alertas.

## Navegação

1. [Branch e PRs](PR_STACK_AND_BRANCH_STRATEGY.md)
2. [Worker e KV](CLOUDFLARE_WORKER_DEPLOYMENT.md)
3. [Validação de uploads](METADATA_UPLOAD_VALIDATION.md)
4. [Preview separado](PREVIEW_DEPLOYMENT.md)
5. [Carteiras reais](REAL_WALLET_TEST_MATRIX.md)
6. [Criação e trading](CREATE_TRADE_E2E.md)
7. [Graduação pública](PUBLIC_GRADUATION_E2E.md)
8. [Evidências do bloqueio](LIQUIDITY_LOCK_EVIDENCE.md)
9. [RPC e orçamento](RPC_AND_RELIABILITY.md)
10. [Segurança](SECURITY_FINDINGS.md)
11. [Aceitação](RELEASE_CHECKLIST.md)
12. [Runbook](OPERATIONAL_RUNBOOK.md)

O [relatório consolidado](../reports/RETRY_STAGE_7_SOLANA_DEVNET_BETA_REPORT.md) distingue UNIT TEST, MOCKED BROWSER TEST, LOCAL VALIDATOR, PUBLIC DEVNET, REAL WALLET e PREVIEW E2E. Evidências antigas não são resultados novos da Etapa 7.
