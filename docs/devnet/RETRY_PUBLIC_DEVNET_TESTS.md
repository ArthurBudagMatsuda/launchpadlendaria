# RETRY — Testes públicos Solana Devnet

## Estado

Carteira descartável criada e financiada após autorização: `3r8gEonYHrXEao85oFAu2UzVgT1KsxFmWUZLWBd8G5B3`, 2,5 SOL de teste recebidos; secret no environment protegido. Smoke público concluído no código `4233212`: **8 passaram e 2 foram pulados** (graduação/migração). [Evidência](evidence/SMOKE_DEVNET_CONFIRMED.json) e [confirmações independentes](evidence/CHAIN_CONFIRMATIONS.json). Saldo após duas tentativas: **2,013648909 SOL de teste**. A primeira tentativa falhou no RPC e está preservada separadamente. Dispatch bloqueado porque o workflow não está na `main`. O teste local autorizado usa backup DPAPI sem mostrar a chave: `node scripts/manage-devnet-funder.mjs run-smoke`. Resultados e signatures somente depois de execução confirmada; consultar o relatório/evidência. Mocks e validadores não substituem Devnet pública.

## Leitura independente, sem chave

```powershell
pnpm test:devnet:readiness
```

Verifica genesis, IDs do SDK, contas executáveis DBC/DAMM v2/Locker/Metaplex, config pública de migração, rent float da pool authority, threshold e config RETRY registrada. `RETRY_DEVNET_FUNDER_ADDRESS` opcional permite ler saldo público. Sem segredo ou envio de transações.

`RETRY_DEVNET_READINESS_EVIDENCE` opcional aponta o JSON de evidência pública. Não usar URLs com tokens RPC neste registro. Resultado e horário efetivamente obtidos constam no relatório/evidência.

## Execução local protegida (já validada)

A carteira automatizada usa `node scripts/manage-devnet-funder.mjs status` e, com checkout limpo/revisado, `node scripts/manage-devnet-funder.mjs run-smoke`. Nenhuma chave aparece no comando ou log. O helper fixa Devnet, teto bruto de 2 SOL e graduação desligada.

O bloco abaixo é **alternativa manual apenas para quem criou um arquivo JSON privado próprio**; não é necessário criar outra carteira na configuração atual:

```powershell
git rev-parse HEAD
git status --short
$env:RETRY_CHAIN_MODE = 'devnet'
$env:RETRY_CHAIN_RPC = 'https://api.devnet.solana.com'
$env:RETRY_CHAIN_USE_APP_CONFIG = '1'
$env:RETRY_CHAIN_EVIDENCE = 'evidence-devnet.json'
$env:RETRY_DEVNET_MAX_SPEND_SOL = '2'
$env:RETRY_CHAIN_GRADUATION = '0'
try {
  $env:RETRY_DEVNET_FUNDER = Get-Content -Raw -LiteralPath "$env:USERPROFILE\retry-devnet-private\funder.json"
  pnpm test:chain
} finally {
  Remove-Item Env:RETRY_DEVNET_FUNDER -ErrorAction SilentlyContinue
}
```

O agente não deve ler o arquivo. Não colocar conteúdo em argumentos, logs ou relatório. Para graduação, autorizar separadamente, definir `RETRY_CHAIN_GRADUATION='1'` e `RETRY_DEVNET_MAX_SPEND_SOL='12'`; conferir saldo, rent float e config DAMM v2. O top-up vem do estado real; não altera economia. 12 SOL é teto de transferências brutas, não garantia de custo ou suficiência.

## Matriz pública

| Caso                        | Estado                               | Evidência necessária                       |
| --------------------------- | ------------------------------------ | ------------------------------------------ |
| Genesis e programas         | Aprovado em leitura pública          | PUBLIC_DEVNET_READINESS.json               |
| Endereço/saldo do funder    | Aprovado; 2,013648909 SOL finais     | DEVNET_WALLET_STATUS.json                  |
| Config RETRY                | Criada, validada e registrada        | Config 8Mfndt2… e signature confirmada     |
| Criar SPL e pool DBC        | Aprovado público                     | SMOKE_DEVNET_CONFIRMED.json                |
| Comprar/vender              | Aprovado público                     | CHAIN_CONFIRMATIONS.json                   |
| Slippage e excesso de saldo | Aprovado público; rejeição sem envio | Evidência do smoke e código dos casos      |
| Completar curva             | Pendente de autorização/orçamento    | Reserva, threshold e signature             |
| Migrar e conferir LP        | Pendente                             | Pool DAMM v2, posições, locks e assinatura |
| Fees/refund                 | Aprovado público                     | Signatures e saldos finais no JSON         |

O harness marca graduação/migração indisponíveis como **skipped**, não aprovação. Ausência de chave/saldo inicial reprova o setup. Ler o artefato completo, não apenas o total verde do job.

Após teste real, registrar cluster, SHA, genesis, funder público, config, mint, pools, signatures, slots, custos e erros. Links Explorer usam `?cluster=devnet`: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet` é apenas modelo, não transação existente.

Só registrar `RETRY_DBC_CONFIGS.devnet` após conferir `configMismatches`. Parceiro do harness é efêmero, não treasury de produção. Confirmar pool DAMM v2 e locks para aprovar graduação; keeper Mainnet não prova automação na Devnet.
