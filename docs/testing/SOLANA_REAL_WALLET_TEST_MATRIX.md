# RETRY — Matriz de validação de carteiras Solana

Revisão do PR #6 em 28/10/2026. **Nenhuma extensão real foi conectada.** O operador respondeu nesta revisão: “Não; registre os testes reais como pendentes”. Carteiras pessoais não foram usadas. Não houve instalação de extensões, criação/importação de contas, assinatura, airdrop ou transação.

## Classificação de evidência

- **AUTOMATIZADO SIMULADO:** Wallet Standard/RPC implementados por fixtures; comprova o comportamento do aplicativo sob essas respostas.
- **REAL AUTOMATIZADO:** extensão/aplicativo oficial efetivamente utilizado em perfil de teste controlado. Nenhum caso desse nível nesta revisão.
- **REAL MANUAL:** operador utilizou carteira real e registrou evidência. Nenhum caso desse nível nesta revisão.
- **PENDENTE:** cenário não executado, inclusive quando não há conta de teste disponível.
- **FALHOU:** cenário executado e reprovado. Falhas reproduzidas e corrigidas em mocks estão descritas no relatório; não representam falhas observadas em extensões reais.

As consultas reais aos RPCs oficiais, sem carteira, constam em [PR6_PUBLIC_RPC_READS.json](evidence/PR6_PUBLIC_RPC_READS.json). Elas **não aprovam uma carteira ou sua autorização na origem pública**.

## Matriz real por ambiente

P = PENDENTE. Versão, sistema e navegador reais só serão preenchidos depois de um teste efetivo. “Não executado” não significa que a carteira não oferece suporte ao ambiente.

| Carteira | Versão        | Sistema operacional | Navegador     | Tipo                  | Cluster          | Conexão | SOL | Desconexão | Reconexão | Conta | Rejeição | Navegação | Evidência           | Observações                                       |
| -------- | ------------- | ------------------- | ------------- | --------------------- | ---------------- | ------- | --- | ---------- | --------- | ----- | -------- | --------- | ------------------- | ------------------------------------------------- |
| Phantom  | Não utilizada | Não utilizado       | Não utilizado | Extensão              | Devnet           | P       | P   | P          | P         | P     | P        | P         | Decisão do operador | Sem conta de teste disponível                     |
| Phantom  | Não utilizada | Não utilizado       | Não utilizado | Extensão              | Mainnet, leitura | P       | P   | P          | P         | P     | P        | P         | Decisão do operador | Não usar fundos pessoais                          |
| Solflare | Não utilizada | Não utilizado       | Não utilizado | Extensão              | Devnet           | P       | P   | P          | P         | P     | P        | P         | Decisão do operador | Sem conta de teste disponível                     |
| Solflare | Não utilizada | Não utilizado       | Não utilizado | Extensão              | Mainnet, leitura | P       | P   | P          | P         | P     | P        | P         | Decisão do operador | Não usar fundos pessoais                          |
| Backpack | Não utilizada | Não utilizado       | Não utilizado | Extensão              | Devnet           | P       | P   | P          | P         | P     | P        | P         | Decisão do operador | Sem conta de teste disponível                     |
| Backpack | Não utilizada | Não utilizado       | Não utilizado | Extensão              | Mainnet, leitura | P       | P   | P          | P         | P     | P        | P         | Decisão do operador | Não usar fundos pessoais                          |
| Phantom  | Não utilizada | Não utilizado       | Não utilizado | Aplicativo móvel real | Devnet           | P       | P   | P          | P         | P     | P        | P         | Não executado       | Emulação Pixel 7 não valida o aplicativo Phantom  |
| Solflare | Não utilizada | Não utilizado       | Não utilizado | Aplicativo móvel real | Devnet           | P       | P   | P          | P         | P     | P        | P         | Não executado       | Emulação Pixel 7 não valida o aplicativo Solflare |
| Backpack | Não utilizada | Não utilizado       | Não utilizado | Aplicativo móvel real | Devnet           | P       | P   | P          | P         | P     | P        | P         | Não executado       | Emulação Pixel 7 não valida o aplicativo Backpack |

## Matriz automatizada simulada

A = aprovado nos testes especificados. Versão do mock: fixture desta branch; não corresponde a uma versão oficial de extensão. O sistema local foi Windows `10.0.26200.0`, Chrome `156.0.8078.48`, Playwright `1.63.0`. “Mobile” é emulação Pixel 7 em Chromium/Chrome, sem aplicativo real. O registro de CI complementa estes resultados em runner Linux.

| Carteira simulada | Versão      | Sistema | Navegador                   | Tipo | Clusters       | Conexão | SOL | Desconexão | Reconexão        | Conta | Rejeição | Navegação | Evidência                                  | Observações               |
| ----------------- | ----------- | ------- | --------------------------- | ---- | -------------- | ------- | --- | ---------- | ---------------- | ----- | -------- | --------- | ------------------------------------------ | ------------------------- |
| Phantom           | Fixture PR6 | Windows | Chrome 156, desktop         | Mock | Devnet/Mainnet | A       | A   | A          | A, silent reload | A     | A        | A, SPA    | `e2e/solana-app.spec.ts`, integração React | Não é Phantom instalada   |
| Phantom           | Fixture PR6 | Windows | Chrome 156, Pixel 7 emulado | Mock | Devnet/Mainnet | A       | A   | A          | A, silent reload | A     | A        | A, SPA    | Mesmo teste, projeto mobile                | Sem deep link/mobile real |
| Solflare          | Fixture PR6 | Windows | Chrome 156, desktop         | Mock | Devnet/Mainnet | A       | A   | A          | A, silent reload | A     | P¹       | A, SPA    | Teste parametrizado e integração React     | Não é Solflare instalada  |
| Solflare          | Fixture PR6 | Windows | Chrome 156, Pixel 7 emulado | Mock | Devnet/Mainnet | A       | A   | A          | A, silent reload | A     | P¹       | A, SPA    | Mesmo teste, projeto mobile                | Sem aplicativo real       |
| Backpack          | Fixture PR6 | Windows | Chrome 156, desktop         | Mock | Devnet/Mainnet | A       | A   | A          | A, silent reload | A     | P¹       | A, SPA    | Teste parametrizado e integração React     | Não é Backpack instalada  |
| Backpack          | Fixture PR6 | Windows | Chrome 156, Pixel 7 emulado | Mock | Devnet/Mainnet | A       | A   | A          | A, silent reload | A     | P¹       | A, SPA    | Mesmo teste, projeto mobile                | Sem aplicativo real       |

¹ O cenário de rejeição usa uma implementação Wallet Standard simulada nomeada Phantom e exercita o provider comum. Não foi repetido com os nomes Solflare/Backpack nem executado em suas extensões. O resultado aprova o caminho compartilhado, não particularidades de cada carteira.

O mock entrega saldos deliberadamente diferentes: conta A em Devnet = `1.500000001 SOL`; conta B = `2.5 SOL`; conta B em Mainnet = `4.5 SOL`. Isso permite detectar reutilização de saldo entre contas ou clusters. Estes valores são fictícios e existem apenas no teste, não no catálogo do produto.

## Preparação reproduzível para os testes reais

1. Usar perfil de navegador isolado e conta exclusiva de teste, sem fundos relevantes. Registrar sistema, navegador, versão da extensão e origem. Não importar carteira pessoal.
2. Instalar somente a extensão indicada pelo site oficial: [Phantom](https://phantom.com/), [Solflare](https://solflare.com/), [Backpack](https://backpack.app/). O operador cria/desbloqueia a conta; não registrar senha, seed ou private key.
3. Preparar a aplicação com Node 24 e pnpm 11.25.0: `pnpm install --frozen-lockfile`, `pnpm build:pages`, `pnpm preview:pages`. Abrir `http://127.0.0.1:4174/launchpadlendaria/`.
4. Começar em Devnet. Conectar é autorização de leitura de identidade; qualquer pedido de assinatura ou transação deve interromper o teste e ser registrado como falha.
5. O operador aprova ou rejeita o prompt na extensão. Comparar o endereço exibido com a conta escolhida. Comparar SOL com o Explorer **no mesmo cluster** e anotar horário/slot. Saldo zero legítimo é aceitável; não fazer airdrop para produzir um saldo.
6. Repetir os casos abaixo, primeiro com cada carteira isolada e depois com as três instaladas. Não abrir transações ou sites de negociação.
7. Mainnet: repetir somente conexão e leituras públicas, sem mudar a conta de teste para uma carteira pessoal. O seletor RETRY troca o RPC do aplicativo; não promete trocar a rede da extensão.
8. Depois de uma prévia/domínio autorizado, repetir os casos de origem. Sucesso em localhost não comprova autorização da extensão em `github.io` ou domínio próprio.
9. Publicar apenas evidência necessária, com endereço abreviado quando possível. Nunca capturar telas de recuperação/importação ou credenciais. Screenshots existentes nesta pasta são simulados e estão identificados pelos nomes dos arquivos.

## Casos individuais reais pendentes

| Caso                    | Procedimento e resultado esperado                                            | Phantom | Solflare | Backpack |
| ----------------------- | ---------------------------------------------------------------------------- | ------- | -------- | -------- |
| W01 Detecção            | Extensão oficial disponível e apresentada uma vez no seletor                 | P       | P        | P        |
| W02 Seleção             | Escolher a carteira correta, sem opção EVM confundida com Solana             | P       | P        | P        |
| W03 Autorização         | Prompt real abre; operador aprova só a conexão                               | P       | P        | P        |
| W04 Endereço            | Chave pública coincide com a conta Solana escolhida                          | P       | P        | P        |
| W05 SOL Devnet          | Saldo corresponde ao RPC/Explorer de Devnet                                  | P       | P        | P        |
| W06 SOL Mainnet         | Leitura Mainnet é distinta de Devnet, sem assinatura                         | P       | P        | P        |
| W07 SPA                 | Navegar Discover → Portfolio → Create → Discover sem nova aprovação indevida | P       | P        | P        |
| W08 Reload              | Recarregar; reconexão silenciosa só se já autorizada e suportada             | P       | P        | P        |
| W09 Desconexão          | RETRY limpa identidade/saldo; observar se a extensão revoga a sessão         | P       | P        | P        |
| W10 Reconexão           | Após desconectar, conectar de novo pelo seletor                              | P       | P        | P        |
| W11 Conta               | Trocar conta na extensão; endereço e saldo atualizam juntos                  | P       | P        | P        |
| W12 Rejeição            | Operador rejeita; RETRY fica desconectada com mensagem clara                 | P       | P        | P        |
| W13 Bloqueada           | Bloquear extensão; registrar comportamento sem desbloqueio automático        | P       | P        | P        |
| W14 Indisponível        | Extensão desabilitada/ausente; não apresentar conexão fictícia               | P       | P        | P        |
| W15 RPC falho           | Interromper consulta controlada; exibir indisponibilidade, não zero          | P       | P        | P        |
| W16 Múltiplas extensões | Listar marcas sem duplicação e preservar seleção correta                     | P       | P        | P        |
| W17 Mobile real         | Repetir no navegador interno oficial; registrar suporte real de cada app     | P       | P        | P        |
| W18 Origem final        | Repetir autorização e reload na prévia/domínio final autorizado              | P       | P        | P        |

Para falhas, anotar caso, versão, origem, horário, comportamento esperado/obtido e evidência sem segredos. Os bugs simulados e suas correções constam em [RETRY_PR6_REVIEW_AND_WALLET_VALIDATION.md](../reports/RETRY_PR6_REVIEW_AND_WALLET_VALIDATION.md).

## Execução automatizada reproduzível

```sh
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:rpc:live
```

No Windows local desta revisão foi usado `PLAYWRIGHT_CHANNEL=chrome`. `test:rpc:live` é opt-in e consulta apenas o System Program público; não depende de carteira. CI normal permanece determinístico, com mocks e sem dependência obrigatória dos RPCs públicos.

## Critério de liberação

Estado: **revisão técnica concluída com validação manual pendente**. Não usar a matriz simulada como aprovação de produção. Manter o PR em Draft até o responsável aceitar as correções, concluir a matriz real necessária e aprovar a origem/publicação. Nenhuma operação financeira é liberada por esta revisão.
