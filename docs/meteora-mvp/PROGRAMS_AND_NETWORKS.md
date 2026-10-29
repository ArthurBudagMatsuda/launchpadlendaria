# Programas, redes e flags

Estado em 29/10/2026, branch `feat/retry-meteora-create-trade-graduate` (PR #9, empilhado sobre o PR #8). Código: `src/lib/meteora/programs.ts`, `src/config/solana.ts`, `src/config/retry-protocol.ts`, `src/lib/meteora/client.ts`.

## Programas oficiais usados

A RETRY não tem programa on-chain próprio. Toda transação financeira chama apenas os programas abaixo.

| Programa                   | Endereço                                       | Versão usada                                                                         | Para quê                                                       |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Meteora DBC                | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`  | IDL `dynamic_bonding_curve` 0.2.2, SDK `@meteora-ag/dynamic-bonding-curve-sdk` 2.0.0 | criação da pool, compra e venda na curva, migração, taxas      |
| Meteora DAMM v2 (`cp_amm`) | `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`  | IDL `cp_amm` 0.2.5, SDK `@meteora-ag/cp-amm-sdk` 1.5.1                               | pool graduada, negociação depois da graduação, taxas de LP     |
| Meteora Locker             | `LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn`  | —                                                                                    | vesting do DBC; a config RETRY não tem vesting                 |
| Metaplex Token Metadata    | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`  | —                                                                                    | nome, ticker e URI do token (chamado pelo DBC)                 |
| SPL Token                  | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`  | —                                                                                    | mint do token, cofres, WSOL                                    |
| Token-2022                 | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`  | —                                                                                    | só as NFTs de posição do DAMM v2                               |
| Associated Token Account   | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` | —                                                                                    | contas de token da carteira                                    |
| System Program             | `11111111111111111111111111111111`             | —                                                                                    | só a transferência para a própria conta WSOL da carteira       |
| Compute Budget             | `ComputeBudget111111111111111111111111111111`  | —                                                                                    | limite de compute units (a RETRY não acrescenta priority fee)  |
| Lighthouse                 | `L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95`  | —                                                                                    | só quando a carteira (Phantom) acrescenta asserções ao assinar |

WSOL: `So11111111111111111111111111111111111111112`. O Token-2022 nunca é aceito para o token lançado: `validateRetryPool` e `validateDammPool` exigem SPL Token.

### Contas fixas de que o fluxo depende

| Conta                                    | Endereço                                       | Observação                                                                                     |
| ---------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Pool authority do DBC                    | `FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM` | empresta o aluguel das contas do DAMM v2 na graduação e é reembolsada na mesma instrução       |
| Config DAMM v2 de migração (FixedBps100) | `Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp` | config pública da Meteora, LP de 1%, restrita ao DBC (`poolCreatorAuthority` = pool authority) |
| Pool authority do DAMM v2                | `HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC` | dona dos cofres da pool graduada                                                               |
| Event authority do DAMM v2               | `3rmHSu74h1ZcmAisVcWerTCiRDQbUrBKmcwptYGjHfet` | PDA `__event_authority` do `cp_amm`, fixada na allowlist                                       |

### Como os IDs ficam presos

- `programs.ts` repete os IDs e `assertSdkProgramIds()` compara com as constantes do SDK do DBC (DBC, DAMM v2, Metaplex e a pool authority derivada). O cliente do DAMM v2 faz a mesma conferência com `CP_AMM_PROGRAM_ID`. Se uma atualização de SDK mudar um endereço, o app recusa montar transações e os testes falham.
- `tests/meteora.test.ts` ("pins program IDs and the graduated pool config") e `tests/meteora-damm.test.ts` ("match the official cp_amm IDL (0.2.5) instruction by instruction") conferem IDs, discriminadores e a ordem das contas.
- O frontend não aceita Program ID vindo de fora: os endereços são constantes do código, e a allowlist recusa qualquer outro programa.

### Binários e autoridade de upgrade (medido no Actions)

O job "Pinned programs on Devnet and Mainnet (read-only)" (`tests/chain/verify-programs.mjs`) só lê. Em 29/10/2026 ([execução 40972474049](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40972474049)):

| Programa | Autoridade de upgrade na Mainnet               | Autoridade de upgrade na Devnet                | Bytes do binário (Mainnet / Devnet) |
| -------- | ---------------------------------------------- | ---------------------------------------------- | ----------------------------------- |
| DBC      | `JADaUV8kvDpDbJr55wxXJHVaBS3VCj8thZZHjfeuCVLd` | `DHLXnJdACTY83yKwnUkeoDjqi4QBbsYGa1v8tJL76ViX` | 1.693.313 / 1.693.313               |
| DAMM v2  | `JADaUV8kvDpDbJr55wxXJHVaBS3VCj8thZZHjfeuCVLd` | `DHLXnJdACTY83yKwnUkeoDjqi4QBbsYGa1v8tJL76ViX` | 1.430.777 / 1.430.785               |
| Locker   | `CvQZZ23qYDWF2RUpxYJ8y9K4skmuvYEEjH7fK58jtipQ` | `DHLXnJdACTY83yKwnUkeoDjqi4QBbsYGa1v8tJL76ViX` | 556.241 / 534.761                   |
| Metaplex | nenhuma (imutável)                             | `6Vwz7AXYG6V1TUPP3KWYZncMEvUv6iPSFbfHDCLRcjtz` | não registrado                      |

SHA-256 dos binários (linhas `PROGRAM_HASH` do job do validador, [execução 40972474049](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40972474049)):

```text
DBC      Mainnet 4c1433047f0260817fa6b3376e166b2e3503a7b54718caf54a92941da5404613
DBC      Devnet  9f652df38b27f83565eb2d5271a6a4e8c9ccbc6a721ed1fadf299154b1753b0d
DAMM v2  Mainnet 0712ca6d350757b9a71a0ea40da8fe9d5b48fca044f2deae0b65a33320e6a59b
DAMM v2  Devnet  f838b2ae3ed237211319493045b0a172c0946fd72ba8152895b98bb4d8a29a9c
Locker   Mainnet c0c7851d48c05abbd74e129e349e83f9343e52ef789cf9ea451575c07515b160
Locker   Devnet  2e9a786b101ff489031a2aff0ec9abc312dcc9a55aeb59a8068420bbbe29e088
```

Consequências:

- **Os programas da Meteora são atualizáveis** pela autoridade da Meteora. Toda garantia que vem do programa (bloqueio da liquidez, divisão de taxas, slippage) vale para o binário em produção no momento e pode mudar com um upgrade. A RETRY registra o hash a cada execução para perceber a mudança; não pode impedi-la.
- **Os binários de Devnet e Mainnet são diferentes.** Por isso o fluxo completo roda no validador local duas vezes, uma com cada binário (ver [TESTING.md](TESTING.md)).

## Redes

| Rede     | `cluster`      | Genesis hash                                   | RPC padrão                       | `chain` da carteira | Execução                                                            |
| -------- | -------------- | ---------------------------------------------- | -------------------------------- | ------------------- | ------------------------------------------------------------------- |
| Devnet   | `devnet`       | `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` | `https://api.devnet.solana.com`  | `solana:devnet`     | ligada; config RETRY `8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N` |
| Mainnet  | `mainnet-beta` | `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d` | `https://api.mainnet.solana.com` | `solana:mainnet`    | **bloqueada**                                                       |
| Localnet | —              | o do validador                                 | `http://127.0.0.1:8899`          | —                   | só em testes, com `customContext` e uma config criada no teste      |

- O app só conhece Devnet e Mainnet. Localnet não é um terceiro modo do site: os testes on-chain criam o contexto com `customContext(connection, config, genesis)`. O teste no navegador reescreve a resposta de `getGenesisHash` do validador para o genesis da Devnet, e o resto do RPC é o validador de verdade.
- `assertCluster` compara o genesis hash do RPC com o do cluster escolhido antes de montar ou enviar qualquer transação (cache de 60 s). RPC de outra rede: nada é montado.
- O `walletSigner` passa a `chain` do cluster para `solana:signTransaction`.
- O aluguel mínimo é do cluster. Em 29/10/2026 a Devnet e a Mainnet cobravam 5.080 lamports por byte (contando 128 bytes por conta) e o validador local 6.960 (linhas `RENT` do job de leitura). Custos medidos no validador superestimam o aluguel; a conversão está em [DEVNET_E2E_RESULTS.md](DEVNET_E2E_RESULTS.md#custos-por-cluster).

## Variáveis de ambiente (build do site)

| Variável                                                             | Padrão                 | Efeito                                                                                              |
| -------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SOLANA_CLUSTER`                                         | `devnet`               | `devnet` ou `mainnet-beta`; outro valor derruba o build                                             |
| `NEXT_PUBLIC_SOLANA_RPC_URL`                                         | RPC público do cluster | precisa ser `https` (ou `http` em loopback) e não pode ter usuário/senha                            |
| `NEXT_PUBLIC_SOLANA_WS_URL`                                          | —                      | `wss`, ou `ws` no mesmo host loopback do RPC                                                        |
| `NEXT_PUBLIC_RETRY_METADATA_URL`                                     | —                      | URL do Worker de metadados. Sem ela, o lançamento fica desligado com explicação                     |
| `NEXT_PUBLIC_RETRY_DISABLED_FEATURES`                                | —                      | parada de emergência: lista de recursos a desligar, ou `all`. Só desliga                            |
| `NEXT_PUBLIC_BASE_PATH`                                              | —                      | caminho do GitHub Pages                                                                             |
| `NEXT_PUBLIC_ENABLE_LIVE_TRADING`, `NEXT_PUBLIC_ENABLE_TOKEN_LAUNCH` | —                      | antigas. Qualquer valor diferente de vazio ou `"false"` derruba o build: execução não liga por flag |

Nenhuma variável contém segredo. Tudo que começa com `NEXT_PUBLIC_` vai para o bundle público.

## Flags de recurso

`src/config/retry-protocol.ts`:

| Recurso       | O que assina                                 | Devnet | Mainnet   |
| ------------- | -------------------------------------------- | ------ | --------- |
| (leitura)     | nada; pools, preços, histórico, portfolio    | sempre | sempre    |
| `create`      | criação do token e da pool, primeira compra  | ligado | desligado |
| `trade-curve` | compra e venda na bonding curve              | ligado | desligado |
| `graduate`    | migração manual para o DAMM v2               | ligado | desligado |
| `trade-damm`  | compra e venda na pool DAMM v2 graduada      | ligado | desligado |
| `claim-fees`  | saque das taxas do criador e das taxas de LP | ligado | desligado |

Na Devnet a execução também depende da config RETRY registrada em `RETRY_DBC_CONFIGS.devnet`. Desde o commit `4233212` do PR #8 ela é `8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N` (fee claimer `DbvhT2t9yBY4nNsXZLjDhf7Aa13x3TsA83RdxQDhNAqD`, chave de teste efêmera, criada em 29/10/2026 às 19:26:06 UTC). Sem ela o site mostra "The RETRY launch configuration is not deployed on this cluster yet." e não assina nada. O lançamento ainda depende do Worker de metadados, que não está implantado (ver [METADATA_AND_STORAGE.md](METADATA_AND_STORAGE.md)).

### Camadas que conferem a mesma regra

1. **Constantes de código**: `MAINNET_EXECUTION_ENABLED = false`, `FEATURE_DEFAULTS["mainnet-beta"]` todo `false`, `RETRY_DBC_CONFIGS["mainnet-beta"] = null` e `MAINNET_APPROVAL = null`. Variável ausente resulta no estado seguro.
2. **Interface**: `useMeteora(feature)` e `useExecute(feature)` calculam `executionPolicy(cluster, feature)` e desligam o botão com a mensagem da política.
3. **Biblioteca**: toda função que monta transação (`prepareCreateToken`, `prepareTrade`, `prepareMigration`, `prepareDammTrade`, `prepareCreatorClaim`, `prepareLpFeeClaim`) chama `assertWritable(context, feature)` antes de ler a rede. Chamar a biblioteca por outra rota não contorna a regra.
4. **Rede**: `assertCluster` (genesis hash) antes de montar, e a `chain` na assinatura.
5. **Testes**: `tests/solana-config.test.ts` ("switches each signing capability separately, Mainnet off for all", "cannot enable financial functionality by changing environment flags") e `tests/mainnet-approval.test.ts` ("keeps Mainnet locked unless the owner approved exactly these parameters"). Este último falha se alguém ligar a Mainnet sem uma aprovação cujo hash bata com os parâmetros atuais e sem `feeClaimerKind: "treasury"`. Ver [MAINNET_RELEASE_CHECKLIST.md](MAINNET_RELEASE_CHECKLIST.md).

`NEXT_PUBLIC_RETRY_DISABLED_FEATURES` é a parada de emergência de um build já publicado: desliga, nunca liga.
