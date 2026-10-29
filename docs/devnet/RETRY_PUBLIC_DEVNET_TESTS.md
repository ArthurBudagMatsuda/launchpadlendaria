# RETRY — Testes públicos Solana Devnet

## Estado

Carteira descartável criada e financiada após autorização: `3r8gEonYHrXEao85oFAu2UzVgT1KsxFmWUZLWBd8G5B3`, 2,5 SOL de teste recebidos; secret no environment protegido. Dispatch bloqueado porque o workflow não está na `main`. O teste local autorizado usa backup DPAPI sem mostrar a chave: `node scripts/manage-devnet-funder.mjs run-smoke`. Resultados e signatures somente depois de execução confirmada; consultar o relatório/evidência. Mocks e validadores não substituem Devnet pública.

## Leitura independente, sem chave

```powershell
pnpm test:devnet:readiness
```

Verifica genesis, IDs do SDK, contas executáveis DBC/DAMM v2/Locker/Metaplex, config pública de migração, rent float da pool authority, threshold e config RETRY registrada. `RETRY_DEVNET_FUNDER_ADDRESS` opcional permite ler saldo público. Sem segredo ou envio de transações.

`RETRY_DEVNET_READINESS_EVIDENCE` opcional aponta o JSON de evidência pública. Não usar URLs com tokens RPC neste registro. Resultado e horário efetivamente obtidos constam no relatório/evidência.

## Alternativa local do proprietário

Após revisar a SHA e instalar dependências fixadas, usar checkout limpo e [carteira descartável financiada](RETRY_DEVNET_FUNDER_SETUP.md). O proprietário executa pessoalmente, sem compartilhar o terminal:

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

| Caso                        | Estado                            | Evidência necessária                              |
| --------------------------- | --------------------------------- | ------------------------------------------------- |
| Genesis e programas         | Sonda pública independente        | RPC, horário, slot, owners/executable             |
| Endereço/saldo do funder    | Pendente                          | Lamports, SOL, slot e endpoint                    |
| Config RETRY                | `devnet: null` no app             | Config, fee claimer, configSignature e parâmetros |
| Criar SPL e pool DBC        | Pendente                          | Mint, pool, signature e confirmação               |
| Comprar/vender              | Pendente                          | Saldos, fees e signatures                         |
| Slippage e excesso de saldo | Pendente público                  | Simulação/erro real; não inventar envio           |
| Completar curva             | Pendente de autorização/orçamento | Reserva, threshold e signature                    |
| Migrar e conferir LP        | Pendente                          | Pool DAMM v2, posições, locks e assinatura        |
| Fees/refund                 | Pendente                          | Signature e variação de saldo                     |

O harness marca graduação/migração indisponíveis como **skipped**, não aprovação. Ausência de chave/saldo inicial reprova o setup. Ler o artefato completo, não apenas o total verde do job.

Após teste real, registrar cluster, SHA, genesis, funder público, config, mint, pools, signatures, slots, custos e erros. Links Explorer usam `?cluster=devnet`: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet` é apenas modelo, não transação existente.

Só registrar `RETRY_DBC_CONFIGS.devnet` após conferir `configMismatches`. Parceiro do harness é efêmero, não treasury de produção. Confirmar pool DAMM v2 e locks para aprovar graduação; keeper Mainnet não prova automação na Devnet.
