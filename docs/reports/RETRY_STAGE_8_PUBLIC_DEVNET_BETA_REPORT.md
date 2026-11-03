# RETRY — Relatório da Etapa 8: Public Solana Devnet Beta

**03/11/2026, horário de Brasília. Timestamps das evidências em UTC.**

**Resultado: PARCIALMENTE PRONTA. Preview público de leitura entregue e verificado; Beta transacional ainda bloqueada.** Durante a execução, o proprietário escolheu **“Sem cartão; publique o preview de leitura”**. Essa decisão foi aplicada sem remover a proteção de uploads, ativar cobrança ou enviar transações.

**[Abrir RETRY](https://retry-solana-devnet-beta.pages.dev/) · [Versão servida](https://retry-solana-devnet-beta.pages.dev/beta-version.json) · [Draft PR #11](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/11) · [Matriz de gates](../stage-8/RELEASE_CHECKLIST.md).**

## 1. Resumo executivo

O frontend Solana agora está em um endereço real e separado, com Worker e KV Cloudflare reais, dois objetos públicos verificados por hash e navegação desktop/mobile sem mocks de RPC. A Phantom de testes foi conectada pelo proprietário, que confirmou leitura, refresh, Portfolio e reconexão; o saldo informado de 0 SOL foi conferido na Devnet. Nenhuma criação, compra, venda ou graduação pública nova foi executada. Mainnet e site histórico continuam protegidos.

## 2. Objetivo da Etapa 8

Reutilizar o MVP Meteora DBC → DAMM v2 e disponibilizar uma Beta pública com evidências. A meta transacional integral não foi atingida: o Access da conta exige cadastro com cartão/autorização de excedentes, recusado pelo proprietário. O escopo de publicação aprovado passou a ser leitura, mantendo a arquitetura pronta para futura validação transacional controlada.

## 3. Estado inicial do repositório

O checkout anterior estava limpo em `codex/retry-devnet-unblock`, `d5f51eb`. Fetch identificou o PR #10 como referência mais completa, incluindo as proteções anteriores. Foram inspecionados Git, PRs, ambientes e deployments antes da primeira alteração. [Registro inicial](../stage-8/INITIAL_STATE.md). Arquivos e worktrees de outras tarefas foram preservados.

## 4. Branch e commit de origem

Base **`feat/retry-devnet-beta-stage-7`**, commit **`2734e4166bb32a0d8462ec3b9f93517a98670df5`**. Nenhum commit posterior foi encontrado nessa branch na auditoria inicial. Worktree exclusivo **`E:/launchpadlendaria/.qa/retry-stage-8`**, branch **`feat/retry-stage-8-public-devnet-beta`**.

## 5. PRs #6, #8, #9 e #10

| PR                                                                     | HEAD observado | Situação / base     |
| ---------------------------------------------------------------------- | -------------- | ------------------- |
| [#6](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/6)   | `a2d1748`      | aberto, Draft, main |
| [#8](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/8)   | `afa0f5e`      | aberto, Draft, #6   |
| [#9](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/9)   | `b7a8863`      | aberto, Draft, #8   |
| [#10](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/10) | `2734e41`      | aberto, Draft, #9   |

A ancestralidade foi conferida: a Etapa 7 contém também o trabalho anterior `d5f51eb`. Não houve integração por substituição de arquivos nem perda dos commits do outro desenvolvedor.

## 6. Estratégia Git

Preservado o stack **#6 → #8 → #9 → #10 → #11**. O PR #11 tem base na branch do #10. Commits normais e push normal na branch exclusiva; sem merge, force-push, exclusão de branch ou mudança da main. O deployment está associado a um commit limpo, distinguindo código publicado de documentação/evidências posteriores.

## 7. Segurança inicial

A auditoria revelou os quatro alertas já relatados, mas foi repetida no checkout atual. Funder permaneceu em ambiente GitHub protegido, com aprovação humana e política de branch anterior. O Worker já tinha JWT, validações, hashes, limites e tratamento de propagação; isso foi reaproveitado. Mainnet continuava `false`, aprovação `null` e config ausente.

## 8. Dependências vulneráveis

**1 alto em bigint-buffer 1.1.5 e 3 moderados em stream-json 1.9.1; zero críticos.** As contagens permanecem após o patch, pois a versão upstream ainda consta na auditoria. [Auditoria antes](../stage-8/evidence/dependency-audit-before.json), [depois](../stage-8/evidence/dependency-audit-after.json), [classificação de exposição por alerta](../stage-8/DEPENDENCY_SECURITY_REVIEW.md). Não houve suppressions ou upgrade indiscriminado.

## 9. Correções realizadas

O patch reproduzível impede carregar o conversor nativo vulnerável, inclusive se o binding estiver disponível. O build Beta exige o gate de segurança. A interface passou a distinguir bloqueio literal de resíduo, apresentar inteiros exatos e truncar o percentual com precisão suficiente. Uma prova de outra pool deixou de ser usada durante carregamento/falha. Regressões cobrem campo de venda durante reconciliação e mudanças de saldo/quote/preço/foco.

O novo teste de saque mínimo revelou `AmountIsZero`, contrariando sua expectativa inicial; foi corrigido para exigir esse erro específico e principal inalterado, sem ocultar a falha inicial. A preparação Cloudflare também foi corrigida para a configuração Pages efetivamente aceita nesta versão.

## 10. Cloudflare Worker existente

Reutilizado `infra/metadata-worker`, sem nova curva, backend, R2 ou indexador. Serviço publicado **retry-metadata-devnet-beta**, versão **4834ea3c-21ef-4608-b9c4-8756c538a13b**. Sua execução é comprovada pelas leituras por hash através do gateway, não apenas pelo retorno do comando de upload. [Inventário publicado](../stage-8/evidence/cloudflare-deployment.json).

## 11. Alterações no Worker

O código de upload/validação do PR #10 foi mantido. Mudanças desta etapa concentram-se em configuração real de deploy, serviço sem rota direta workers.dev, binding Pages e testes adicionais de runtime. O bundle ficou em cerca de **53,25 KiB / 14,58 KiB gzip**, startup relatado de **2 ms**. Startup não é medição do custo CPU de cada upload.

## 12. Cloudflare KV

Criado namespace exclusivo **RETRY_STAGE8_METADATA**, ID **05a067e97f004418aa8ee24bbb0a43a8**. A conta estava sem Workers, KV ou Pages antes da criação. O namespace usa o binding METADATA do Worker. Dois objetos foram gravados administrativamente, sem expiração, totalizando **529 bytes de conteúdo**; overhead interno do serviço não foi medido.

## 13. Integridade e persistência

PNG de 70 bytes e JSON de 459 bytes foram lidos sem autenticação e comparados com SHA-256 local, MIME e cabeçalhos. [Primeira leitura remota](../stage-8/evidence/public-kv-first-read.json) e [releitura após cerca de 18 minutos](../stage-8/evidence/public-kv-repeat-read.json), sem nova gravação. O runtime local também reteve os dados após reinicialização. KV remoto não é o mock de memória dos testes unitários; nenhuma dessas provas garante disponibilidade global instantânea ou impossibilidade administrativa de remoção.

## 14. Autenticação de uploads

**BLOCKED.** A ativação do Zero Trust Free abriu formulário com cartão e aceite de cobranças de excedentes. Nada foi preenchido/aceito; o proprietário escolheu não prosseguir. Issuer/AUD estão vazios, e POST na origem correta retorna **503**, fechado por configuração; origem não aprovada retorna **403**. GET de sessão retorna **401**. Não foi criado token de serviço compartilhado nem removida autenticação para obter sucesso.

## 15. Limites e custos Cloudflare

Plano **Workers Free / US$ 0 base** confirmado no painel antes da criação. KV Free: **100.000 leituras/dia, 1.000 escritas/dia e 1 GB**, valor até **25 MiB**, limite por chave de uma escrita/segundo. Dois objetos novos usam duas escritas; quotas e CPU ainda limitam o volume. [Limites oficiais](https://developers.cloudflare.com/kv/platform/limits/), [preços oficiais](https://developers.cloudflare.com/kv/platform/pricing/). Nenhum plano pago, cartão ou domínio de produção foi ativado.

## 16. URL de metadados

Leituras públicas reais pelo Worker/gateway: [imagem](https://retry-solana-devnet-beta.pages.dev/v1/i/6b7fa434f92a8b80aab02d9bf1a12e49ffcae424e4013a1c4f68b67e3d2bbcd0) e [JSON](https://retry-solana-devnet-beta.pages.dev/v1/m/67129784c523c2084254fd55550cf5426d390951b2d3c0a4158a0e271bbda431.json). O JSON é uma sonda de infraestrutura, explicitamente não associado a um mint novo. Não existe URL direta workers.dev habilitada para o serviço.

## 17. Configuração do frontend

O build público usa os controles existentes para desativar todas as funcionalidades de assinatura. Metadata endpoint fica vazio na aplicação de leitura; o gateway continua permitindo GETs dos objetos de teste. A interface mostra **Solana Devnet Beta**, **Test SOL only — No real funds** e a indisponibilidade de uploads/transações. Não foi redesenhada a identidade RETRY.

## 18. Estratégia de hospedagem

Cloudflare Pages, projeto exclusivo **retry-solana-devnet-beta**, Direct Upload sem autodeploy da main. A production branch do próprio projeto Beta é a branch Etapa 8. “Production” nesse painel identifica a URL estável desse projeto isolado, não uma liberação Mainnet. Nenhum domínio personalizado ou serviço de hospedagem adicional foi contratado.

## 19. Preview publicado

Deployment **b0b2983a-f0b8-452b-8564-74b3633087ad**, status remoto **success**, ambiente do projeto **production**. 75 assets enviados, gateway compilado e binding METADATA_SERVICE confirmado. [Evidência API](../stage-8/evidence/cloudflare-deployment.json). Tentativas anteriores rejeitadas por configuração/permissão não foram apresentadas como deployments concluídos.

## 20. URL do preview

**https://retry-solana-devnet-beta.pages.dev/**, com [alias específico desse deployment](https://b0b2983a.retry-solana-devnet-beta.pages.dev/). A URL estável e `/beta-version.json` retornaram HTTP 200. Fonte servida: **1c5127a35eaf67515d06afe13378a8ae0e15e646**, `dirty=false`. As sondas/documentação posteriores não significam que outro commit foi silenciosamente publicado.

## 21. Build e rotas

Next.js **16.4.3** instalado, guia local de static export consultado antes de alterar código. Builds normal, GitHub Pages e Beta foram validados localmente e/ou pelo CI correspondente. Beta na raiz; GitHub Pages mantém seu basePath próprio. `/`, `/create/`, `/portfolio/` e `/token/` retornaram 200 no domínio real. Nenhum erro de asset ou JavaScript observado nas jornadas públicas verificadas.

## 22. Variáveis de ambiente

`NEXT_PUBLIC_RETRY_DEVNET_BETA=1`, cluster Devnet, basePath vazio, `NEXT_PUBLIC_RETRY_DISABLED_FEATURES=all`, flags legadas financeiras false e metadata endpoint vazio. Sem API keys públicas. [Tabela completa](../stage-8/ENVIRONMENT_CONFIGURATION.md). Pages não aceita account_id no arquivo nem caminho de config customizado; o gerador agora cria `metadata/wrangler.json` e `pages/wrangler.json`, usando conta selecionada no ambiente e `--cwd`.

## 23. Solana Devnet

Sonda pública confirmou genesis **EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG**, DBC/DAMM/Locker/Metaplex executáveis, migration config e configuração RETRY compatível. [Leitura on-chain](../stage-8/evidence/public-devnet-readonly.json). O endereço de config permanece **8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N**, sem mudanças econômicas ou de autoridade.

## 24. RPC e estabilidade

RPC gratuita oficial mantida; filas, espaçamento, timeout e retries limitados existentes foram revistos. Nenhum replay automático de send foi introduzido. Os percursos públicos observaram apenas HTTP 200 para RPC, sem chamadas Mainnet ou escritas Solana. Isso é amostragem de uso, não SLA nem teste de carga. [Evidência](../stage-8/evidence/public-browser.json), [limitações](../stage-8/RPC_RELIABILITY.md).

## 25. Phantom real

O proprietário informou **Z8WdA8JSjtbvNfGLF9aMTbb6DS94eHnMMEE4k55ZDZ7**, **0 SOL**, e confirmou refresh, Portfolio, desconexão/reconexão funcionando. RPC independente confirmou **0 lamports**, slot **518302931**. [Registro](../stage-8/evidence/phantom-owner-and-balance.json). A operação da extensão foi relatada pelo proprietário; versões não foram informadas e assinaturas não foram testadas.

## 26. Wallet Standard

Provider e conectores existentes preservados. Os testes simulados cobrem eventos, contas, saldo, recusa, reconexão e outras carteiras, mas não equivalem a uma extensão Phantom real. Os dois navegadores de automação pública têm perfis novos sem extensão e apenas abriram o modal. Fontes de evidência foram separadas para não inflar a validação real.

## 27. Criação via interface

**BLOCKED** pela escolha de leitura. O formulário abre, mas não envia upload nem solicita assinatura. Não houve mint/pool novo originado pelo formulário nesta etapa. A sonda administrativa de KV e os lançamentos locais não satisfazem o aceite de Create público. [Detalhamento](../stage-8/CREATE_TOKEN_DEVNET.md).

## 28. Upload de imagem

O POST público permaneceu fechado. A imagem de infraestrutura foi gravada pelo administrador via Wrangler, em chave SHA-256, e depois lida anonimamente. Validações negativas de arquivo, tamanho, JWT, quota, falha KV e conteúdo parcial continuam testadas no código; não declarar que todos esses cenários foram exercitados remotamente com uma sessão Access real.

## 29. Metadata URI

JSON público contém nome, symbol, descrição explícita de sonda, imagem e properties.files; hash **67129784c523c2084254fd55550cf5426d390951b2d3c0a4158a0e271bbda431**. Bytes e tipo foram conferidos; não há credenciais no documento. O cliente já trata propagação e retoma GETs sem repetir POST. [KV](../stage-8/KV_STORAGE_VALIDATION.md).

## 30. SPL Token criado

**Nenhum SPL token novo na Devnet pública durante esta etapa.** O mint histórico **6WwkimyJfjEbeh7wSXYRZ6e26pmEyPLWwTUt9fTY1nUz**, de 29/10/2026, continua visível e rotulado como token de teste sem valor. Ele não foi recriado nem apresentado como novo. Criação, supply e autoridades foram novamente testadas nos validadores locais.

## 31. Pool Meteora DBC

**Nenhuma pool DBC pública nova nesta etapa.** Pool histórica do mint citado: **2Lu2YaaHJLibHxzYG45b2y8YTyXhyGS2xqb23fZJhRpd**. No preview houve leitura de dois lançamentos reais vinculados à config RETRY. [Histórico anterior](../devnet/evidence/PUBLIC_TEST_SUMMARY.json). Endereços locais do CI estão identificados como locais e não recebem Explorer público.

## 32. Compra de tokens

**Zero compras públicas novas.** O build bloqueia execução pelo controle de funcionalidades, além de Mainnet permanecer bloqueada. Buy local e primeira compra atômica passaram nos validadores; isso não é uma compra pela URL pública/Phantom. Nenhuma nova signature de compra pública consta desta entrega.

## 33. Venda de tokens

**Zero vendas públicas novas.** Corrigida e coberta a preservação do campo durante reconciliação/atualizações. Sell local e seus saldos foram verificados no CI. Não foi solicitado que o proprietário financiasse sua carteira para um fluxo que continua desativado.

## 34. Fees e slippage

Economia candidata preservada: supply fixo, taxa DBC de 1%, threshold de 10 SOL e distribuição LP candidata 50/50. Nenhuma tesouraria Mainnet ou fee recipient novo foi escolhido. Builders e programas recusaram slippage/oversell nos testes locais. Fees e amount in/out de transações públicas novas permanecem NOT TESTED; não foram inventados valores para preencher a matriz.

## 35. Discover

O site real mostrou **dois lançamentos históricos ativos**, zero novos do dia e zero graduados na observação. Categorias, filtros e identidade existentes preservados. Nenhum card ou ranking fictício foi adicionado. A evidência pública registra leitura de contas reais, sem interceptação RPC, com capturas [desktop](../stage-8/evidence/public-desktop.png) e [mobile](../stage-8/evidence/public-mobile.png).

## 36. Token Detail

Rota do mint histórico abriu no preview público. Os testes prévios/locais cobrem quotes, venue, eventos, gráfico e transição após graduação. A versão pública de leitura não oferece trade operacional. Gráficos não misturam pools sem rótulo e não foram populados com candles fabricados para a demonstração.

## 37. Portfolio

Rota pública retorna 200 e o proprietário confirmou seu uso com a Phantom de testes, saldo 0. Holdings/LP e claims existentes seguem cobertos pelo código/validadores; nenhuma LP pública nova foi criada para essa conta. Não inferir ausência de ativos em outras redes a partir de uma consulta Devnet.

## 38. Graduação pública

**BLOCKED.** Sem pool DBC nova completada, sem migração pública, sem DAMM pública nova e sem signature de graduação pública. O migrador manual oficial é compatível com Devnet; não foi operado nesta sessão. [Plano de graduação](../stage-8/PUBLIC_GRADUATION.md), [fonte Meteora](https://github.com/MeteoraAg/docs/blob/main/developer-guides/dbc/index.mdx).

## 39. Threshold e financiamento

Threshold on-chain **10 SOL**. Funder confirmado com **2.013648909 SOL de teste**, slot inicial **518287879**; carteira humana com **0 SOL**. Déficit mínimo para 10 SOL em curva nova: **7.986351091 SOL**, antes de custos; para reserva de 12 SOL: **9.986351091 SOL**. Não é orçamento final garantido: recalcular saldo/reserva/rent/fees/margem antes de qualquer execução futura. Nenhum airdrop ou transferência foi realizado nesta etapa.

## 40. Migrador Meteora

Mantido `migrateToDammV2` do SDK 2.0.0, com validação de config, pool derivada, autoridades e estado. Em CI, migração manual, rent float e recusa de segunda migração foram repetidos. Não presumir que o keeper Mainnet opera na Devnet. Nenhum parâmetro econômico foi reduzido para facilitar o teste.

## 41. DAMM v2

SDK **1.5.1** fixado. Program ID **cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG**. O roteamento e validação de contas/vaults continuam testados. Evidência de pool nova é apenas local nesta etapa; o programa público foi lido, não modificado. [Validação](../stage-8/DAMM_V2_VALIDATION.md).

## 42. Negociação pós-graduação

**Local PASS, público BLOCKED.** O ciclo no navegador local graduou, negociou via DAMM e fez claim de LP; quote/trade DBC após migração foram recusados. Cada variante do CI completou o cenário. O preview público mostrou zero graduados e não enviou swaps.

## 43. Liquidity lock

Nos dois validadores, principal permanentemente bloqueado **823314404508605138322788080705104**, total **823314404508605138322788080705105**, unlocked **1**, vesting **0**. O NFT do criador controla o resíduo; parceiro e criador conservam direitos distintos de taxas. Pedidos indevidos de saque e autoridade foram recusados, e fee claim não alterou principal permanente. [Auditoria detalhada](../stage-8/LIQUIDITY_LOCK_AUDIT.md).

## 44. Arredondamento das posições LP

Não é 100% matemático. Percentual exato é **100 × locked / total** com os inteiros da seção anterior; a UI trunca para **99.999999%**, marca `fullyLocked=false` e mostra o resto. Simulação da retirada de exatamente uma unidade recebeu **6006 / AmountIsZero** nos estados observados, sem envio ou mudança de principal. Não generalizar esse resultado a todo preço/adição futura; corrigir a política para Mainnet exige revisão própria, não arredondamento visual.

## 45. Evidências on-chain

| Categoria                         | Evidência desta etapa                                            |
| --------------------------------- | ---------------------------------------------------------------- |
| PUBLIC DEVNET                     | leituras de programas/config/saldo, zero transações novas        |
| LOCAL VALIDATOR, binários Devnet  | 22 testes + um browser flow; endereços/signatures locais         |
| LOCAL VALIDATOR, binários Mainnet | mesma cobertura em rede local, nenhuma operação Mainnet          |
| REAL PHANTOM                      | relato do proprietário e saldo Devnet conferido, sem assinaturas |
| PUBLIC PREVIEW E2E                | dois percursos de leitura, RPC real, nenhum envio                |

Arquivos em [evidence](../stage-8/evidence/): o campo `mode=local` e o genesis dos validadores impedem confundi-los com a rede pública. Assinaturas públicas de outubro permanecem apenas como histórico.

## 46. Testes unitários

**214 testes aprovados em 24 arquivos**, contra 210/22 da base. Quatro casos novos: gate nativo, bloqueio literal, prova antiga de outra pool e preservação do input durante refresh; nenhum teste anterior foi removido. Os 27 testes de lógica Worker estão incluídos nesse total. `pnpm test --maxWorkers=1 --pool=threads` passou neste Windows.

## 47. Testes React

Incluídos nos 214, não somados novamente: quatro arquivos de integração cobrem Wallet Standard, execução durante reconciliação, dois casos de input e troca de prova de liquidez. A revisão React consultada preservou hooks/estrutura, chaves por carteira e comportamento existente; não houve refatoração estética.

## 48. Testes de navegador

**26 cenários existentes + 4 Beta simulados**, todos aprovados em desktop/mobile. Separadamente, **2 percursos públicos reais de leitura**, sem mocks, mais **5 verificações HTTP negativas**. [Resultado público](../stage-8/evidence/public-browser.json). A automação usou Chrome 156.0.8078.80; não é a versão confirmada do navegador/Phantom do proprietário, que não foi informada.

## 49. Testes em validador

**22 testes de cadeia e um cenário completo de navegador por variante**, com binários Devnet e Mainnet copiados para redes locais. O acréscimo em relação aos 21 anteriores é a simulação do resíduo. [CI do código financeiro](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41688886191), [JSON Devnet local](../stage-8/evidence/validator-devnet-programs-local.json), [JSON Mainnet local](../stage-8/evidence/validator-mainnet-programs-local.json). Nenhum segredo financiador foi fornecido a esses jobs.

## 50. Testes públicos Devnet

Sonda de pré-requisitos e consulta independente do saldo do usuário passaram. A navegação pública fez somente leituras e encontrou dois lançamentos anteriores. **Smoke financiado novo não foi executado**: o proprietário escolheu versão de leitura, upload remoto está fechado e graduação não cabe no saldo. O job público CI ficou skipped, não PASS financeiro.

## 51. GitHub Actions

No código `908e540`, qualidade, Beta e dois validadores passaram: [qualidade PR](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41688892625), [Beta PR](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41688892664), [cadeia](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41688886191). O commit publicado `1c5127a` acrescenta a correção do gerador Pages, preservando o código financeiro.

**O HEAD final entregue deve ser identificado pelos [checks do Draft PR #11](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/11/checks) e pelo bloco de validação final no corpo do PR.** Ele é conferido após o push, sem usar os checks antigos acima para declarar aprovação automática de outro SHA. As evidências desta seção têm commits/ambientes próprios; não são uma promessa de resultado futuro.

## 52. Segurança de secrets

OAuth Wrangler foi armazenado em arquivo criptografado, com chave no **Windows Credential Manager**, fora do checkout. A permissão adicional de scripts foi inicialmente recusada pela revisão automática e só concedida após aprovação explícita do proprietário. Nenhum token foi impresso, gravado no frontend ou cadastrado como secret GitHub nesta etapa.

RETRY_DEVNET_FUNDER continua no ambiente protegido anterior, sem alteração de política/branch e sem revelar seu conteúdo. O backup DPAPI não foi movido ou usado para assinar. Workflows mantêm public Devnet manual, SHA revisado, orçamento e aprovação; PR de fork não recebe a chave. Sondas administrativas capturam autenticação apenas internamente e escrevem metadados públicos.

## 53. Desempenho

Publicação estática, gateway limitado a `/v1/*` e SDK DAMM carregado sob demanda preservados. Os percursos públicos não mostraram 429, asset quebrado ou erro JavaScript. Isso não é Lighthouse, benchmark de carga ou teste remoto de upload de 2 MB. CPU/quotas e propagação precisam ser revalidados antes de permitir uploads a vários testadores.

## 54. Arquivos criados

Patch bigint-buffer, gate de segurança, teste de runtime Worker/KV em disco, inspetor Cloudflare de leitura, sonda de armazenamento e verificador de preview público; novos testes de gate/prova antiga e configuração pública real. Foram criados os documentos obrigatórios em `docs/stage-8`, evidências JSON/PNG e este relatório. O diff do [PR #11](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/11/files) é a lista autoritativa final.

## 55. Arquivos modificados

Lockfile/workspace para patch fixado; build/prepare Beta, configuração de deploy, provas e componentes de liquidez, hook, banner de leitura, regressão de venda e testes de cadeia/browser. CI Beta inclui runtime Worker, branch Etapa 8 e suporte de navegador local; cadeia acompanha patches. README principal reflete o preview real. Nenhum contrato próprio, programa Rust, tesouraria ou configuração econômica foi introduzido.

## 56. Commits

| Commit de implementação | Mudança                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `933391b`               | gate nativo, liquidez explícita, regressões e runtime local                 |
| `d66e444`               | recusa AmountIsZero exigida para resíduo observado                          |
| `908e540`               | configuração real e modo de leitura aprovado                                |
| `1c5127a`               | localização/campos Pages aceitos pela versão instalada; fonte do deployment |

O commit de consolidação de testes públicos/documentação posterior aparece no histórico do PR e é validado após push. Seu hash não é inserido artificialmente dentro do próprio commit. Não houve reescrita de histórico.

## 57. Draft Pull Request

[**PR #11 — Etapa 8: Beta Solana Devnet, infraestrutura e validação pública**](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/11), base **feat/retry-devnet-beta-stage-7**, mantido Draft. O corpo final vincula este relatório, URLs, limites e os checks do HEAD efetivamente entregue. Não foi solicitada nem feita aprovação/merge de outros PRs.

## 58. Critérios de aceitação

| Gate original       | Estado                                                               |
| ------------------- | -------------------------------------------------------------------- |
| A — infraestrutura  | PARTIAL, leitura/publicação PASS; upload autenticado BLOCKED         |
| B — carteiras       | PARTIAL, leitura relatada + saldo verificado; assinaturas NOT TESTED |
| C — Create          | BLOCKED no preview de leitura                                        |
| D — DBC Trading     | BLOCKED publicamente; local PASS                                     |
| E — Graduation      | BLOCKED publicamente                                                 |
| F — Liquidity       | PARTIAL, prova local/resíduo explícito                               |
| G — Post Graduation | BLOCKED publicamente; local PASS                                     |
| H — Segurança       | PARTIAL, controle Beta aplicado; Mainnet não aprovada                |

[Checklist detalhado](../stage-8/RELEASE_CHECKLIST.md). A aceitação específica do preview de leitura foi cumprida; isso não converte os gates financeiros originais em PASS.

## 59. Funcionalidades concluídas

URL separada, versão rastreável, Devnet restrita, operações desligadas, Worker interno publicado, KV real, leituras públicas por hash, HTTP negativos, navegação desktop/mobile, saldo público verificado, relato de conexão real, correção de exposição nativa e apresentação exata de liquidez. CI/testes e documentação preservam os ambientes distintos.

## 60. Funcionalidades parciais

Infraestrutura está pronta para leitura, mas não para POST de testador. Phantom teve validação humana de leitura, sem versão da extensão e sem matriz de assinatura. Liquidity lock foi investigado localmente, incluindo resíduo e falhas negativas; falta ciclo público. As mitigações de dependências não são uma auditoria independente ou correção oficial upstream.

## 61. Bloqueios

Upload Access não ativado por opção sem cartão; preview intencionalmente sem transações; carteira humana sem SOL de teste; funder abaixo do orçamento de graduação; nenhuma prova pública nova de Create/Buy/Sell/LP/DAMM. Esses limites estão visíveis e não foram contornados com autenticação falsa, remoção de testes ou redução do threshold.

## 62. Custos

**Sem contratação paga ou uso de fundos reais.** Dois writes KV, 529 bytes de payload, leituras de validação e um deployment estável no plano Free. Uso agregado/fatura futura não foi certificado; quotas continuam aplicáveis. **Custo novo Solana público nesta etapa: 0 lamports enviados**, pois só houve leituras. O funder não financiou a Phantom, smoke ou graduação nesta entrega.

## 63. Pendências do proprietário

Para **usar o preview de leitura**, nenhuma ação adicional obrigatória. Para retomar Beta transacional: decidir autorização de upload sem cobrança inesperada, financiar carteira exclusiva apenas com SOL Devnet e operar assinaturas humanas, aprovar orçamento suficiente para graduação e executar a matriz pública. Versão do navegador/Phantom permanece dado não informado, sem impedir a leitura já validada. Não enviar chaves ou cartão pelo chat.

## 64. Preparação para Mainnet

Ainda não autorizada nem pronta. Exige evidências públicas completas, orçamento/custos, fonte/versão e autoridades dos programas, solução formal para a política de LP/resíduo, dependências/revisão independente, tesouraria aprovada e aprovação dos parâmetros exatos. Nenhuma variável de ambiente pode transformar a versão atual em Mainnet executável; constante false, aprovação null e config ausente foram mantidas.

## 65. Conclusão

A RETRY agora pode ser examinada numa **URL real de testes**, com dados Devnet reais e metadados lidos de KV remoto, preservando o site antigo e a identidade visual. O resultado entregue é o **preview de leitura escolhido pelo proprietário**, com provas, limites e continuidade reproduzível no GitHub. A Beta financeira pública permanece parcial; nenhuma assinatura, graduação ou garantia de 100% de LP foi inventada para fechar a etapa.
