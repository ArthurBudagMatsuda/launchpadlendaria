# Carteiras: assinatura das operações Meteora

A conexão de carteiras (descoberta Wallet Standard, conectar, desconectar, eventos de conta, cluster, reconexão silenciosa) é a do PR #6 e está em [docs/SOLANA_WALLET_INTEGRATION.md](../SOLANA_WALLET_INTEGRATION.md). Este documento cobre o que as etapas 3 a 6 acrescentaram: como uma operação Meteora é assinada e o que a RETRY confere antes e depois.

Código: `src/lib/meteora/wallet-signer.ts`, `src/lib/meteora/transactions.ts` (`execute`, `validateTransaction`, `validateSigned`), `src/hooks/use-retry.ts` (`useExecute`).

## Quem assina o quê

| Operação                           | Assinaturas                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Criar token (+ primeira compra)    | a carteira conectada e o keypair do mint, gerado no navegador só para essa transação             |
| Comprar, vender (curva ou DAMM v2) | só a carteira                                                                                    |
| Graduar (migração manual)          | a carteira (paga só rede e aluguel) e os dois keypairs das NFTs de posição, gerados no navegador |
| Sacar taxas do criador ou de LP    | só a carteira dona                                                                               |

A RETRY não tem carteira que assine pelo usuário e não guarda chave de ninguém. Os keypairs gerados no navegador assinam uma vez e não são gravados (o registro da operação guarda só endereços públicos). O mint perde a autoridade de mint e de freeze na própria criação, e as NFTs vão para o parceiro e o criador, então nenhuma dessas chaves tem poder depois.

## O caminho de uma assinatura

`useExecute(feature)` → `execute()`:

1. **Política**: o recurso precisa estar ligado no cluster (`executionPolicy`); a biblioteca confere de novo com `assertWritable` ao montar.
2. **Blockhash** recente e **allowlist** (`validateTransaction`): só as instruções e contas que a operação precisa; pagador = carteira; nenhum signatário além da carteira e dos keypairs esperados.
3. **Simulação** da transação exata no RPC. Erro de simulação: nada é pedido à carteira.
4. **Carteira**: `walletSigner` serializa a transação e chama `solana:signTransaction` da conta Wallet Standard conectada, com a `chain` do cluster do app (`solana:devnet` ou `solana:mainnet`). A carteira só assina; quem envia é a RETRY, para gravar a assinatura antes do envio. Carteira sem `solana:signTransaction` não assina aqui (`supportsSigning`).
5. **O que voltou** (`validateSigned`): mesmo pagador, mesmo blockhash, todas as instruções da RETRY na mesma ordem e sem mudança. A carteira só pode acrescentar Compute Budget e asserções Lighthouse (a Phantom acrescenta). Qualquer outra mudança aborta.
6. **Keypairs extras** assinam (`partialSign`) e `verifySignatures(true)` confere todas as assinaturas. Uma assinatura que não é da conta pagadora aborta antes do envio.
7. **Registro** da operação no navegador (`retry:solana:operations:v1`, só dados públicos) com status `sent`, **antes** do envio.
8. **Envio** com preflight (`skipPreflight: false`) e **confirmação** (reenvio dos mesmos bytes assinados enquanto o blockhash vale; nunca uma transação nova).

## Situações de carteira

| Situação                                  | O que acontece                                                                                  | Evidência                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Usuário rejeita no pop-up                 | "You cancelled the request in your wallet. Nothing was sent."                                   | `tests/meteora.test.ts` (mensagens), `e2e/solana-app.spec.ts` "rejection and RPC failure have honest user states"       |
| Conta trocada durante a assinatura        | a assinatura não é da conta pagadora → `verifySignatures` falha → nada enviado, nada registrado | `tests/meteora.test.ts` "sends nothing when the wallet signs with another account"                                      |
| Carteira altera a transação               | recusada por `validateSigned`                                                                   | `tests/meteora.test.ts` "rejects a changed fee payer, blockhash, instruction, or an added transfer"                     |
| Carteira devolve lixo ou nada             | erro claro, nada enviado                                                                        | "refuses wallets without signing and garbage responses"                                                                 |
| Endereço não corresponde à chave          | recusado no `walletSigner` e no provider                                                        | `tests/integration/solana-wallet.test.tsx`                                                                              |
| Desconexão                                | o executor exige carteira conectada; a operação em andamento falha na carteira e nada é enviado | testes do provider (PR #6)                                                                                              |
| RPC de outra rede                         | `assertCluster` recusa antes de montar; nenhuma conta é lida                                    | `tests/meteora.test.ts` "builds nothing when the RPC answers for another cluster"; leituras: `tests/solana-rpc.test.ts` |
| Conta não anuncia o cluster do app        | a interface explica; a RETRY não pede troca de rede à carteira                                  | PR #6                                                                                                                   |
| Recarregar a página durante a confirmação | a operação `sent` é reconciliada pelo estado da chain; nada é reenviado                         | "settles sent operations from chain state only"                                                                         |

## Testes com carteira

- **Automatizados**: carteiras Wallet Standard simuladas com os nomes Phantom, Solflare e Backpack, desktop e mobile emulado (`e2e/solana-app.spec.ts`), e uma carteira de teste Wallet Standard que assina com uma chave local no navegador contra o validador com os programas da Meteora (`e2e/chain/meteora-browser.spec.ts`: lançamento, compra, venda, compra que completa a curva, graduação, compra no DAMM v2, saque de LP e portfolio, exatamente sete assinaturas). Eles provam o caminho de assinatura do app, não uma extensão real.
- **Reais: pendentes.** Nenhuma extensão real foi usada. O operador decidiu registrar os testes reais como pendentes e não há carteira exclusiva de testes. A chave de CI da Devnet (PR #8) não é carteira de usuário e nunca vai para o navegador. Matrizes: [docs/testing/SOLANA_REAL_WALLET_TEST_MATRIX.md](../testing/SOLANA_REAL_WALLET_TEST_MATRIX.md) e [docs/testing/RETRY_PHANTOM_REAL_WALLET_TESTS.md](../testing/RETRY_PHANTOM_REAL_WALLET_TESTS.md). O roteiro manual está no [OPERATIONAL_RUNBOOK.md](OPERATIONAL_RUNBOOK.md).

Para um teste real na Devnet hoje: a config RETRY de Devnet está registrada, então comprar e vender um token RETRY existente funciona com uma carteira de teste; lançar um token novo ainda depende do Worker de metadados implantado.
