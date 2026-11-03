# Matriz de aceitação da Beta

APPROVED exige a evidência daquele ambiente. PARTIAL não equivale a uma Beta pública liberada.

| Item                             | Estado nesta etapa | Evidência / bloqueio                                         |
| -------------------------------- | ------------------ | ------------------------------------------------------------ |
| PR stack preservado              | APPROVED           | #6/#8/#9 consultados, sem merge; worktree separado           |
| Versão-base identificada         | APPROVED           | b7a8863, PR #9                                               |
| Metadata Worker                  | PARTIAL            | Código/dry-run; endpoint remoto BLOCKED por conta            |
| KV persistente                   | NOT TESTED         | Testes em memória não comprovam KV remoto                    |
| Autorização/validação de upload  | PARTIAL            | JWT, CORS, limites e integridade locais; edge pendente       |
| Metadata URL real                | BLOCKED            | Sem deploy; build usa mesma origem HTTPS após publicação     |
| Preview utilizável               | BLOCKED            | Sem conta Cloudflare                                         |
| Mainnet desabilitada             | APPROVED           | Constante false/config nula e restrição no build Beta        |
| Phantom real                     | NOT TESTED         | Proprietário sem carteira de testes disponível               |
| Create com mint/pool pública     | NOT TESTED         | Nenhuma transação nova desta etapa                           |
| Compra pública                   | NOT TESTED         | Depende de preview/carteira/metadados                        |
| Venda pública                    | NOT TESTED         | Depende de criação/compra                                    |
| Discover público                 | PARTIAL            | Leitura implementada; novo lançamento público não exercitado |
| Graduação pública                | BLOCKED            | Carteira indisponível e saldo inferior ao orçamento          |
| Pool DAMM v2 pública             | NOT TESTED         | Sem nova migração                                            |
| Liquidity lock público           | NOT TESTED         | Sem novas posições para provar                               |
| Negociação pós-graduação pública | NOT TESTED         | Sem pool pública do cenário                                  |
| Segurança                        | PARTIAL            | Melhorias e redução de alertas; revisões/gates pendentes     |
| CI do código e01344f             | APPROVED           | Qualidade, Beta e dois validadores completos aprovados       |
| CI do commit documental final    | Conferir no PR     | Checks do último push conferidos separadamente na entrega    |
| Documentação e runbook locais    | APPROVED           | Este índice e relatório consolidado                          |

**Resultado geral: PARTIAL / bloqueada para liberação pública.** Criação e trading foram repetidos nos validadores locais desta etapa; os testes públicos permanecem históricos e não houve preview/Phantom atuais. Não usar o marco “criação e trading públicos validados” nesta entrega.
