# RETRY — Etapa 7: Solana Devnet Public Beta

**Data: 02/11/2026, horário de Brasília.** Timestamps das evidências são UTC e podem indicar 03/11. **Resultado: PARTIAL; liberação pública BLOCKED.** Não há URL de Worker/preview nova nem transações novas em rede pública nesta etapa. Transações de validação ficam restritas a validadores locais no CI. Cloudflare e Phantom de testes permanecem indisponíveis. A verificação encontrou uma credencial GitHub gerenciada já utilizável, permitindo publicar a branch e abrir o Draft PR #10 sem pedir nova autenticação ao proprietário.

## 1. Resumo Executivo

A Etapa 7 reutiliza o MVP Solana/Meteora, fecha problemas do caminho de metadados e prepara uma publicação independente. O código agora verifica imagem e JSON públicos, trata propagação do KV, oferece autorização de upload compreensível, restringe o build Beta à Devnet e melhora o transporte RPC. A auditoria caiu de dez para quatro alertas, sem supressões. Os controles locais não comprovam publicação, carteira real ou graduação pública.

## 2. Estado Inicial

Branch inicial `feat/retry-meteora-create-trade-graduate`, commit `b7a88638b4cdb13bed2fb4fd24b110786cc00f2e`. Repositório atualizado com fetch; esse continuou sendo o head do PR #9. Os relatórios e ZIPs do levantamento anterior estavam não commitados e foram preservados na pasta principal.

## 3. Estratégia Git

Worktree isolado em `.qa/stage-7`, branch `feat/retry-devnet-beta-stage-7`, derivada do PR #9. Nenhuma alteração nas branches anteriores, merge ou force-push. O novo PR deve ter base no head do PR #9 enquanto o stack existir. [Estratégia detalhada](../devnet-beta/PR_STACK_AND_BRANCH_STRATEGY.md).

## 4. Auditoria do PR #6

API pública: aberto, Draft, sem conflito informado; head `a2d17485fbfceaacab1754adf0e3239dd83bdeda`, base `main`. Contém provider único, Wallet Standard, RPC e migração de leitura para Solana. Está incluído na base da Etapa 7. Extensões reais permanecem sem aprovação nova.

## 5. Auditoria do PR #8

API pública: aberto, Draft, sem conflito informado; head `afa0f5e817fe9981f84c7b99467e9f4b4847333a`, base PR #6. Entrega DBC, Worker, proteção do funder e evidência pública histórica. Foi preservado; parâmetros/fee claimer não foram alterados nesta etapa.

## 6. Auditoria do PR #9

API pública: aberto, Draft, sem conflito informado; head `b7a8863`, base PR #8. Contém graduação, DAMM v2, posições e provas de bloqueio. Último quality workflow consultado: [40976582317](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40976582317), aprovado. Isso é CI da base, não do novo HEAD da Etapa 7.

## 7. Estado do Frontend

Preservados marca, páginas, gráficos, navegação e estilo. Adicionado aviso “Solana Devnet Beta — Test Tokens Only” somente ao build Beta e retirada a opção Mainnet desse build. O fluxo Create oferece Authorize uploads e mostra erros de autenticação específicos. Uma trava em memória evita preparação concorrente por clique duplicado.

## 8. Cloudflare Worker

Código existente reaproveitado. Novos controles: leitura/verificação dos objetos escritos; 202 quando ainda propagando; recusa de conteúdo divergente em chave existente; conferência do hash antes de servir. GET de sessão em `/v1/metadata` facilita o login Access sem expor a identidade. Bundle dry-run local aprovado, sem publicar recursos.

## 9. Cloudflare KV

KV mantido; não há R2 novo. As quotas Free consultadas são 1 GB, 100 mil leituras/dia e mil escritas/dia; limite de valor 25 MiB. O upload continua limitado a imagem de 2 MiB e corpo de 3 MB. Consistência eventual inclui cache negativo: 201 local não significa disponibilidade global. Não é nonce/lock transacional. [Limites e publicação](../devnet-beta/CLOUDFLARE_WORKER_DEPLOYMENT.md).

## 10. Autorização de Upload

JWT Access RS256, issuer/AUD fixados, expiração e JWKS verificados no Worker. Origem exata e rate limit são camadas complementares. Carteira conectada não autentica upload. Preparado gateway Pages → Worker por service binding, com a mesma origem no browser, sem credencial administrativa no frontend. Access real ainda não configurado/testado.

## 11. Metadados

O cliente faz um POST limitado e não o repete automaticamente. Guarda recibo na tela e relê JSON/imagem sem cookies, com limites, hashes, MIME e correspondência ao rascunho. Sete tentativas limitadas de leitura lidam com propagação; falha impede preparar a transação. Repetir a revisão retoma GETs. Contêiner/dimensões são validados no servidor; isso não é decodificação completa, reencoder ou antimalware.

## 12. Configuração de Ambiente

`build:beta` fixa Devnet, basePath vazio, flags financeiras legadas false e `NEXT_PUBLIC_RETRY_METADATA_URL=/` (origem HTTPS atual). Mainnet não pode ser ativada por URL/env. O Worker precisa de valores **reais** de `PUBLIC_URL`, `ALLOWED_ORIGINS`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE`, binding `METADATA` e `UPLOAD_RATE_LIMITER`. Nada foi preenchido com URL publicada inventada.

## 13. Preview

**BLOCKED, URL não disponível.** Cloudflare Pages em projeto exclusivo da Beta é a estratégia preparada; não substituirá GitHub Pages. `_worker.js` encaminha `/v1/*` ao Worker existente e o restante continua estático. Usar hostname estável do projeto para as URIs, Access somente no caminho de upload e branch de produção do projeto Beta igual à branch Etapa 7. [Procedimento](../devnet-beta/PREVIEW_DEPLOYMENT.md).

## 14. Build

Mantido Next.js com export estático. O script Beta gera assets na raiz, `_routes.json`, headers e `beta-version.json` com proveniência e working tree suja/limpa. Build recusa configuração Mainnet ou prefixo GitHub Pages. O servidor local foi corrigido para servir a raiz sem redirecionamento circular. Nenhum workflow de produção do site antigo foi alterado.

## 15. Carteiras

Phantom, Solflare e Backpack continuam via Wallet Standard. O proprietário informou não ter Phantom de testes disponível. **REAL WALLET: NOT TESTED.** Não houve solicitação de seed/exportação de chave. [Matriz manual](../devnet-beta/REAL_WALLET_TEST_MATRIX.md).

## 16. Testes Reais

Foi executada consulta pública **somente leitura** à Devnet: genesis, programas, config e saldo público. Não houve assinatura ou envio. O navegador novo usa serviços simulados e o handler real do Worker em processo; não é teste de Cloudflare publicado nem de extensão real.

## 17. Criação de Token

Fluxo financeiro existente preservado. A Etapa 7 aprimora o passo anterior de armazenamento e sua mensagem de login. Novo mint/pool pelo formulário real: **BLOCKED**, pois falta serviço publicado, preview e Phantom. Não foi chamado de completo um teste que para antes de simular/assinar uma transação.

## 18. Mint e DBC

Nenhum mint/pool público novo nesta etapa. Config Devnet registrada no código: `8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N`. O JSON de readiness registra a leitura atual e suas verificações. Mint histórico do smoke de 29/10: `6WwkimyJfjEbeh7wSXYRZ6e26pmEyPLWwTUt9fTY1nUz`; pool histórica `2Lu2YaaHJLibHxzYG45b2y8YTyXhyGS2xqb23fZJhRpd`. Não são novos resultados da Beta. Contas efêmeras dos validadores do CI pertencem a redes locais, não à Devnet pública.

## 19. Compras

Nenhuma compra pública enviada nesta etapa. Quotes, minimum out, fees, slippage e fluxo DBC/DAMM v2 existentes foram preservados. Nova aprovação pública depende de [Create/Trade E2E](../devnet-beta/CREATE_TRADE_E2E.md).

## 20. Vendas

Nenhuma venda pública enviada nesta etapa. O saldo SPL e as quantias continuam em unidades inteiras; não foi substituído o SDK por fórmula nova. O primeiro CI identificou uma corrida: a conclusão tardia de uma compra apagava o valor novo de venda. A correção preserva a revisão do input, mantém a operação ocupada durante atualização de dados e impede que editar o formulário esconda esse estado. Dois testes React reproduzem essas situações. Recusa, confirmação perdida e troca de conta com extensão real fazem parte da matriz pendente.

## 21. Taxas

Nenhuma taxa paga em rede pública nesta etapa. Taxas dos validadores do CI usam moedas locais sem valor. Não foram alterados threshold, supply, taxas ou recebedores. Valores públicos de criação/migração do relatório anterior continuam históricos/estimados, não medidos novamente. O custo real de um ensaio público deve ser obtido da simulação e das transações Devnet efetivamente confirmadas.

## 22. Discover

Listagem on-chain pela config RETRY preservada. O cenário Beta verifica renderização e navegação em desktop/mobile com RPC simulado. Não foi criado lançamento novo para comprovar presença no Discover público nesta etapa.

## 23. Gráficos e Atividade

Preservados gráficos e decodificação de eventos. Os testes anteriores de histórico, zoom e leitura fazem parte da regressão; não foi introduzido indexador nem inventado histórico público. Alcance permanece limitado às páginas lidas e aos provedores disponíveis.

## 24. Graduação

**PUBLIC DEVNET: BLOCKED.** Threshold 10 SOL. Saldo consultado do funder: 2,013648909 SOL de teste; orçamento de novo ciclo deve incluir curva, fees e rent. Há ausência de chave de teste disponível neste computador e de carteira real. [Plano e orçamento](../devnet-beta/PUBLIC_GRADUATION_E2E.md).

## 25. DAMM v2

Programa oficial existente preservado: `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`. Nenhuma pool DAMM v2 nova, migração ou negociação pós-graduação pública desta etapa. Fluxos antigos em validador não foram apresentados como execução pública atual.

## 26. Liquidity Lock

Prova continua dependente de contas/posições on-chain, não de selo baseado só em configuração. Nenhuma posição pública nova verificada nesta etapa. O helper adversarial agora exige erro na transação registrada e tolera indexação atrasada sem reenviar; uma exceção de confirmação isolada não é prova. Quatro testes cobrem esses critérios. Claims de taxas não equivalem a retirada do principal; bloqueio não garante preço nem elimina risco de programas atualizáveis. [Evidências requeridas](../devnet-beta/LIQUIDITY_LOCK_EVIDENCE.md).

Os dois validadores novos comprovaram as posições e recusas, com **uma unidade bruta residual desbloqueada**, zero vestida e o restante permanentemente bloqueado. O percentual exibido arredonda para 100%; não é bloqueio matemático de cada unidade. Os totais exatos estão no documento de liquidez e nos JSONs locais.

## 27. Portfolio

Provider único, saldos, holdings e posições LP existentes preservados. Navegação e estados foram incluídos na regressão. Novo saldo decorrente de operações públicas desta etapa: inexistente, porque nenhuma transação foi enviada.

## 28. RPC

Transporte dos testes públicos reutilizado na aplicação: fila limitada, espaçamento, deadline e backoff, com no máximo uma repetição adicional de leitura no cliente Meteora. Envios não são repetidos pelo transporte. Kit respeita Retry-After longo, aborta sem nova tentativa em timeout/cancelamento e não fabrica zero. [Detalhes](../devnet-beta/RPC_AND_RELIABILITY.md).

## 29. GitHub Actions

No código final `e01344f`, passaram [qualidade e navegador](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41568357450), [preparação da Beta](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41568357517) e [fluxo completo nos validadores](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41568352309). [Snapshot com SHA e jobs](../devnet-beta/evidence/ci-code-verification.json). O último commit de documentação não muda esse código; seus checks de qualidade/Beta devem corresponder ao HEAD final e são conferidos na entrega e no PR.

O workflow de preview exporta artefato para revisão, sem secrets/deploy. O workflow financeiro protegido não foi aberto a código externo: seu job público ficou **skipped**. A API autenticada confirmou **somente o nome** `RETRY_DEVNET_FUNDER` no environment `retry-devnet`; nenhum valor foi recuperado ou impresso. Não foi feito merge para habilitar workflow_dispatch.

## 30. Auditoria de Dependências

Auditoria atual antes: 6 altos/4 moderados. Overrides direcionados: `@coral-xyz/anchor>toml` 5.0.1 e `jayson>uuid` 11.1.1. Depois: **1 alto/3 moderados**. Restam bigint-buffer e stream-json. Sem versão corrigida do primeiro; não foi forçado upgrade incompatível do segundo. [Achados, caminhos e risco residual](../devnet-beta/SECURITY_FINDINGS.md).

## 31. Segurança

Mainnet constante false, config e aprovação nulas; Beta também impede seleção/inicialização Mainnet. Sem segredos no frontend, assinatura de login ou nonces críticos em KV. Controles de imagens/corpos/hashes reforçados. A revisão não é auditoria independente; gates de edge, persistência e carteiras reais seguem abertos. Não aprovar release pública irrestrita com base somente na redução de alertas.

## 32. Testes Unitários

**210 testes em 22 arquivos aprovados**, com `pnpm test --maxWorkers=1 --pool=threads`, em 152,98s. Comandos e limites estão em [verification-results.json](../devnet-beta/evidence/verification-results.json). A suite inclui novos casos de disponibilidade, integridade, autenticação, timeout, proteção Beta, transporte, estado de operações e prova de recusa. Falhas iniciais revelaram um conflito entre prazo/backoff e um teste antigo, além de uma fixture sem MIME correto; ambos foram corrigidos e reexecutados.

## 33. Testes de Integração

Integração React/Wallet Standard continua simulada. Neste Windows, o pool forks teve timeout de inicialização do jsdom em uma execução; foi usado pool threads com um worker. O prazo específico da asserção de indisponibilidade foi alinhado ao novo backoff de 1s, sem reduzir a exigência de erro honesto ou ausência de assinatura.

## 34. Browser Tests

**26 casos existentes + 4 novos Beta aprovados**, desktop e Pixel 7 emulado. Os novos verificam root assets, aviso, Devnet-only, navegação, upload não autorizado recusado e upload autorizado com duas leituras públicas antes de qualquer assinatura. A primeira execução revelou mensagem genérica em vez de orientação de login; o tratamento de MetadataUploadError foi corrigido. Um timeout mobile com dois workers foi reexecutado com um worker, obtendo 26/26 em uma execução completa. Não são testes com extensões reais.

## 35. Validador Local

**APPROVED no GitHub Actions para `e01344f`: 21 testes de cadeia + um cenário completo de navegador em cada variante**, usando binários copiados da Devnet e da Mainnet em validadores **locais Linux**. Nenhuma transação foi enviada à Mainnet pública. O Windows continua sem `solana-test-validator`; não foi instalado WSL/VM.

Foram exercitados criação, compra/venda DBC, threshold, graduação, compra/venda DAMM v2, slippage, recusa de segunda migração, retirada indevida e claims. Cada cenário de navegador verificou sete assinaturas da carteira de teste, Portfolio e Discover; RPC/execução são do validador, mas carteira e serviço de metadados são fixtures, não Phantom/Cloudflare reais. Evidências: [Devnet binaries](../devnet-beta/evidence/local-validator-devnet.json), [Mainnet binaries](../devnet-beta/evidence/local-validator-mainnet.json) e [CI](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41568352309).

[Captura da pool graduada no validador com binários Devnet](../devnet-beta/evidence/validator-devnet-graduated.png), inspecionada visualmente. A tela usa rede local e carteira de teste, mesmo mostrando o rótulo Devnet da aplicação.

O primeiro CI falhou na corrida de input e na coleta de uma recusa esperada. Ambos foram corrigidos e a execução completa seguinte passou. [Registro das falhas e regressões](../devnet-beta/evidence/ci-regressions.json). O resultado não substitui o ciclo público/Phantom pendente.

## 36. Devnet Pública

**Leitura atual APPROVED; transações novas NOT TESTED.** [public-devnet-readonly.json](../devnet-beta/evidence/public-devnet-readonly.json) registra data/slot/genesis, programas, config e saldo. `transactionsSent = 0`. As signatures do smoke antigo estão em [CHAIN_CONFIRMATIONS.json](../devnet/evidence/CHAIN_CONFIRMATIONS.json) e não foram reaproveitadas como testes da Etapa 7.

## 37. Custos

Nenhum serviço contratado, recurso pago ativado ou SOL movimentado. Dependências e navegador foram instalados localmente. Gratuidade futura depende das quotas Free e da conta escolhida. Para teto bruto de ensaio 12 SOL, déficit sobre o saldo lido: 9,986351091 SOL de teste; não é custo líquido, garantia de suficiência ou autorização automática. Não usar SOL Mainnet.

## 38. Arquivos Criados

`infra/devnet-beta/`: gateway, tipos e validação de configurações; `scripts/build-devnet-beta.mjs` e `prepare-devnet-beta.mjs`: build/configs sem deploy; `src/config/devnet-beta.ts`: modo Beta; `metadata-endpoint.ts`: resolução HTTPS; `image.ts`: contêiner/dimensões; transporte compartilhado RPC; testes Beta unitários/navegador e sua configuração; documentos e evidências em `docs/devnet-beta/`. O manifesto de entrega lista o diff final por arquivo.

## 39. Arquivos Modificados

Worker, cliente de metadados, LaunchPanel, provider/selector de rede, shell/CSS, config Solana/política, cliente RPC/SDK, scripts/package/lockfile, fixtures/tests e workflow de validação. README principal e documentos de entrada atualizados. Produção GitHub Pages, tesouraria e parâmetros econômicos foram preservados.

## 40. Commits

Commits de código publicados: `77c30e1345f9a8e6233697170eaa6802e2385ec6` (metadados/propagação/integridade), `4acfde74224d8136f74c2965de10ddb3698613fd` (preview Devnet/RPC/dependências/testes) e `e01344fed6062dc686b671c5322627a4f96a7a2d` (corrida compra/venda, estado ocupado e prova de recusa no validador). O commit de documentação vem a seguir. Não foi reescrito o histórico. A evidência identifica o código testado separadamente dos documentos finais.

## 41. Pull Requests

#6/#8/#9 preservados. [**Draft PR #10**](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/10) aberto na branch exclusiva, base `feat/retry-meteora-create-trade-graduate`. A credencial existente foi usada somente em memória. Nenhum merge ou publicação de site foi executado. O [CI do PR](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/10/checks) é conferido após o último push; seu estado final é registrado na entrega e na evidência remota, sem confundir testes da base com testes deste código.

## 42. Critérios de Aceitação

[Matriz completa](../devnet-beta/RELEASE_CHECKLIST.md): APPROVED para preservação do stack, base identificada e bloqueio Mainnet; PARTIAL para implementação de uploads/segurança; BLOCKED para publicação Cloudflare/graduação; NOT TESTED para Phantom, KV remoto, novas operações públicas e bloqueio público. A situação de CI é conferida no HEAD publicado. A Beta completa não está aprovada.

## 43. Pendências do Proprietário

Disponibilizar conta Cloudflare; revisar recursos/plano/Access; preparar Phantom exclusiva e aprovar assinaturas na própria extensão; financiar/autorizar orçamento Devnet após conferir saldo; revisar o Draft PR #10 sem mesclar automaticamente. A entrega GitHub não exige novo login neste ambiente, pois a credencial existente foi encontrada e validada. Não enviar senha, token, seed ou chave ao chat.

## 44. Próximas Etapas

Primeiro publicar e validar a **Beta Devnet** com os runbooks, executar o ciclo público e resolver gates de segurança. Mainnet exigirá aprovação econômica, tesouraria/fee recipients, config de produção, RPC/monitoramento, revisão independente, teste real e autorização explícita. Não faz parte da Etapa 7 e não deve ser habilitada removendo o aviso.

## 45. Conclusão

Etapa 7 entregue como preparação operacional e correções locais verificáveis, com publicação e testes reais bloqueados pelos acessos indisponíveis. A evolução foi preservada, o Worker não foi reconstruído, não houve mudança de blockchain/DEX, merge de PR ou alteração do site público. Não declarar “Beta pública pronta” até comprovar Worker/KV, preview e ciclo com carteira real, incluindo a graduação pública.
