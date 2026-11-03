# Segurança — revisão da Etapa 7

Esta é uma revisão de implementação e dependências, **não uma auditoria independente**.

## Correções

Integridade e não substituição de objetos content-addressed; limites de leitura no cliente; conferência da imagem além do JSON; fluxo de propagação sem repetição automática de POST; autorização explícita de uploads; domínio único para sessão Access; erro de login exibido corretamente; trava Devnet adicional; backoff/fila/prazo RPC; proteção contra clique concorrente na preparação de lançamento.

O Worker valida JWT RS256 por issuer/AUD/chaves da conta e expiração. Origin é somente política de navegador, nunca autenticação. Não houve introdução de senha compartilhada, assinatura de login Solana, nonce KV, segredo público ou autoridade de produção.

## Auditoria de dependências

`pnpm audit --prod --json` foi repetido nesta etapa. [Antes](evidence/dependency-audit-before.json): 6 altos/4 moderados. [Depois](evidence/dependency-audit-after.json): **1 alto/3 moderados**, zero críticos, sem supressões.

| Pacote e caminho                                | Correção/estado                                                | Exposição e limite da conclusão                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| toml 3.0.0, via Anchor                          | Override direcionado para 5.0.1; cinco alertas altos removidos | Parser de workspace Node; API parse preservada. Regressão dos SDKs/build precisa permanecer verde                                                                                                                                                                                         |
| uuid 8.3.2, via jayson                          | Override direcionado para 11.1.1; alerta moderado removido     | Jayson usa v4; versão 11 mantém entrada CJS e browser. Não houve atualização indiscriminada do SDK                                                                                                                                                                                        |
| bigint-buffer 1.1.5, via SPL Token/layout-utils | **OPEN, alto**, sem versão corrigida informada                 | Advisory é overflow no conversor nativo. Build nativo já está proibido no workspace; execução observada usa JS e pacote tem entrada browser. Não concluir que toda instalação está imune; não habilitar rebuild nativo. CLI fora dessa política continua risco residual                   |
| stream-json 1.9.1, via jayson                   | **OPEN, três moderados**                                       | Os caminhos apontam filtros/parser/Verifier do pacote Node. O frontend usa o cliente browser do Jayson; o Worker não importa Jayson/Anchor. O upgrade 3.x muda APIs/caminhos legados e não foi forçado. Requer revisão/upgrade upstream antes de novos usos Node com dados não confiáveis |

O Worker importa validação de campos/imagem e jose; não importa os SDKs financeiros. Os SDKs permanecem DBC 2.0.0/DAMM v2 1.5.1. Manter lockfile e política de builds. A existência de mitigação não zera o relatório de auditoria nem substitui revisão de exposição formal.

Fontes: [bigint-buffer](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg), [stream-json filtros](https://github.com/advisories/GHSA-528h-pc64-c93x), [stream-json parser](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x), [stream-json substituição](https://github.com/advisories/GHSA-mjw6-4jj6-33hc). Os JSONs de auditoria registram todos os caminhos e versões.

## Gates que continuam abertos

Autenticação e políticas no edge, persistência remota e quota/CPU Cloudflare não testadas; sem carteiras reais; graduação pública não executada; revisão independente não realizada. A validação de imagens não é um antivírus nem reencoder. A Beta deve permanecer restrita a testadores aprovados enquanto esses controles forem validados.

Mainnet permanece `MAINNET_EXECUTION_ENABLED = false`, aprovação nula e config ausente. Tesouraria, fee claimer e parâmetros financeiros não foram alterados. Não liberar Mainnet nem marcar Security APPROVED só porque testes passaram.
