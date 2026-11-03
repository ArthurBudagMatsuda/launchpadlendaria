# Graduação pública para DAMM v2

**PUBLIC DEVNET: BLOCKED / NOT TESTED na Etapa 7.** O threshold conferido no código é **10.000.000.000 lamports (10 SOL de teste)**. Não se presume keeper automático na Devnet; o fluxo existente de migração manual oficial da Meteora deve ser usado.

Consulta pública de 02/11/2026, sem chave: funder registrado com **2.013.648.909 lamports = 2,013648909 SOL**. Seu backup DPAPI descrito no histórico não existe neste computador, e o secret do GitHub não pôde ser confirmado sem acesso autenticado. Não gerar outra carteira nem exportar a Phantom por conveniência.

Para um novo cenário, esse saldo é menor que o threshold. Diferença aritmética só para 10 SOL: **7,986351091 SOL**, antes de fees/rent. Para um teto bruto de ensaio de 12 SOL, o déficit é **9,986351091 SOL**. O teto é orçamento de transferências, não previsão de custo líquido nem autorização automática de gasto. Calcular novamente a partir da pool e dos saldos imediatamente antes do teste.

## Pré-condições

URL e metadados publicados; carteira teste disponível; aprovação do orçamento Devnet; genesis correto; DBC/DAMM v2/Metaplex e config verificados; fee claimer inalterado; pool e mint próprios; reserva atual, quote e rent de migração lidos. Não mudar threshold para contornar falta de saldo.

## Sequência

Criar → comprar/vender → atingir threshold com quote oficial e preenchimento parcial → conferir elegibilidade → revisar custo → proprietário assina migração → confirmar pool DAMM v2 → ler posições/LP/autoridades → verificar bloqueio → comprar e vender na mesma página → conferir Portfolio, histórico e taxas.

Registrar assinatura de cada transação, slots, saldos, contas criadas, fee payer, config, pool DBC e DAMM v2, posições, quantias e tentativas recusadas. Não repetir migração de pool já graduada. Testar negativos de config/mint/pool/threshold e retirada em **validador ou pools próprias de teste**, não contra terceiros.

O [CI novo da Etapa 7](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41568352309) aprovou graduação e negociação DAMM v2 em dois validadores locais, cada um com 21 testes de cadeia e um cenário de navegador. Evidências: [binários Devnet](evidence/local-validator-devnet.json) e [binários Mainnet](evidence/local-validator-mainnet.json). O custo de migração medido nesses validadores foi 32.518.200 lamports; o preço passou de `5e-8` para `5e-8` SOL, gap 0, nesse cenário. Não é custo público atual, orçamento garantido ou prova Phantom real.

O fluxo histórico está em [DEVNET_E2E_RESULTS](../meteora-mvp/DEVNET_E2E_RESULTS.md). A etapa pública continua bloqueada.
