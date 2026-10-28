# RETRY — Pesquisa de graduação para DEX Solana

Pesquisa documental em **28/10/2026**. Nenhum SDK de DEX foi instalado; nenhuma pool, posição, configuração ou transação foi criada. Valores e comportamentos abaixo são características documentadas dos protocolos, não parâmetros aprovados da RETRY. Confirmar novamente versão, IDL, contas e estado no cluster antes de implementar.

## Comparação

| Critério              | Raydium LaunchLab → CPMM                                                                                | Meteora DBC → DAMM v2                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Modelo                | Curva e graduação do LaunchLab sobre configuração global e configuração da plataforma                   | Curva virtual configurável DBC, com configuração de parceiro e de migração                                    |
| Destino atual         | CPMM para novos lançamentos                                                                             | DAMM v2 para novas configurações/pools; DAMM v1 é legado                                                      |
| Taxas da curva        | Protocolo, plataforma, criador e referral são fluxos separados                                          | Base fee obrigatória, dinâmica opcional, repartição entre protocolo/parceiro/criador e referral conforme modo |
| Taxas após graduação  | Trade fee CPMM, creator fee e direito associado a LP bloqueado devem ser tratados separadamente         | Taxas da pool e participação das posições; modo de coleta importa                                             |
| Principal de liquidez | A migração pode bloquear parte e queimar o restante; exige validar distribuição efetiva                 | Posições podem conter liquidez livre, permanente e vesting; a configuração define os percentuais              |
| Direito a taxas       | Fee Key transferível representa taxas do LP em escrow; burn verdadeiro não tem Fee Key                  | Position NFT representa controle da posição e participação em taxas; locks restringem retirada                |
| Restrições            | GlobalConfig, PlatformConfig, permissões de migração e suporte de extensões                             | Extensões/mint badges, configurações aprovadas, estados de migração e fluxo de transfer fees                  |
| Operação              | Confirmar signers e serviço de graduação; não presumir que RETRY poderá migrar qualquer pool livremente | Keeper documentado é Mainnet com critérios; testes precisam de fluxo manual/keeper próprio validado           |

A comparação é uma avaliação de integração. Não demonstra que uma rota é mais segura ou economicamente melhor para a RETRY.

## Raydium: pontos que mudaram

A documentação consultada distingue quatro taxas possíveis na curva e taxas próprias no CPMM. `GlobalConfig` limita parâmetros de lançamento e define autoridades de migração; a plataforma não controla essas regras globais. Conferir as contas do ambiente, sem copiar uma taxa antiga de uma página de exemplo. [GlobalConfig](https://docs.raydium.io/products/launchlab/global-config), [referência de taxas](https://docs.raydium.io/products/launchlab/tips-and-gotchas/launchlab-cpmm-fee-reference).

Há uma mudança documentada em 17/08/2026: a parcela historicamente chamada `creatorScale` passa a integrar a parcela de LP bloqueado pertencente à plataforma nas novas migrações. A documentação de exemplos também exige `creatorScale = 0` nas configurações novas. Portanto, não prometer ao criador um Fee Key próprio a partir de exemplos anteriores. Verificar programa/IDL e a distribuição efetiva, não só o nome dos campos. [PlatformConfig](https://docs.raydium.io/products/launchlab/platform-config), [distribuição de LP](https://docs.raydium.io/products/launchlab/tips-and-gotchas/lp-fee-distribution).

Burn & Earn usa escrow permanente; o LP não é destruído nesse mecanismo. O Fee Key NFT transfere direitos de taxas e precisa de política de custódia. Queimar LP de verdade elimina essa representação de taxas. São compromissos distintos, que precisam ser comprovados por contas e instruções do programa escolhido. [Burn & Earn](https://docs.raydium.io/user-flows/burn-and-earn).

## Meteora: configuração e migração

DBC configura a curva e o destino DAMM v2; atingir a reserva de quote marca conclusão, mas ainda há passos de migração. A distribuição entre parceiro e criador pode conter posições livres, locks permanentes e vesting; os percentuais devem totalizar 100%. A documentação exige ao menos 10% bloqueados no primeiro dia e menciona uma taxa protocolar de migração de liquidez de 0,2%, separada da taxa configurável de parceiro/criador. Estes valores precisam ser revalidados no programa selecionado e não foram adotados no produto. [Migração e liquidez](https://docs.meteora.ag/core-products/dbc/migration-and-liquidity).

O NFT da posição controla a posição DAMM v2. Liquidez permanente pode continuar recebendo taxas; transferir o NFT muda quem controla esses direitos. Não afirmar que um lock impede retirada da parcela livre ou remove poderes administrativos do protocolo. Conferir delegates, vesting e buckets da posição. [Posições NFT](https://docs.meteora.ag/core-products/damm-v2/nft-positions).

As taxas DBC têm denominador próprio e podem mudar com tempo/volatilidade. Transfer fees Token-2022 são adicionais. O suporte de hooks e transfer fees exige regras específicas, inclusive diferenças na migração; não oferecer todas as extensões apenas porque o mint é Token-2022. [Taxas](https://docs.meteora.ag/core-products/dbc/fees/overview), [Token-2022](https://docs.meteora.ag/core-products/dbc/token-2022-support).

O guia atual menciona SDK DBC 2.0.0+ para programa 0.2.2, com dependências `web3.js`, `spl-token` e `bn.js`. Não acrescentá-las ao frontend Kit antes de definir um adaptador isolado. O programa DBC tem ID documentado para Mainnet e Devnet; isso não comprova disponibilidade de todos os configs, keepers e programas auxiliares em Devnet. [Guia do SDK](https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/getting-started).

## Prova técnica exigida antes de escolher

1. Registrar commit/versão do SDK, hash da IDL, program ID, upgrade authority e contas de configuração por cluster; inspecionar conteúdo pelo RPC.
2. Demonstrar criação e conclusão em ambiente autorizado, verificando reservas, taxas e preço inicial da pool. Falha parcial deve ser recuperável e migração duplicada deve falhar.
3. Identificar quem recebe LP/Fee Key/position NFT, quem pode retirar principal e quem pode cobrar taxas. Testar essas permissões com contas distintas.
4. Verificar lock permanente no estado on-chain e demonstrar que retirada do principal bloqueado falha. Verificar separadamente os poderes de upgrade do programa externo.
5. Testar rent, compute, tamanho de transação, wrapping de SOL, slippage e todos os Token Programs/extension sets permitidos.
6. Verificar condições de acesso, termos operacionais e documentação dos serviços usados; disponibilidade de uma API não garante permissão de criar configuração ou serviço de graduação.

Recomendação técnica provisória: fazer uma prova comparativa em Devnet após fechar a economia, priorizando a rota que cumpra os invariantes e a política de liquidez da RETRY. Uma decisão definitiva sem esse ensaio seria prematura.
