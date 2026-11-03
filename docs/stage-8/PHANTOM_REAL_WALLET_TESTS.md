# Phantom real — validação do proprietário

**PARTIAL.** O proprietário operou sua conta de testes e informou endereço e saldo após conectar ao preview. Confirmou posteriormente: **“Tudo funcionou”** para refresh, Portfolio, desconexão e reconexão, mantendo endereço/saldo. Não houve observação direta da extensão pelo agente.

Endereço: `Z8WdA8JSjtbvNfGLF9aMTbb6DS94eHnMMEE4k55ZDZ7`. RPC pública Devnet confirmou **0 lamports**, slot **518302931**, em `2026-11-03T18:16:39Z`, com genesis Devnet correto. [Evidência separada](evidence/phantom-owner-and-balance.json).

| Caso real                                                                        | Resultado / fonte                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Conexão e endereço exibido                                                       | PASS relatado pelo proprietário                          |
| Saldo 0 SOL                                                                      | PASS, relato + RPC independente                          |
| Refresh, Portfolio, disconnect/reconnect                                         | PASS relatado pelo proprietário                          |
| Versões do navegador/Phantom                                                     | NOT TESTED, não informadas                               |
| Assinar Create/Buy/Sell, rejeição de assinatura                                  | NOT TESTED; preview somente leitura                      |
| Carteira bloqueada, troca de conta, rejeição e RPC interrompida na extensão real | NOT TESTED; cobertura simulada não conta como prova real |

Os 30 cenários automatizados usam Wallet Standard simulado. Os dois percursos públicos usam perfis novos sem extensão. Nenhuma dessas categorias deve ser chamada de Phantom real. Nenhuma seed, chave ou assinatura foi solicitada; nenhum saldo foi transferido para financiar essa conta.
