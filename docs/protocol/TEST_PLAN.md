# Verificação da Fase 2 e condições para Fase 3

## Resultados efetivamente executados

Ambiente local: Node 24.22.1, Windows. Pacote sem dependências externas. No diretório packages/protocol-simulator:

| Comando | Resultado |
|---|---|
| `node --test test/*.test.mjs` | 46 testes passaram; zero falhas |
| `node src/run.mjs` | Gerou JSON exato, SHA-256, três CSVs e relatório |
| `node src/run.mjs --check` | Recalculou e comparou as seis saídas, sem divergências |
| `node scripts/check-dex.mjs --write` | Consultas de leitura nas redes 8453/84532 registradas em research; nenhuma transação |

`node scripts/verify.mjs` reúne checagem de links locais, testes e reprodução sem escrever resultados; `npm run verify` é um atalho opcional. A CI adicionada executa o verificador no Linux e verifica checkout inalterado. O status de cada execução é o registro GitHub Actions, não uma expectativa; não considerar um workflow aprovado antes de seu resultado real.

Os 46 testes incluem 7 testes gerais e 13 por modelo. Sequências mistas: 7 sementes × 3 modelos × 2.000 tentativas = **42.000 operações tentadas**, além das trajetórias de graduação, testes de fronteira e compras fracionadas. Os relatórios também executam 2.000 tentativas por modelo com a semente publicada. Isso é exploração reproduzível de estados do modelo, não fuzz da EVM ou prova formal.

Cobertura significativa: piso/teto e mínimo gross; inputs inválidos e limites de produto; equivalência ASCII e rejeição Unicode; quotas independentes; par por criador; rollback/reentrância do registro local; incompatibilidade de compra mínima/cap; mínimo líquido; reversão sem mutação; saldo/transferências; microtransações; claims e separação de R; último wei; falha/repetição de migração; READY com resgate; compra+migração atômicas; venda total sem trading fee; alvos alternativos e invariantes em sequências mistas.

A consulta DEX verifica código e relações expostas, não a identidade de build auditado. A reprodutibilidade offline não depende desse RPC nem da data de pesquisa. O [JSON de evidência](research/dex-readonly-check.json) registra o escopo exato.

Baseline anterior observado: Fundação 2c8a156 com 20 testes locais; Web3 f62473c com 119 testes e 20 testes de navegador no GitHub. Esses testes não foram rerodados como verificação de integração desta branch, que não contém os seus códigos. Não somar essas contagens à cobertura do protocolo nem afirmar teste de carteira real nesta fase.

## Próxima fase, após aprovação própria

1. Aprovar decisões arquiteturais em DECISION_LOG; manter economia pendente explicitamente, sem ativar placeholders.
2. Preparar Foundry/forge-std/OpenZeppelin com versões/SHAs exatos, compilador e EVM target compatíveis, lock/remappings e CI. Forge/Anvil/Solc/Slither não estavam disponíveis no ambiente da inspeção; escolher WSL ou Linux CI sem alegar que já estão instalados.
3. Implementar apenas tipos/interfaces/libraries, canonicalização ASCII, registro e token fixo com cap aprovado. Não implementar curva executável nem deploy nesta fase inicial sem o gate econômico.
4. Testar vetores Keccak/abi.encode entre Solidity e viem, bytes inválidos, limites e concorrência/reentrada. Testar rollback EVM global em todas as falhas do lançamento simulado.
5. ERC-20: emissão única, transfers/transferFrom, allowance, self/zero transfers, destinatário zero, cap exato ±1 átomo, criador e contratos, direções especiais e estágios; nenhuma permissão oculta de mint/burn/upgrade.

## Gates posteriores antes de finanças

- Comparação diferencial Solidity/BigInt para grandes entradas, cada limite e resultados exatos de taxas/arredondamento.
- Foundry fuzz e invariantes com handlers multiatores: supply, R, taxas, refunds, produto, caps, estados, slots, owner/liquidity e chamadas reentrantes. Fixar seed para reproduzir falhas e relatar runs/depth de fato executados.
- Adversários: receiver ETH que reverte/reentra; refund impossível; ETH forçado/doações; falsa fonte de fee; vault insolvente; code/address/chain errados; front-running de registry e graduação; pool hostil; autorização NFT; mudança de roles; overflow e poeira.
- Fork em bloco identificado para Base e Base Sepolia: bytecode/immutables, getter bindings, WETH, fee tiers e tickSpacing, token0/1 nos dois ordenamentos, mint com amounts mínimos, collect, tentativas de decrease/transfer/permit e resíduos.
- Comparação V3/V4 com medições reais de gas para deploy/init/mint/claim/graduação e exigências de manutenção. Nenhuma afirmação numérica de gas nesta entrega.
- Indexador: log duplicado, crash/checkpoint, reorg, reprocessamento, safe/finalized, RPC divergente e API paginada; frontend deve distinguir falha, pending, included, reverted e finalized sem saldo fictício.
- Build, lint, typecheck e testes dos módulos existentes somente na árvore integrada; revisão independente antes de autorização financeira.

Erros nas fórmulas, passivos sem ativos, custódia LP insuficiente ou bypass de principal são bloqueios. Resultados deste simulador não removem esses gates.
