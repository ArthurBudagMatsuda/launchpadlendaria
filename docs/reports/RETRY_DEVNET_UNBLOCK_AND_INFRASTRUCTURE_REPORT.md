# RETRY — Desbloqueio Devnet e infraestrutura

Data: **29/10/2026**, referência de negócio America/Sao_Paulo. Horários e slots nas evidências são UTC/on-chain. Repositório: ArthurBudagMatsuda/launchpadlendaria. [PR #8](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/8), mantido em Draft.

## 1. Resumo executivo

**A carteira financiadora, o secret protegido e o smoke público Meteora foram desbloqueados.** Após autorização explícita, foi criada carteira descartável, o proprietário solicitou SOL de teste e a execução real em Devnet terminou com **8 testes aprovados e 2 skips** de graduação/migração. Config, mint, pool, compra, venda, fees e refunds têm evidência pública.

O Worker existente foi protegido e empacotado localmente; não foi implantado. Phantom verdadeira continua pendente. Preview local disponível, sem publicação externa, merge ou mudança da Mainnet. A etapa não é aprovação de produção.

## 2. Estado inicial do PR #8

Head inicial `0c7048059782cc3b3f4e90aaf6f9e730916c0813`, origem `feat/retry-meteora-dbc-mvp`, destino `migration/retry-solana` em `a2d1748`. PR aberto, Draft, mergeable/clean na inspeção. CI anterior de qualidade [40925230342](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40925230342) e de validadores [40925220693](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40925220693) apareciam aprovados; isso foi referência histórica, não substituto dos novos testes.

Repository secrets e variáveis Actions vazios; único environment era `github-pages`. Config RETRY Devnet/Mainnet nula. Worker + KV já implementados, sem deploy. Nenhum trabalho anterior foi refeito ou removido. Worktree/branch isoladas preservam os demais checkouts e o documento Word local do proprietário.

## 3. Dependências identificadas

Prioridade 1 dependia de keypair descartável, financiamento, escopo seguro do secret e execução confiável. O workflow manual ainda não existe na default branch. A alternativa local resolveu a execução pública sem alterar `main`.

Prioridade 2 depende de login/conta Cloudflare, IDs/domínio/Access e autorização de recursos/deploy. Prioridade 3 depende de conta Phantom exclusiva, operador e origem de preview adequada. Os bloqueios foram tratados nessa ordem.

## 4. Carteira financiadora

Endereço público: **`3r8gEonYHrXEao85oFAu2UzVgT1KsxFmWUZLWBd8G5B3`**. Exclusiva de testes CI/Devnet, sem carteira pessoal, authority ou treasury de produção. Não foi importada na Phantom.

Chave criada após o usuário autorizar: “Sim, automatize a carteira e o secret”. Isso substituiu a exigência inicial de geração manual apenas para essa carteira descartável. [Estado público](../devnet/evidence/DEVNET_WALLET_STATUS.json).

## 5. Procedimento seguro de geração

`scripts/manage-devnet-funder.mjs provision` gera keypair em processo, protege backup com **Windows DPAPI CurrentUser** e sela o JSON com libsodium para o GitHub. Nem chave nem credencial GitHub aparecem em stdout, argumentos, `.env` ou repositório. A capacidade DPAPI foi verificada com texto inofensivo antes da geração.

Backup cifrado fica fora dos checkouts: `%USERPROFILE%\retry-devnet-private\launchpadlendaria-ci\keypair.dpapi`. Depende da identidade Windows; não deve ser apagado nem confundido com exportação de Phantom. O helper recusa substituir secret/carteira/environment existentes. A alternativa manual `create-devnet-funder.mjs` foi preparada/sintaticamente validada, **não executada**. [Guia](../devnet/RETRY_DEVNET_FUNDER_SETUP.md).

## 6. Formato esperado do secret

`tests/chain/devnet-safety.ts`: array JSON de **64 inteiros de 0 a 255**, ou base58 decodificando keypair completo. Formato provisionado: JSON. Seed phrase e seed de 32 bytes são recusadas. Coerção de bytes inválidos e mensagens JSON que ecoariam a entrada foram eliminadas.

O genesis é conferido antes de ler a chave. Existência no GitHub foi verificada **por metadados**, sem recuperar o conteúdo. A execução local comprovou a chave protegida equivalente; o uso/decriptação do secret por um job Actions público permanece não exercitado devido ao bloqueio de dispatch.

## 7. Configuração GitHub Actions

Criado somente environment **`retry-devnet`**, com secret `RETRY_DEVNET_FUNDER`, reviewer `ArthurBudagMatsuda`, branch policy exata `feat/retry-meteora-dbc-mvp`, sem bypass administrativo. `github-pages` permaneceu intacto. [Evidência de configuração](../devnet/evidence/GITHUB_ENVIRONMENT_STATUS.json).

`prevent_self_review=false` permite revisão manual pelo próprio proprietário; o agente não aprovou jobs. Separação estrita de funções futura requer outro mantenedor disparando a execução e prevenção de auto-revisão. Nenhum secret amplo de repositório foi criado.

## 8. Proteções aplicadas ao workflow

Removido disparo privilegiado por texto `[devnet]` em push. Job público exige dispatch, opção explícita, repositório canônico, ref fixa, SHA revisada igual à selecionada e environment protegido. Inputs não são interpolados como shell.

`GITHUB_TOKEN` com `contents: read`; actions fixadas em SHA; checkout público sem credenciais persistidas; instalação congelada com `--ignore-scripts`; chave disponível só no passo on-chain. Sem `pull_request_target`, fork com secret, dump de ambiente ou debug sensível.

O processo financiado chama a entrada instalada do Vitest diretamente por Node, evitando auto-instalação/lifecycle do gerenciador enquanto a chave está no ambiente. A entrada foi verificada localmente; o fluxo financeiro permanece o mesmo validado no smoke.

Secret/saldo inicial ausentes agora falham explicitamente. Smoke limita transferências brutas do funder a 2 SOL por execução; graduação exige opt-in e teto explícito de 12 SOL. Modo local só aceita loopback; modo desconhecido é recusado. Skips de graduação/migração não são contados como aprovação. [Detalhes](../devnet/RETRY_GITHUB_ACTIONS_SECURITY.md).

## 9. Estado do financiamento Devnet

Uma solicitação oficial `requestAirdrop` de 2 SOL recebeu **HTTP 410**, sem signature. Não foi repetida nem contornada. A seção “I am an AI Agent” no faucet web orientava agentes a usar alternativas programáticas, portanto o formulário não foi submetido pelo agente. Rust/Cargo não estavam disponíveis para a alternativa PoW; não houve instalação/mineração longa ou criação de identidades.

O proprietário informou ter solicitado o faucet; o RPC confirmou **2,5 SOL de teste recebidos**. Não foi solicitada a signature do pedido humano nem presumida uma assinatura inexistente. [Registro inicial](../devnet/evidence/INITIAL_WALLET_STATUS.json), [guia oficial de alternativas](https://solana.com/developers/cookbook/development/airdrops-and-faucets).

## 10. Saldo público verificado

| Momento             |      Lamports | SOL de teste |      Slot |
| ------------------- | ------------: | -----------: | --------: |
| Após financiamento  | 2.500.000.000 |  2,500000000 | 516518391 |
| Após tentativa 1    | 2.372.300.840 |  2,372300840 | 516519597 |
| Após smoke aprovado | 2.013.648.909 |  2,013648909 | 516521315 |

RPC: `https://api.devnet.solana.com`; genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. Consumo líquido total observado: **0,486351091 SOL de teste**, incluindo rent/reserva/fees, não apenas tarifa de rede. Houve 1,4 SOL de funding por execução, com refunds; teto bruto aplicado individualmente a cada execução. Não há gasto de SOL Mainnet.

## 11. Testes Devnet executados

Leitura pública inicial confirmou DBC, DAMM v2, Locker e Metaplex executáveis, config pública DAMM v2 e rent float de 99.226.635.387 lamports no slot `516510175`. [Evidência](../devnet/evidence/PUBLIC_DEVNET_READINESS.json).

Tentativa 1: **5 passaram, 3 falharam, 2 skips**. Config e lançamento reais confirmados; compra falhou com RPC/HTTP 429/fetch indisponível. Os dois erros seguintes de venda decorreram da ausência da compra. Refunds foram confirmados. [Falha preservada](../devnet/evidence/SMOKE_ATTEMPT_1_RPC_FAILURE.json).

Correção no transporte de **testes**, sem mudar economia: fila de 700 ms, repetição limitada de leituras, respeito a Retry-After e nenhum retry de envio na camada de transporte. Três regressões focadas passaram. Repetição pública no código `4233212`: **8 passaram, 2 skips**, em 120,71 s, reutilizando a config já criada. Criação SPL/DBC, compra, venda, excesso de saldo, slippage, saque e listagem passaram. [Evidência aprovada](../devnet/evidence/SMOKE_DEVNET_CONFIRMED.json).

## 12. Testes pendentes

Graduação e migração DAMM v2 **públicas** não foram autorizadas/executadas no smoke. Também pendentes: Worker remoto, persistência/cookies/CORS na origem real, Phantom oficial e preview externo. A indisponibilidade de dispatch não foi resolvida por merge ou enfraquecimento do job.

## 13. Configuração Meteora verificada

SDK oficial DBC **2.0.0**, web3.js **1.98.4**, SPL Token **0.4.15**. Parâmetros existentes preservados: 1 bilhão de tokens, 9 decimals, SOL/WSOL, fee 100 bps, distribuição 0,2% protocolo/0,4% criador/0,4% parceiro, threshold **10 SOL**, migração DAMM v2 e 50%+50% de liquidez permanentemente travada como configuração candidata.

Config criada e registrada: `8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N`; fee claimer efêmero `DbvhT2t9yBY4nNsXZLjDhf7Aa13x3TsA83RdxQDhNAqD`; confirmação no slot `516519451`, horário `2026-10-29T19:26:06Z`. `configMismatches` passou; supply, autoridades nulas e metadados foram conferidos nos testes reais. Mainnet continua com config nula e constante `MAINNET_EXECUTION_ENABLED=false`.

IDs DBC `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` e DAMM v2 `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG` conferem com o SDK e as contas executáveis Devnet. O registro não altera a curva. [Bytes públicos da config](../devnet/evidence/PUBLIC_CONFIG_ACCOUNT.json).

## 14. Transações confirmadas

As cinco signatures abaixo foram consultadas novamente por `getSignatureStatuses(searchTransactionHistory=true)`: **finalized, sem erro**. [Confirmações independentes](../devnet/evidence/CHAIN_CONFIRMATIONS.json).

| Operação                |      Slot | Signature                                                                                  |
| ----------------------- | --------: | ------------------------------------------------------------------------------------------ |
| Config, tentativa 1     | 516519451 | `5rKrTaNcbnwmysG9VpHRyeQ9zrbkY6cU2UUYckcNeKvv1TcnGWvvqovf19B2jR1F76G2VgastRkkbbNSrnXeasPK` |
| Criar + primeira compra | 516520928 | `3nh1iy8tmTqZRDTdtBvKFTUUC4hPCLXXBrVB4QXhB9hJqJFANisp2ZDKDqAHq4h8ENsUQo9vqj8DBo9cVEWSaMr1` |
| Comprar 0,5 SOL         | 516521010 | `4dFMi1QJuyTuvVJfBPJPS4PG9ufrpcLGkDGw9xcEuGahpDosesTAuQcyaeoFmxib6Vmjm2Fg6TRsuytRXFmRkCQF` |
| Vender metade           | 516521097 | `37r53BzUER16sRQK8nuj1jBL64PLbfktbZnk22NQWvviLP3ud6UNTqT8HpvypTxydMUS7z1yJj8q6zmUobVs6hLn` |
| Sacar fees do criador   | 516521237 | `3BcbUyn3GaZv7TUgKZcV6cHzDBTnVJZ3BcYvDt22wyddhQaeKoJAjFTh4oXxSPVmCA3E9BHY1WB8DkaoCCAjWwiT` |

Config observada custou 5.984.080 lamports na primeira execução; lançamento simulou débito de 122.070.080 + fee de rede 10.000 lamports, incluindo primeira compra de 0,1 SOL. Compra de 0,5 SOL teve fee de negociação 5.000.000 lamports (1%). Deltas/fees de simulação são identificados como tais no JSON; consumo observado do funder está na seção 10. As tarifas históricas do PR não foram copiadas como custos atuais.

## 15. Links do Solana Explorer

- [Config Devnet](https://explorer.solana.com/address/8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N?cluster=devnet).
- [Mint aprovado no smoke](https://explorer.solana.com/address/6WwkimyJfjEbeh7wSXYRZ6e26pmEyPLWwTUt9fTY1nUz?cluster=devnet).
- [Pool DBC aprovada](https://explorer.solana.com/address/2Lu2YaaHJLibHxzYG45b2y8YTyXhyGS2xqb23fZJhRpd?cluster=devnet).
- [Criação](https://explorer.solana.com/tx/3nh1iy8tmTqZRDTdtBvKFTUUC4hPCLXXBrVB4QXhB9hJqJFANisp2ZDKDqAHq4h8ENsUQo9vqj8DBo9cVEWSaMr1?cluster=devnet), [compra](https://explorer.solana.com/tx/4dFMi1QJuyTuvVJfBPJPS4PG9ufrpcLGkDGw9xcEuGahpDosesTAuQcyaeoFmxib6Vmjm2Fg6TRsuytRXFmRkCQF?cluster=devnet), [venda](https://explorer.solana.com/tx/37r53BzUER16sRQK8nuj1jBL64PLbfktbZnk22NQWvviLP3ud6UNTqT8HpvypTxydMUS7z1yJj8q6zmUobVs6hLn?cluster=devnet).

As evidências também contêm signatures dos fundings/refunds e o token/pool da primeira tentativa. Nenhuma signature foi inventada para graduação ou Worker.

## 16. Graduação e possíveis bloqueios

Threshold efetivo 10.000.000.000 lamports. O teste calcula top-up de `threshold - quoteReserve + 0,5 SOL - saldo do trader`. Precisa de autorização separada e orçamento/saldo suficientes; 12 SOL brutos é teto preparado, não garantia de suficiência ou custo.

Não alterar curva para fazer teste passar. Verificar config DAMM v2 `Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp`, rent float e estado da pool. Só concluir após confirmar pool DAMM v2/posições/LP locks. Keeper de Mainnet não comprova automação Devnet; procedimento manual do migrador permanece aplicável. **Nenhuma graduação pública nesta entrega.**

## 17. Cloudflare Worker

Reutilizada implementação `infra/metadata-worker`, com JWT Cloudflare Access RS256 verificado por `jose` **6.2.14**, issuer/audience/claims, JWKS restrito à conta e cache limitado. Upload exige operador de piloto autorizado; frontend não carrega segredo compartilhado. Origin não autentica.

Corpo limitado em streaming, imagem com tamanho/tipo/assinatura, JSON objeto, links validados, rate binding, CORS exato credenciado e erros controlados. GETs de conteúdo permanecem públicos. `wrangler whoami --json` retornou ausência de autenticação; nenhum recurso Cloudflare foi criado/alterado.

## 18. Armazenamento de metadados

**KV persistente**, já usado pelo PR, sem TTL de objetos. PNG/JPEG/WebP até 2 MB e JSON de requisição até 3 MB. Name, symbol, description, image, website, X e Telegram aceitos após validação. Retorno: URI, imagem, identificador hash, mediaType e `persistent-kv`.

KV tem consistência eventual e gravações não atômicas entre objetos. A aplicação confere hash do JSON e recusa lançamento se a releitura falhar. Hash não impede remoção/substituição administrativa. Retenção, backup e resposta a abuso estão no [guia](../cloudflare/RETRY_METADATA_WORKER_SETUP.md).

## 19. R2 e eventuais custos

R2 avaliado, não necessário para reutilizar o piloto KV; nenhum bucket criado. [R2 exige assinatura/checkout](https://developers.cloudflare.com/r2/get-started/) e pode cobrar além da franquia. [KV Free](https://developers.cloudflare.com/kv/platform/pricing/) tem quotas finitas: 1 GB, 100 mil leituras/dia e mil escritas/dia na consulta desta data. Sem promessa de gratuidade ilimitada, sem habilitação de cobrança. Conferir Workers/Access na conta antes de autorizar recursos.

## 20. Variáveis de ambiente

`RETRY_DEVNET_FUNDER`: somente passo confiável/ambiente de teste, nunca frontend. `RETRY_CHAIN_MODE=devnet`, RPC oficial, `RETRY_DEVNET_MAX_SPEND_SOL=2`, `RETRY_CHAIN_GRADUATION=0` no smoke. A chave protegida é repassada ao processo, não por argumento.

Worker: binding `METADATA`, `UPLOAD_RATE_LIMITER`, `PUBLIC_URL`, `ALLOWED_ORIGINS`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE`. Estes últimos são configuração pública de identidade, não tokens secretos. Build: `NEXT_PUBLIC_SOLANA_CLUSTER=devnet`, `NEXT_PUBLIC_RETRY_METADATA_URL` só depois de host real autorizado. Placeholders não são URLs validadas.

## 21. Comandos de configuração

```sh
pnpm install --frozen-lockfile
node scripts/manage-devnet-funder.mjs status
pnpm test:devnet:readiness
node scripts/manage-devnet-funder.mjs run-smoke
pnpm exec vitest run tests/metadata-worker.test.ts
pnpm test:metadata:bundle
```

O smoke assina **somente Devnet** e exige checkout limpo, saldo e autorização já descritos. Não executar para “ver se funciona” na Mainnet. Configuração/implantação Cloudflare e alternativa manual estão nos guias; não reduzir passos ocultando login, políticas, recursos ou custos.

## 22. Testes do Worker

**16 testes locais**: upload/hash/releitura/repetição, CORS, assinatura e tipo de imagem, tamanho, JSON inválido/null, links maliciosos, falta de config/autorização, token expirado/issuer/audience/assinatura inválidos, rate limit, storage e rede. Assinaturas JWT são verificadas de fato; **JWKS, KV e rate binding são simulados**.

Wrangler **4.156.0** empacotou o código por `deploy --dry-run`, com IDs fictícios de teste e sem upload: aproximadamente **47 KiB bruto/13 KiB gzip**. Isso não mede CPU/quota nem comprova Cloudflare publicado. Nenhuma URL remota funcional foi declarada.

## 23. Phantom real

**Não testada.** CI keypair e assinatura programática não equivalem a extensão. O operador não disponibilizou uma Phantom exclusiva de teste. Não houve instalação/importação, autorização, seed ou assinatura na extensão. [Matriz específica com 15 casos](../testing/RETRY_PHANTOM_REAL_WALLET_TESTS.md). Solflare/Backpack reais continuam pendentes na matriz geral.

## 24. Preview da aplicação

Preview **local** `http://127.0.0.1:4188/launchpadlendaria/`, processo ligado a loopback e HTTP 200 verificado. Depende de o processo permanecer ativo. É a implementação Solana, sem URL pública nova. O site público existente não foi substituído.

`pnpm build:pages` mantém export e base path. Registrar config exigiu atualizar mocks de consultas de pools/holdings no browser; a lista explícita continua proibindo métodos de envio. Lançamento pelo browser permanece bloqueado sem Worker real, e Mainnet continua bloqueada por constante. Nenhuma mudança de identidade visual.

## 25. Matriz de testes e níveis de evidência

| Camada                       | Resultado                               | Nível                                         |
| ---------------------------- | --------------------------------------- | --------------------------------------------- |
| Unitários/integração         | 148 aprovados em 15 arquivos            | Automatizado, majoritariamente simulado       |
| Wallet Standard/browser      | 26 aprovados após ajuste das fixtures   | Automatizado simulado, desktop/mobile emulado |
| RPC/programas Devnet         | Aprovado                                | Real público, sem carteira                    |
| Funder/saldo/secret metadata | Aprovado                                | Real, sem recuperar secret do GitHub          |
| Meteora público, tentativa 1 | 5 passam, 3 falhas RPC/cascata, 2 skips | Real automatizado, falha preservada           |
| Meteora público, smoke final | 8 passam, 2 skips                       | Real automatizado com keypair descartável     |
| Graduação/DAMM v2 públicos   | Pendente                                | Não executado                                 |
| Worker                       | 16 passam + bundle local                | Storage/Access simulados; sem deploy          |
| Phantom oficial              | Pendente                                | Nenhum teste real                             |

Unitários, lint, typecheck, build e export foram executados nesta etapa. Browser teve falha intermediária de fixtures após registrar config; corrigir mocks/allowlist de leituras não autoriza envios. CI da head final deve ser conferido conforme seção 30.

## 26. Arquivos criados

- `scripts/create-devnet-funder.mjs`, `manage-devnet-funder.mjs`, `check-metadata-worker.mjs`.
- `tests/chain/devnet-safety.ts`, `public-rpc.ts`, testes de segurança/ritmo e sonda `tests/live/devnet-readiness.probe.ts`.
- `infra/metadata-worker/src/access.ts`, fixture Access/JWT para unitários e e2e on-chain.
- Três guias em `docs/devnet/`, guia Cloudflare, matriz Phantom e este relatório.
- Evidências públicas em `docs/devnet/evidence/`: readiness, status inicial/final, ambiente GitHub, config, tentativas real/falha, confirmações e auditoria. Nenhuma contém chave/JWT/credencial.

## 27. Arquivos modificados

Workflow Meteora; `package.json`, lockfile e política de builds; `.gitignore`; config pública Devnet; harness/fluxo de teste; Worker/README/Wrangler; cliente de upload; testes metadata e fixtures/specs de navegador; README principal e runbook. IDs/curva/economia existentes preservados, exceto registro da config realmente criada. Não houve alteração em `main`, PR #6, outras branches ou no Word não versionado.

## 28. Commits

- `acd6d2e` — proteção de execução financiada e automação segura do funder.
- `569220f` — autorização e validações do Worker, fixtures JWT.
- `e83cf8b` — guias e evidências de preparação/financiamento.
- `4233212` — ritmo RPC após falha observada e registro da config verificada; código do smoke público aprovado.
- `a8de783` — fixtures com bytes públicos da config e allowlist explícita de consultas, mantendo envios proibidos; 26 browser tests passaram localmente.
- O commit deste relatório/evidências também isola a entrada do runner financiado e recusa retry antecipado quando Retry-After excede o orçamento de espera; hash final consta no histórico/descrição do PR. Não há force push ou exclusão de commits.

## 29. GitHub PR

[PR #8](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/8) preservado em Draft, mesma origem/destino. Trabalho local em `codex/retry-devnet-unblock`, baseado na head do PR; pushes normais para a branch de implementação. A primeira publicação avançou `0c70480` para `4233212`, preservando todos os commits anteriores. Relatório e matriz são vinculados à descrição do próprio PR.

## 30. CI

Resultados antigos foram consultados diretamente. O código `4233212` passou nos [validadores 40941949430](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40941949430): **10 testes on-chain + 1 browser** em cada variante de binários (Devnet e Mainnet clonados), ambos em validador local. Contagens conferidas nos logs dos jobs. Nenhuma transação foi enviada à Mainnet. O job de Devnet pública ficou corretamente skipped no push; a prova pública é o smoke local autorizado.

O job de qualidade `validate` passou em `4233212`; o browser intermediário falhou nas expectativas antigas de métodos RPC depois que a config passou a existir. Essa falha não foi escondida. Fixtures/allowlist foram corrigidas em `a8de783`, com **26 browser tests locais aprovados** e sem liberação de métodos de envio.

[Checks atuais do PR #8](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/8/checks) e a descrição atualizada são a referência da head final: o agente consulta os resultados após o último push e registra a SHA/run na entrega. Jobs de validador local não equivalem ao smoke público; job público permanece manual, sem execução automática por push. Nenhum workflow desta branch publica Pages/Worker.

## 31. Riscos de segurança

`pnpm audit --prod` encontrou **10 alertas: 6 altos e 4 moderados** na árvore preexistente Meteora/Anchor/web3.js. `bigint-buffer@1.1.5`, `toml@3.0.0`, `stream-json@1.9.1` e `uuid@8.3.2` já constavam no lock inicial; não foram introduzidos pelo Worker/secret. [Detalhes/GHSAs](../devnet/evidence/DEPENDENCY_AUDIT.json).

Build nativo de bigint-buffer permanece desabilitado, nenhum `.node` foi encontrado nessa instalação e o build confirmou fallback JS; isso é mitigação local, **não correção do advisory**. Outras correções exigem revisar mudanças principais transitivas; não houve override inseguro nem supressão do audit para obter verde. Auditoria/reparação dedicada é necessária antes de produção.

Outros riscos: quotas RPC públicas; limites KV/rate aproximados; cookie cross-site/Access ainda não exercitados; backup DPAPI preso à identidade Windows; fee claimer efêmero de testes sem função de treasury; config Mainnet não aprovada. O cap de 5% por carteira continua não garantido pelo DBC, conforme implementação anterior. Nenhuma dessas lacunas é liberada para produção por esta revisão.

## 32. Pendências do proprietário

Carteira/secret foram automatizados com autorização e financiamento humano confirmado; **não repetir esses passos**. Restam autenticar e autorizar recursos/deploy Cloudflare, fornecendo os identificadores reais da conta, e disponibilizar/operar uma Phantom exclusiva quando for validar a extensão.

Disponibilizar dispatch na default branch requer decisão separada do responsável; não foi usado merge para resolver. O smoke local já demonstrou alternativa viável. Graduação pública exige autorização e financiamento adicionais calculados do estado real, não uso do saldo atual sem aprovação.

## 33. Próximos passos

Concluir testes locais/CI e revisão do PR, configurar Worker autorizado com persistência/acesso reais, depois validar Phantom na origem local ou preview externo autorizado. Só então planejar graduação pública, confirmar DAMM v2 e locks, remediar dependências e revisar critérios de liberação. Não promover config/keys efêmeras a produção.

## 34. Conclusão

O bloqueio original de funder/secret deixou de existir e o ciclo público de criação/compra/venda foi provado em Devnet, com falha anterior preservada e correção verificada. Cloudflare e extensão real permanecem explicitamente pendentes; graduação não foi executada. Draft, `main`, site público e Mainnet foram preservados. **Entrega técnica verificável, sem declaração de prontidão de produção ou validação de Phantom inexistente.**
