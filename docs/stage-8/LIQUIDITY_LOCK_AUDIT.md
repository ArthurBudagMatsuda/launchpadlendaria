# Auditoria de liquidez — resíduo explícito

**PARTIAL para liberação pública/Mainnet.** Nenhuma posição pública nova foi graduada. Os números abaixo foram lidos de programas reais em **validadores locais**, não da Devnet pública.

| Unidade bruta de liquidez           | Resultado em ambas as variantes     |
| ----------------------------------- | ----------------------------------- |
| Total da pool                       | `823314404508605138322788080705105` |
| Principal permanentemente bloqueado | `823314404508605138322788080705104` |
| Desbloqueado na posição do criador  | `1`                                 |
| Desbloqueado na posição do parceiro | `0`                                 |
| Vesting                             | `0`                                 |
| `verified` / `fullyLocked`          | `true` / `false`                    |

Percentual exato: **100 × 823314404508605138322788080705104 / 823314404508605138322788080705105 %**. Aproximadamente `99.9999999999999999999999999999998785%`. A UI mostra **99.999999%**, truncando para baixo com precisão ampliada, e expõe os inteiros exatos. Não exibe 100% literal para esse caso.

O resíduo está no campo unlocked, controlado pelo holder do NFT da posição do criador. Não é um token nem um lamport. O rateio inteiro da migração 50/50 é compatível com esse resto; esta explicação é uma inferência do estado e da configuração, não uma certificação de correspondência fonte/binário de todos os cálculos.

Foi construída uma retirada exatamente da unidade residual e **simulada**, sem envio: o programa respondeu **6006 / AmountIsZero** em ambas as variantes. Nesse preço/estado o resíduo não resulta em saída resgatável. Isso não prova impossibilidade universal em qualquer preço ou após novas adições. Pedidos acima do resíduo, terceiros, NFT incorreto e fechamento de posição com liquidez foram recusados em testes separados; fee claim não reduziu o principal permanente.

O primeiro teste novo supunha sucesso da retirada mínima e falhou, revelando esse comportamento; foi corrigido para exigir o erro específico e verificar principal inalterado. A falha inicial não foi ocultada nem contada como aprovação.

O SDK/protocolo possui `permanentLockPosition` para mover liquidez unlocked para permanent lock, conforme [instruções oficiais](https://github.com/MeteoraAg/docs/blob/main/developer-guides/damm-v2/program/instructions.mdx). Exigiria ação autorizada do holder e validação própria; não foi aplicada. Mudar 50/50 para 100/0 para eliminar rateio alteraria a política e não foi feito. Taxas, NFT e autoridade de principal são direitos distintos. Programas Meteora atualizáveis também limitam uma garantia absoluta.

Leia [evidência Devnet local](evidence/validator-devnet-programs-local.json) e [Mainnet local](evidence/validator-mainnet-programs-local.json), passos `lock verification`, `rounding remainder withdrawal simulation`, `withdrawal refused` e `LP fee claim`. Mainnet fica bloqueada até revisão da política, fonte/versão, autoridades e prova pública.
