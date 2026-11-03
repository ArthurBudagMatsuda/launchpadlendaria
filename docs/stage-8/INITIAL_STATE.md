# Estado inicial — Etapa 8

Verificado em **03/11/2026 (Brasília)**, antes de alterar o código. Evidências com timestamps usam UTC.

| Referência                                                                | HEAD verificado                            | Base  |
| ------------------------------------------------------------------------- | ------------------------------------------ | ----- |
| [PR #6](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/6)   | `a2d17485fbfceaacab1754adf0e3239dd83bdeda` | main  |
| [PR #8](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/8)   | `afa0f5e817fe9981f84c7b99467e9f4b4847333a` | PR #6 |
| [PR #9](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/9)   | `b7a88638b4cdb13bed2fb4fd24b110786cc00f2e` | PR #8 |
| [PR #10](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/10) | `2734e4166bb32a0d8462ec3b9f93517a98670df5` | PR #9 |

Todos estavam abertos e Draft. Fetch concluído; nenhum commit posterior a `2734e41` foi encontrado no PR #10. A ancestralidade inclui o trabalho anterior `d5f51eb` de proteção do funder e Worker. O checkout anterior estava limpo.

## Branch e preservação

Worktree exclusivo `E:/launchpadlendaria/.qa/retry-stage-8`, branch **`feat/retry-stage-8-public-devnet-beta`**, criada de `origin/feat/retry-devnet-beta-stage-7`. O checkout anterior e todos os outros worktrees foram preservados. Nenhum merge de PR, force-push, reset destrutivo ou mudança da main/site histórico.

## Arquitetura encontrada

Next.js 16.4.3, React, TypeScript, Tailwind, export estático, Wallet Standard. Meteora DBC SDK 2.0.0 e DAMM v2 SDK 1.5.1. Worker existente com jose/Access, KV content-addressed, rate binding e leitura pública. O PR #10 já preparou gateway Pages na mesma origem, propagação com releitura pública de JSON/imagem e build Devnet na raiz. Não criar nova curva/backend ou migrar armazenamento.

## Serviços, acessos e riscos iniciais

- Cloudflare CLI: `loggedIn=false`; nenhum token encontrado nas variáveis de ambiente consultadas. Sem acesso não é possível afirmar que a conta não tem deployments. O proprietário fez login no painel durante esta etapa; a autenticação oficial do terminal ainda precisa ser concluída.
- GitHub: acesso gerenciado funcional; secret `RETRY_DEVNET_FUNDER` existente no ambiente protegido `retry-devnet`, sem consultar seu conteúdo. Nenhum secret Cloudflare conhecido.
- Funder público: `3r8gEonYHrXEao85oFAu2UzVgT1KsxFmWUZLWBd8G5B3`, **2.013648909 SOL de teste**, slot `518287879`. Genesis Devnet conferido. Threshold **10 SOL**, reconfirmado na sonda posterior, slot `518290155`.
- Publicação antiga: GitHub Pages segue a main `0fcc9e51048dfeb2c2a9cea360f2285b6fa874a0`. Nenhum deployment Cloudflare constava dos dez deployments GitHub consultados; isso não prova inexistência na Cloudflare.
- Auditoria atual: **1 alto / 3 moderados / 0 críticos**, sem supressões. Native `bigint-buffer` precisa de controle verificável; stream-json exige revisão da exposição Node. Mainnet bloqueada por constante false, aprovação null e config ausente.
- Graduação pública não cabe no saldo disponível. Não reduzir threshold, comprar SOL real ou contornar faucet. A unidade de liquidez desbloqueada do relatório local requer análise e apresentação exata.
- Phantom real: inicialmente sem evidência. O proprietário confirmou que pode operar uma carteira exclusiva de testes e aprovar pessoalmente as assinaturas.

## Execução

1. Fechar exposição do conversor nativo e corrigir a garantia de liquidez/estado antigo.
2. Repetir testes, build, Worker e navegação, preservando todos os testes anteriores.
3. Inspecionar plano/recursos da conta Cloudflare; publicar Worker/KV/Pages isolados somente sem cobrança adicional e com upload protegido.
4. Conferir URL, commit, metadados públicos, hashes, rotas e cluster; preparar o fluxo Phantom para aprovação do proprietário.
5. Registrar evidências por ambiente, orçamento e bloqueios; publicar commits e Draft PR contra a branch do PR #10. Não mesclar.
