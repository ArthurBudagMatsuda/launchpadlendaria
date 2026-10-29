# RETRY — Segurança dos testes Devnet no GitHub Actions

## Auditoria em 29/10/2026

PR #8, head inicial `0c7048059782cc3b3f4e90aaf6f9e730916c0813`, origem `feat/retry-meteora-dbc-mvp`, destino `migration/retry-solana`. Draft preservado. Nenhum repository secret ou variável Actions. Apenas environment `github-pages`, não alterado.

O workflow anterior liberava o funder por dispatch **ou texto `[devnet]` no commit**. Faltavam environment protegido, SHA revisada e orçamento. Falta de SOL podia resultar em job verde com o fluxo pulado.

## Proteções preparadas

- Público somente por dispatch explícito, `run_public_devnet=true`, repositório canônico e ref exata `refs/heads/feat/retry-meteora-dbc-mvp`. Pushes executam validadores locais sem secret.
- Environment `retry-devnet` configurado por API após autorização: required reviewer ArthurBudagMatsuda, sem bypass administrativo e branch policy exata. `prevent_self_review=false` permite ao proprietário aprovar manualmente a própria execução; não houve autoaprovação pelo agente. Para separação de funções futura, habilitar prevenção e escolher outro mantenedor para disparar. **A declaração YAML sozinha não configura essas proteções.**
- `reviewed_sha` deve coincidir com `github.sha`; inputs são passados por env, sem código shell interpolado.
- `contents: read`, ações fixadas em SHA e checkout público sem credenciais persistidas. Sem `pull_request_target` nem código de forks com secret.
- Instalação pública com `--frozen-lockfile --ignore-scripts`; a chave aparece somente no passo on-chain, não na instalação nem na sonda de leitura.
- Secret ausente e saldo inicial insuficiente falham; sem fallback de faucet e sem falso verde de validação integral.
- Smoke limitado a 2 SOL brutos; graduação opt-in com escolha explícita de 12 SOL. Genesis antes da chave; Mainnet bloqueada.
- Evidências públicas, sem chave, dump de ambiente ou debug sensível. Graduação/migração não executadas são skips reais.

## Bloqueio do dispatch

`main` não contém `.github/workflows/meteora-chain.yml`. Aparecer na API por ter rodado via push não comprova dispatch. A [documentação GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) exige o arquivo na default branch para o gatilho manual.

Não foi usado push com chave, rerun privilegiado, repository_dispatch, troca da default branch ou merge para contornar. Alternativa executada com autorização: teste local com backup DPAPI, checkout revisado e chave descartável; [procedimento](RETRY_PUBLIC_DEVNET_TESTS.md). Disponibilizar o workflow na default branch exige decisão separada. `main` e site público permanecem intactos.

## Configuração administrativa e manutenção

1. **Concluído:** `retry-devnet` criado com reviewer, branch policy e sem bypass; `github-pages` preservado.
2. **Concluído:** secret inserido criptografado no environment. Nenhuma cópia criada no nível amplo do repositório. Não sobrescrever uma carteira já financiada.
3. Aprovar apenas SHA revisada: colaboradores capazes de alterar código/workflows confiáveis podem tentar exfiltrar chaves. Environment reduz o risco, não torna código arbitrário seguro. Usar chave descartável de baixo saldo, sem autoridade de produção.

Após autorização explícita, o agente criou somente `retry-devnet` e o secret criptografado, verificando reviewer/branch policy/ausência de bypass. `github-pages` e a main não foram alterados. Nenhum job privilegiado foi autoaprovado. O bloqueio de dispatch permanece; teste público pode usar a alternativa local protegida.
