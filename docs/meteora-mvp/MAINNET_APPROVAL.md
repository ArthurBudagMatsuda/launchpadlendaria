# Aprovação da Mainnet: parâmetros de um lançamento RETRY

<!-- Gerado por src/lib/meteora/mainnet-approval.ts. Não editar: `pnpm vitest run tests/mainnet-approval.test.ts -u` regenera. -->

Esta folha é gerada a partir do código que monta as transações, com as funções do próprio SDK da Meteora para os números derivados. Nada aqui foi digitado à mão: o teste `tests/mainnet-approval.test.ts` falha se o código e esta folha divergirem.

Estado: **Aguardando aprovação do proprietário.**

Execução na Mainnet: travada (`MAINNET_EXECUTION_ENABLED = false`). Funções ligadas por padrão na Mainnet: nenhuma.

SHA-256 dos parâmetros: `7ab74f6fe4709d4eaa9a6721cdd6a6533cd88688634e484c4898ab48305d3b0f`

O hash é o SHA-256 de `JSON.stringify` do bloco JSON no fim desta folha (sem espaços). Qualquer mudança de parâmetro, de programa ou de versão de SDK muda o hash.

## Como aprovar

1. Ler as seções abaixo e resolver as pendências.
2. Registrar a aprovação em `MAINNET_APPROVAL` (`src/config/retry-protocol.ts`) num PR revisado, com este hash, o nome de quem aprova, a data e o link da aprovação.
3. Só depois, em outro PR revisado, ligar `MAINNET_EXECUTION_ENABLED` e as funções em `FEATURE_DEFAULTS["mainnet-beta"]`. O teste recusa ligar a Mainnet sem uma aprovação deste hash exato.

O resto do processo (revisão de segurança, carteiras reais, Worker, RPC, monitoramento) está em [MAINNET_RELEASE_CHECKLIST.md](MAINNET_RELEASE_CHECKLIST.md).

## Pendências que o código mostra

- Tesouraria RETRY (fee claimer e leftover receiver da config): não definida. Recomendado multisig (ex.: Squads).
- Config DBC da Mainnet: não criada. Ela é criada pela tesouraria com `createConfig2` depois da aprovação, e o endereço entra em `RETRY_DBC_CONFIGS` (o que muda o hash desta folha e exige aprovar de novo, já com o endereço).

## Token

| Parâmetro | Valor |
| --- | --- |
| Padrão | SPL Token (não Token-2022) |
| Decimals | 9 |
| Supply total | 1.000.000.000 tokens (`1000000000000000000` unidades) |
| Supply depois da graduação | 1.000.000.000 tokens (fixo) |
| Autoridades | `Immutable`: sem autoridade de mint, de freeze e de metadados depois da criação (verificado on-chain no teste de chain) |

## Supply e reservas

| Destino | Tokens | % do supply |
| --- | --- | --- |
| Vendido na curva (até o threshold) | 799.999.791,745821028 | 79,9999% |
| Depositado no DAMM v2 na graduação | 200.000.208,254178972 | 20% |
| Leftover | 0 | 0% |
| Vesting travado (alocação do criador) | nenhum | 0% |

A pool começa com todo o supply no cofre de tokens e 0 SOL no cofre de SOL. Não há reserva virtual: o preço vem da curva de liquidez concentrada do DBC sobre saldos reais.

## Curva

| Parâmetro | Valor |
| --- | --- |
| Preço inicial | 0,0000000031250016 SOL por token (FDV 3,125 SOL) |
| Preço na graduação | 0,00000005 SOL por token (FDV 50 SOL) |
| `sqrtStartPrice` | `1031204611249736` |
| Ponto 1 da curva | sqrtPrice `4124817371235594`, liquidez `1099951394441798235904906044405806` |
| `migrationSqrtPrice` | `4124817371235594` (o DAMM v2 abre exatamente neste preço) |
| Ativação | por timestamp, imediata |

## Taxas

| Taxa | Valor |
| --- | --- |
| Negociação na curva | 1% fixa (`10000000` / `1000000000`, 0 períodos de redução) |
| Taxa dinâmica | desligada |
| Cobrada em | SOL |
| Parte da Meteora | 20% da taxa |
| Parte do criador | 50% do restante |
| Parte da RETRY | 50% do restante |
| Referral | nenhum |
| Primeira compra com taxa mínima | desligada |
| Criação de pool | 0 SOL |
| Taxa de migração da RETRY / do criador | 0% / 0% |
| Taxa de liquidez da Meteora na graduação | 0,2% do SOL e dos tokens migrados |
| LP fee do DAMM v2 depois da graduação | 1% (opção `2`, config `Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp`) |

## Quem recebe

| O quê | Quem |
| --- | --- |
| Parte RETRY das taxas da curva | tesouraria **pendente** |
| Leftover, se houver (0 tokens nesta config) | tesouraria **pendente** |
| Parte do criador | a carteira que criou a pool (sacada por ela, em SOL) |
| Posição de LP travada do parceiro (NFT) | tesouraria **pendente** |
| Posição de LP travada do criador (NFT) | o criador |
| Taxas de LP do DAMM v2 | quem tiver a NFT de cada posição |

## Compra inicial do criador

Opcional, de 0 a 1 SOL, na mesma transação da criação (ninguém compra antes do criador). Slippage padrão 1%. Cotações do SDK sobre a pool recém-criada:

| Compra | Tokens | % do supply | Mínimo com slippage | Taxa |
| --- | --- | --- | --- | --- |
| 0,1 SOL | 30.766.226,884943507 | 3,0766% | 30.458.564,616094071 | 0,001 SOL |
| 0,5 SOL | 137.918.959,199041652 | 13,7918% | 136.539.769,607051235 | 0,005 SOL |
| 1 SOL | 244.255.867,572881215 | 24,4255% | 241.813.308,897152402 | 0,01 SOL |

## Graduação

| Parâmetro | Valor |
| --- | --- |
| Threshold | 10 SOL na curva |
| Destino | Meteora DAMM v2 |
| SOL depositado no DAMM v2 | 9,98 SOL (taxa da Meteora: 0,02 SOL) |
| Tokens depositados no DAMM v2 | 199.600.207,837670615 (taxa da Meteora: 400.000,416508357) |
| Quem migra na Mainnet | o keeper da Meteora; a migração manual (sem permissão) fica como reserva |

## Liquidez graduada

| | RETRY (parceiro) | Criador |
| --- | --- | --- |
| Livre para retirar | 0% | 0% |
| Travada para sempre | 50% | 50% |
| Em vesting | 0% | 0% |

O DBC arredonda para baixo a parte travada de cada posição: no teste de chain sobrou 1 unidade de liquidez destravada (contra ≈ 4,1 × 10³² travadas por posição). O painel de graduação verifica o travamento lendo as posições.

## Metadados

Metaplex Token Metadata, imutáveis (update authority = System Program, `isMutable = false`, verificado on-chain). Nome até 32 bytes, ticker até 10, URI até 200. JSON e imagem ficam no Worker RETRY, endereçados pelo SHA-256 do conteúdo (`NEXT_PUBLIC_RETRY_METADATA_URL`).

## Programas, contas fixas e SDKs

| | Endereço ou versão |
| --- | --- |
| Meteora DBC | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` (IDL 0.2.2) |
| Meteora DAMM v2 | `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG` (IDL 0.2.5) |
| Config DAMM v2 da graduação | `Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp` |
| Pool authority do DBC | `FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM` |
| Pool authority do DAMM v2 | `HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC` |
| Event authority do DAMM v2 | `3rmHSu74h1ZcmAisVcWerTCiRDQbUrBKmcwptYGjHfet` |
| Metaplex Token Metadata | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s` |
| SPL Token | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
| Token-2022 (NFTs das posições) | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |
| Associated Token | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` |
| System | `11111111111111111111111111111111` |
| Compute Budget | `ComputeBudget111111111111111111111111111111` |
| Lighthouse (só quando a carteira acrescenta) | `L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95` |
| WSOL | `So11111111111111111111111111111111111111112` |
| `@meteora-ag/dynamic-bonding-curve-sdk` | 2.0.0 |
| `@meteora-ag/cp-amm-sdk` | 1.5.1 |
| `@solana/web3.js` | 1.98.4 |
| `@solana/spl-token` | 0.4.15 |

## Config RETRY na Mainnet

| | |
| --- | --- |
| Config DBC | **pendente** |
| Transação de criação | **pendente** |
| Data | **pendente** |

## Parâmetros completos

```json
{
  "network": "mainnet-beta",
  "programs": {
    "dynamicBondingCurve": "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
    "dynamicBondingCurveIdl": "0.2.2",
    "dammV2": "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
    "dammV2Idl": "0.2.5",
    "metaplexTokenMetadata": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
    "splToken": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "token2022": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    "associatedToken": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "system": "11111111111111111111111111111111",
    "computeBudget": "ComputeBudget111111111111111111111111111111",
    "lighthouse": "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95",
    "wsolMint": "So11111111111111111111111111111111111111112",
    "dbcPoolAuthority": "FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM",
    "dammV2PoolAuthority": "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC",
    "dammV2EventAuthority": "3rmHSu74h1ZcmAisVcWerTCiRDQbUrBKmcwptYGjHfet",
    "dammV2MigrationConfig": "Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp"
  },
  "packages": {
    "@meteora-ag/dynamic-bonding-curve-sdk": "2.0.0",
    "@meteora-ag/cp-amm-sdk": "1.5.1",
    "@solana/web3.js": "1.98.4",
    "@solana/spl-token": "0.4.15"
  },
  "token": {
    "tokenType": 0,
    "decimals": 9,
    "totalSupply": "1000000000000000000",
    "postMigrationSupply": "1000000000000000000",
    "tokenUpdateAuthority": 1
  },
  "supply": {
    "soldOnCurve": "799999791745821028",
    "depositedAtGraduation": "200000208254178972",
    "leftover": "0",
    "lockedVesting": {
      "amountPerPeriod": "0",
      "numberOfPeriod": "0",
      "cliffUnlockAmount": "0"
    }
  },
  "curve": {
    "sqrtStartPrice": "1031204611249736",
    "points": [
      {
        "sqrtPrice": "4124817371235594",
        "liquidity": "1099951394441798235904906044405806"
      }
    ],
    "migrationSqrtPrice": "4124817371235594",
    "activationType": 1
  },
  "tradingFee": {
    "cliffFeeNumerator": "10000000",
    "feeDenominator": "1000000000",
    "baseFeeMode": 0,
    "schedulerPeriods": 0,
    "dynamicFee": false,
    "collectFeeMode": 0,
    "protocolFeePercent": 20,
    "creatorTradingFeePercentage": 50,
    "referral": false,
    "enableFirstSwapWithMinFee": false
  },
  "otherFees": {
    "poolCreationFee": "0",
    "migrationFeePercentage": 0,
    "creatorMigrationFeePercentage": 0,
    "meteoraLiquidityMigrationFeeBps": 20,
    "migrationFeeOption": 2,
    "graduatedPoolLpFeeBps": 100
  },
  "feeRecipients": {
    "treasury": null,
    "treasuryKind": null
  },
  "initialBuy": {
    "maxLamports": "1000000000",
    "sameTransactionAsCreate": true,
    "defaultSlippageBps": 100,
    "quotes": [
      {
        "lamports": "100000000",
        "tokensOut": "30766226884943507",
        "minimumTokensOut": "30458564616094071",
        "feeLamports": "1000000"
      },
      {
        "lamports": "500000000",
        "tokensOut": "137918959199041652",
        "minimumTokensOut": "136539769607051235",
        "feeLamports": "5000000"
      },
      {
        "lamports": "1000000000",
        "tokensOut": "244255867572881215",
        "minimumTokensOut": "241813308897152402",
        "feeLamports": "10000000"
      }
    ]
  },
  "graduation": {
    "migrationQuoteThreshold": "10000000000",
    "migrationOption": 1,
    "solToDammV2": "9980000000",
    "tokensToDammV2": "199600207837670615",
    "meteoraMigrationFeeLamports": "20000000",
    "meteoraMigrationFeeTokens": "400000416508357"
  },
  "liquidity": {
    "partnerLiquidityPercentage": 0,
    "creatorLiquidityPercentage": 0,
    "partnerPermanentLockedLiquidityPercentage": 50,
    "creatorPermanentLockedLiquidityPercentage": 50,
    "partnerLiquidityVestingPercentage": 0,
    "creatorLiquidityVestingPercentage": 0
  },
  "metadata": {
    "maxNameBytes": 32,
    "maxSymbolBytes": 10,
    "maxUriBytes": 200
  },
  "config": {
    "dbcConfig": null,
    "createdBy": null,
    "createdAt": null
  }
}
```
