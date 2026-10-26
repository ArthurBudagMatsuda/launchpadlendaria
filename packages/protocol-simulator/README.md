# RETRY — simulador econômico offline

Hipóteses da Fase 2, **sem parâmetros aprovados para produção**. JavaScript ESM com BigInt, Node 24+, sem dependências externas, RPC, chaves, assinaturas ou transações.

```powershell
cd packages/protocol-simulator
node scripts/verify.mjs
node --test test/*.test.mjs
node src/run.mjs
node src/run.mjs --check
```

O primeiro comando reúne todas as verificações offline. `npm test`, `npm run simulate` e `npm run verify` são atalhos quando npm está disponível; não é necessário instalar pacotes ou ter um gerenciador de pacotes para executar o modelo. Em Node 24 o runner entende o glob de testes; o verificador também enumera arquivos explicitamente para portabilidade. Execute na pasta do pacote, em qualquer sistema compatível.

Os cenários estão em `src/fixtures.mjs`; as fórmulas em `src/curve.mjs`; os roteiros em `src/scenarios.mjs`. A semente é fixa. Cada geração produz três CSVs, JSON exato, SHA-256 e `docs/protocol/SIMULATION_RESULTS.md`. `--check` recalcula tudo em memória e falha se algum resultado salvo estiver diferente; não escreve arquivos. São necessárias as mesmas versões de fonte e fixtures para reproduzir o hash. O JSON usa strings decimais para inteiros econômicos; preços são frações exatas. No relatório, quantidades têm casas truncadas e razões de preço/percentuais têm arredondamento decimal para apresentação. Nenhuma regra de formatação participa da execução.

Testes incluem limites de carteira e transferências, resgate sem ETH virtual, taxas e seus créditos, pequenas operações, slippage, rollback do registro, limites independentes de nomes/tickers, falha/repetição da graduação e sequências pseudoaleatórias reproduzíveis. Os atores são rótulos locais; o modelo de registro não calcula Keccak, não simula endereços nem substitui o rollback global da EVM.

O ledger de ETH da curva exclui a taxa de lançamento, mantida separadamente na especificação da Factory. O custo de spam soma essa taxa externamente. O plano de LP representa a proporção ideal de reservas em full range, sem executar a matemática finita dos ticks ou um Position Manager. A graduação simulada apenas move saldos entre ledgers locais; não realiza uma operação financeira.

Não são modelados callbacks ERC-20, allowlists no bytecode, gas, mempool, MEV, preços de mercado, procura real, rearranjo da blockchain nem segurança dos contratos futuros. Invariantes do modelo não constituem auditoria nem prova de implementação Solidity. Próximos passos em [TEST_PLAN](../../docs/protocol/TEST_PLAN.md) e [ECONOMICS](../../docs/protocol/ECONOMICS.md).
