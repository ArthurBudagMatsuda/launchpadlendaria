# RETRY — Fase 2: especificação e simulações

**Status: especificação candidata, parâmetros econômicos pendentes de aprovação.** Revisão de 26/10/2026. Esta branch contém documentos, ferramentas offline e evidências públicas de leitura. Não contém Solidity executável, assinatura, implantação ou integração financeira habilitada.

## Conclusões para decisão

Recomenda-se aprofundar o modelo **B**, com 1 ETH virtual, alvo de 3 ETH reais e distribuição inicial de 80% para a curva / 20% para liquidez. Esses valores são hipóteses, não constantes de produção. A modelagem ideal permite financiar a LP com as próprias reservas, sem aporte de ETH da RETRY. A execução exata na DEX continua condicionada aos testes de ticks, preços, callbacks e custódia.

Com taxa hipotética de 1%, uma compra inicial de 0,01 ETH líquido exige 0,010101010101010102 ETH bruto. Somada à taxa proposta de lançamento de 0,001 ETH, a saída inicial seria **0,011101010101010102 ETH antes de gas**. O criador compra aproximadamente 10,56 milhões de tokens no modelo B, sem alocação gratuita.

A venda imediata e a recuperação de sua participação nas próprias taxas reduzem o custo irreversível do lançamento a aproximadamente **0,0011608081 ETH antes de gas**. A compra obrigatória é capital resgatável; os limites de nomes/tickers também podem ser usados para ocupação maliciosa de vagas. Não há proteção contra uma pessoa usar várias carteiras.

Recomenda-se V3, posição full range imutável e um locker mínimo sem retirada do principal. V4 permanece alternativa válida, especialmente para otimização, mas a primeira versão não precisa de hooks. A preferência é arquitetural; não houve benchmark de gas ou auditoria de uma implementação RETRY.

## Especificação por assunto

| Documento | Conteúdo |
|---|---|
| [ECONOMICS](ECONOMICS.md) | Unidades, fórmulas inteiras, reservas, prova condicionada de solvência, alocação e taxas |
| [SIMULATION_RESULTS](SIMULATION_RESULTS.md) | Três configurações, saídas verificáveis, vendas e thresholds |
| [ARCHITECTURE](ARCHITECTURE.md) | Responsabilidades, permissões, dados e integração futura |
| [CONTRACT_INTERFACES](CONTRACT_INTERFACES.md) | Interfaces conceituais, tipos e eventos para revisão |
| [STATE_MACHINE](STATE_MACHINE.md) | Estados, reentrância, falhas e recuperação sem bloquear resgates |
| [ANTI_SPAM](ANTI_SPAM.md) | Identidades verificáveis, opções Unicode e custo dos ataques |
| [GRADUATION_AND_LOCK](GRADUATION_AND_LOCK.md) | V3/V4, preço, custódia, bloqueio permanente e verificações pendentes |
| [GOVERNANCE](GOVERNANCE.md) | Poderes mínimos, limites candidatos e timelock |
| [THREAT_MODEL](THREAT_MODEL.md) | Riscos econômicos e técnicos, mitigação e limites |
| [TEST_PLAN](TEST_PLAN.md) | Evidências executadas e condições de entrada nas próximas fases |
| [DECISION_LOG](DECISION_LOG.md) | Requisitos, recomendações e parâmetros não aprovados |
| [INTEGRATION_PLAN](INTEGRATION_PLAN.md) | Branches, proveniência e integração sem mesclar históricos desconectados |
| [BASE_SEPOLIA_DEPLOYMENT](BASE_SEPOLIA_DEPLOYMENT.md) | Preparação futura; nenhuma autorização de implantação |

## Reutilização e limites

Esta é uma extensão de protocolo ao [PRD existente na Fundação](https://github.com/ArthurBudagMatsuda/launchpadlendaria/blob/2c8a156b784796f51fd2e028ba81af39936e3dd0/docs/PRD.md), à [arquitetura existente](https://github.com/ArthurBudagMatsuda/launchpadlendaria/blob/2c8a156b784796f51fd2e028ba81af39936e3dd0/docs/ARCHITECTURE.md) e ao [registro de decisões econômicas](https://github.com/ArthurBudagMatsuda/launchpadlendaria/blob/2c8a156b784796f51fd2e028ba81af39936e3dd0/docs/TOKENOMICS_DECISIONS.md). Esses arquivos não foram copiados nem sobrescritos. Na integração futura, seus índices devem apontar para esta especificação; o requisito de oferta fixa aqui refina o antigo item aberto sobre oferta variável.

O [módulo Web3 existente](https://github.com/ArthurBudagMatsuda/launchpadlendaria/tree/f62473c1f0b5344e74266e386657f2f251b4c6ab/packages/retry-web3) será o consumidor futuro das ABIs e manifestos verificados. Nenhum provider ou conector novo é necessário nesta fase.

## Reprodução

Node 24+, sem instalação de pacotes:

    cd packages/protocol-simulator
    node scripts/verify.mjs

Para regenerar saídas, execute `node src/run.mjs`. Para repetir somente as consultas públicas de contratos, execute `node scripts/check-dex.mjs`; `--write` substitui apenas a evidência de pesquisa. Essa consulta usa exclusivamente métodos RPC de leitura.

O pacote e seus arquivos não dependem do frontend nem executam testes de carteira. Nenhum resultado financeiro é uma previsão de demanda ou preço de mercado. A conclusão de solvência vale para as premissas matemáticas especificadas, não para um contrato ainda inexistente.
