# Runbook operacional (Devnet)

## Comandos

```bash
pnpm install --frozen-lockfile     # Node 24, pnpm 11
pnpm lint && pnpm typecheck && pnpm test
pnpm build:pages                   # export estático do GitHub Pages
pnpm test:e2e                      # navegador, sem blockchain
pnpm test:chain                    # fluxo on-chain (precisa de um validador ou Devnet)
pnpm test:chain:browser            # fluxo completo no navegador contra o validador
```

## Validador local com os programas da Meteora

O jeito mais barato e fiel de testar: `solana-test-validator` clonando os binários oficiais e as contas públicas que o DBC usa.

```bash
solana-test-validator --reset --url https://api.devnet.solana.com \
  --clone-upgradeable-program dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN \
  --clone-upgradeable-program cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG \
  --clone-upgradeable-program LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn \
  --clone-upgradeable-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  --clone Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp \
  --maybe-clone FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM
pnpm test:chain
```

Trocar `--url` por `https://api.mainnet-beta.solana.com` testa os binários da Mainnet (só leitura; nada é enviado à Mainnet). O workflow `.github/workflows/meteora-chain.yml` faz as duas variações a cada push nos arquivos Meteora.

## Rodar na Devnet real

O faucet público por RPC da Devnet está fechado: `requestAirdrop` respondeu `410 Gone: The RPC faucet is closed on this cluster. Request test SOL at https://faucet.solana.com` no Actions. Para rodar na Devnet:

Procedimento revisado em 29/10/2026, que substitui o anterior:

1. Proprietário gera pessoalmente uma chave descartável **fora do checkout**, sem exportar a Phantom pessoal: [carteira e secret](../devnet/RETRY_DEVNET_FUNDER_SETUP.md). Fornecer ao agente somente o endereço público.
2. Financiar no faucet oficial, respeitando limites. Smoke exige saldo inicial mínimo de 1,40002 SOL e teto bruto de 2 SOL. Graduação tem autorização separada, threshold de 10 SOL e teto bruto de 12 SOL; não é garantia de suficiência/custo.
3. Configurar environment `retry-devnet` protegido por reviewer e branch policy; inserir `RETRY_DEVNET_FUNDER` diretamente como environment secret. [Proteções e bloqueio de dispatch](../devnet/RETRY_GITHUB_ACTIONS_SECURITY.md).
4. O workflow ainda não está na `main`, portanto não presumir que "Run workflow" está disponível. Não fazer merge para contornar. Usar [alternativa local pessoal do proprietário](../devnet/RETRY_PUBLIC_DEVNET_TESTS.md), ou decidir separadamente como disponibilizar workflow revisado na default branch.
5. Quando dispatch estiver legitimamente disponível: selecionar a branch, SHA revisada, opção explícita Devnet e orçamento. Push com `[devnet]` não libera a chave. Secret/saldo ausentes falham; graduação não executada é skip real.
6. Conferir genesis, config, mint, pool, signatures, custos e refunds no artefato. Só então registrar config/partner/configSignature verificados no app (`feeClaimerKind: "ephemeral-test-key"`). Nenhuma chave efêmera vira treasury de produção.

A chave da carteira de teste nunca vai para o repositório, para o frontend ou para `NEXT_PUBLIC_*`.

## Worker de metadados

Ver [infra/metadata-worker/README.md](../../infra/metadata-worker/README.md). Sem ele, o botão de lançar fica desligado com explicação.

## Roteiro de teste manual com carteira real (Devnet)

1. Abrir o app com o cluster em Devnet e conectar Phantom, Solflare ou Backpack, também em Devnet.
2. Create: preencher nome, ticker, imagem; na etapa 3 escolher 0,1 SOL de primeira compra; "Review launch cost"; conferir os valores; "Sign & launch"; aprovar na carteira.
3. Conferir no explorer: mint sem autoridades, metadados, pool.
4. Página do token: comprar 0,05 SOL, vender 50%, conferir saldos e atividade.
5. Portfolio: holdings, criados, atividade.
6. Rejeitar uma assinatura de propósito: a tela deve dizer que nada foi enviado.
7. Recarregar durante "Waiting for confirmation": a operação deve ser reconciliada.
8. Registrar carteira, versão, resultado e assinaturas no relatório.

## Incidentes

| Sintoma                                              | O que fazer                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| "The on-chain RETRY config does not match this app." | A config mudou ou o endereço está errado. Não contornar. Conferir `RETRY_DBC_CONFIGS` e `configMismatches`.                                 |
| Transação "Sent" sem confirmar                       | A tela reconcilia ao recarregar. Se expirou, nada foi debitado além do que o explorer mostra. Não reenviar à mão a mesma transação.         |
| "Meteora's migration rent float is empty"            | A pool authority do DBC está sem SOL no cluster. Ninguém consegue migrar até a Meteora repor. Avisar a Meteora.                             |
| Worker retornando 429                                | Limite por IP por hora. Aumentar `UPLOADS_PER_HOUR` só se for abuso descartado.                                                             |
| Worker fora do ar                                    | Lançamentos ficam bloqueados; negociação continua funcionando.                                                                              |
| RPC público instável                                 | Definir `NEXT_PUBLIC_SOLANA_RPC_URL` com um RPC dedicado.                                                                                   |
| Suspeita de transação adulterada                     | O app recusa qualquer instrução ou conta fora da allowlist e qualquer mudança feita pela carteira. Registrar a mensagem e a carteira usada. |

## O que nunca fazer

Colocar chave privada no repositório ou em `NEXT_PUBLIC_*`, ligar a Mainnet por variável de ambiente, desligar a simulação, usar conta pessoal para testes, prometer proteção contra MEV.
