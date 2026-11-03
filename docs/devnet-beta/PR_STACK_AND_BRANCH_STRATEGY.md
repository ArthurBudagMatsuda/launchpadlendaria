# Branches e PRs

Consulta pública do GitHub em 02/11/2026: PRs [#6](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/6), [#8](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/8) e [#9](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/9) abertos, Draft, mergeables e sem conflitos informados pela API.

| PR  | Head                                     | Base                       | Commit confirmado                        |
| --- | ---------------------------------------- | -------------------------- | ---------------------------------------- |
| #6  | migration/retry-solana                   | main                       | a2d17485fbfceaacab1754adf0e3239dd83bdeda |
| #8  | feat/retry-meteora-dbc-mvp               | migration/retry-solana     | afa0f5e817fe9981f84c7b99467e9f4b4847333a |
| #9  | feat/retry-meteora-create-trade-graduate | feat/retry-meteora-dbc-mvp | b7a88638b4cdb13bed2fb4fd24b110786cc00f2e |

Etapa 7 parte de **#9**, preservando seus ancestrais, em `feat/retry-devnet-beta-stage-7`. O worktree local fica em `.qa/stage-7` dentro da pasta original. É uma cópia de trabalho Git registrada, não um diretório de cache descartável. Os relatórios e ZIPs anteriores da pasta principal foram preservados fora dos commits desta etapa.

O [Draft PR #10](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/10) foi aberto com **base `feat/retry-meteora-create-trade-graduate`**. A ordem de integração continua #6 → #8 → #9 → Etapa 7. Não executar merge, rebase destrutivo ou force-push para gerar um preview.

O site público segue em `0fcc9e51048dfeb2c2a9cea360f2285b6fa874a0` na `main`, versão Base. O workflow Pages da produção não foi alterado. O workflow de validação da Etapa 7 apenas gera artefatos.

## Entrega remota

A integração e a CLI `gh` não estavam disponíveis, mas a verificação posterior confirmou credencial GitHub gerenciada pelo Git, acesso à API e permissão no dry-run de push. Ela é usada somente em memória, sem exibir ou gravar o token. O secret **RETRY_DEVNET_FUNDER** foi confirmado apenas por nome no environment `retry-devnet`; seu conteúdo não é recuperável pela API. O relatório e a evidência remota registram o resultado final da publicação e do CI.

Branch publicada e [Draft PR #10 aberto](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/10), base no PR #9. Nenhum merge ou alteração do site público.

Para manutenção futura com CLI oficial instalada/autenticada, revisar e usar explicitamente:

```sh
git push --set-upstream origin HEAD:refs/heads/feat/retry-devnet-beta-stage-7
gh pr create --draft --base feat/retry-meteora-create-trade-graduate --head feat/retry-devnet-beta-stage-7 --title "Etapa 7: preparação da RETRY Devnet Beta" --body-file docs/devnet-beta/PULL_REQUEST.md
```

Executar esses comandos no worktree da Etapa 7, não na branch do PR #9.
