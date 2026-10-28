# Checklist para liberar a Mainnet

**Estado: Mainnet bloqueada.** `MAINNET_EXECUTION_ENABLED = false` é uma constante em `src/config/retry-protocol.ts` e `RETRY_DBC_CONFIGS["mainnet-beta"]` é `null`. Nenhuma variável de ambiente ou URL liga operações financeiras. Liberar exige uma mudança de código revisada, depois de todos os itens abaixo e da autorização específica do proprietário.

Legenda: ✅ feito nesta etapa · 🟡 parcial · ⬜ pendente

| # | Item | Estado | Evidência / o que falta |
| --- | --- | --- | --- |
| 1 | Confirmar versões dos programas oficiais | 🟡 | SDK 2.0.0 / DBC 0.2.2. O Actions registra o hash dos binários do DBC, DAMM v2 e Locker em Devnet e Mainnet (linhas `PROGRAM_HASH`). Os binários de Devnet e Mainnet **não são idênticos** (mesmo tamanho no DBC, hash diferente). Por isso o fluxo também roda contra os binários da Mainnet. Falta: registrar o hash aprovado no momento do lançamento e repetir antes de ligar. |
| 2 | Confirmar Program IDs | ✅ | Fixados em `programs.ts` e comparados com o SDK em teste. |
| 3 | Aprovar parâmetros econômicos | ⬜ | Proprietário. Ponto de atenção: FDV inicial ≈ 3,1 SOL e impacto de 15,6% numa compra de 0,5 SOL. Ver [METEORA_DBC_CONFIGURATION.md](METEORA_DBC_CONFIGURATION.md). |
| 4 | Confirmar custos de criação | 🟡 | Medidos no validador (≈ 0,027 SOL + primeira compra + 0,00001 de rede). Repetir na Devnet real. |
| 5 | Confirmar configuração de fees | 🟡 | 1% (0,2 Meteora, 0,4 criador, 0,4 RETRY) medida on-chain. Falta aprovação. |
| 6 | Confirmar fee claimer | ⬜ | Precisa de uma tesouraria RETRY, de preferência multisig (ex.: Squads). Nos testes o claimer é chave efêmera. |
| 7 | Confirmar autoridades | ✅ | Mint e freeze nulos, metadados imutáveis, verificados on-chain no teste. |
| 8 | Confirmar direitos sobre LP | 🟡 | NFTs das posições vão para parceiro e criador; verificado no teste de migração. Falta decidir quem opera a NFT do parceiro (tesouraria). |
| 9 | Confirmar política de locking | 🟡 | 100% da liquidez graduada travada para sempre; verificado nas contas `Position` do DAMM v2. Falta aprovação. |
| 10 | Confirmar comportamento de graduação | 🟡 | Threshold 10 SOL, migração manual verificada no validador. Na Mainnet a migração é do keeper da Meteora: confirmar com a Meteora que a config RETRY é atendida. |
| 11 | Verificar as transações e instruções construídas | ✅ | Allowlist por instrução e conta, verificação depois da assinatura, testes adversariais. |
| 12 | Concluir testes de criação e negociação | 🟡 | Passam no validador com binários de Devnet e de Mainnet. Falta a execução na Devnet real (precisa da carteira de teste financiada). |
| 13 | Concluir testes reais de carteiras | ⬜ | Phantom, Solflare e Backpack em Devnet, com o roteiro do [OPERATIONAL_RUNBOOK.md](OPERATIONAL_RUNBOOK.md). |
| 14 | Preparar monitoramento | ⬜ | Sugestão: alerta de erro do Worker, saldo do fee claimer, novas pools da config, saldo da pool authority da Meteora. |
| 15 | Preparar tratamento de incidentes | 🟡 | Procedimentos no runbook. Falta definir responsáveis e contatos (Meteora, RPC). |
| 16 | Revisar dependências críticas | 🟡 | Versões exatas no `package.json`; lockfile verificado. Falta revisão das dependências do SDK. |
| 17 | Revisão independente de segurança | ⬜ | Escopo: `src/lib/meteora/transactions.ts`, `wallet-signer.ts`, `create-token.ts`, `trade.ts`, `graduation.ts`, `fees.ts`, Worker de metadados. Não há programa on-chain próprio. |
| 18 | Exigências jurídicas | ⬜ | Proprietário. Lançamento público de tokens pode ter implicações regulatórias por jurisdição. |
| 19 | Aprovar o checklist de publicação | ⬜ | Proprietário. |
| 20 | Autorização específica do proprietário | ⬜ | Proprietário. |

## Passos técnicos quando tudo estiver aprovado

1. Implantar o Worker de metadados na conta Cloudflare do proprietário e definir `NEXT_PUBLIC_RETRY_METADATA_URL` no build do Pages.
2. Definir o RPC de Mainnet (`NEXT_PUBLIC_SOLANA_RPC_URL`) com limite adequado.
3. Criar a config DBC da Mainnet com `createConfig2`, `feeClaimer` e `leftoverReceiver` = tesouraria, assinada pela tesouraria. Conferir com `configMismatches` = `[]`.
4. Preencher `RETRY_DBC_CONFIGS["mainnet-beta"]` com endereço, `feeClaimerKind: "treasury"`, assinatura e data.
5. Trocar `MAINNET_EXECUTION_ENABLED` para `true` num PR próprio, revisado.
6. Lançar um token de teste com valor mínimo, negociar, sacar taxas e acompanhar até a graduação, antes de anunciar.

Nada disso foi executado nesta etapa.
