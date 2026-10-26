# Ameaças, premissas e riscos residuais

Escopo: documentos e modelo offline de uma futura Factory/curva/graduação na Base. Não há contrato RETRY para auditar. Fonte econômica de verdade futura: estado on-chain, não indexador ou interface.

Ativos: ETH real R, tokens dos usuários, estoque C, reserva L, NFT LP, excedentes bloqueados, créditos de taxas/restituições e vagas de identidades. Adversários: launcher, comprador, vendedor, contrato callback, MEV/searcher, indexador/RPC comprometido, chave administrativa comprometida e dependência mal configurada.

| Risco | Nível antes da mitigação | Controle proposto e teste necessário | Limitação |
|---|---|---|---|
| Resgatar ETH virtual ou misturar fee com R | Crítico | Ledgers segregados, fórmulas conservadoras, checagem R, invariantes de conservação | Modelo matemático não prova implementação |
| Saque indireto de principal LP | Crítico | Locker sem upgrade/calls/approvals/decrease; posição nova e custódia direta | Revisar toda herança e dependência, não só funções públicas próprias |
| Falha parcial de launch/migração | Crítico | Transação atômica, guard e pós-condições; rollback de todos os efeitos | Testar EVM e callbacks reais |
| Pool hostil pré-inicializada, preço/LP incompatíveis | Alto | Verificação de pool, amounts mínimos, limite de preço, rollback e READY com vendas | Atacante pode impedir graduação; não há garantia de liveness |
| Token0/token1, decimais ou Q96 incorretos | Alto | Razões inteiras, ambos os ordenamentos, limites e fork | LP proxy atual não cobre a mint exata |
| Exceção ampla do cap | Alto | Endereços/direções restritos, enforcement em transfer/transferFrom e buys | Cap não identifica beneficiário final nem impede múltiplas carteiras |
| Reentrância de ETH/refund/claim/manager | Alto | CEI, guard, refunds por pull, fontes fixas e rollback | Simulador não executa callbacks |
| Registry bypass por Unicode/hash arbitrário | Alto | Canonicalização por bytes no contrato, versão fixa e limites independentes | ASCII ainda permite nomes parecidos e ocupação de vagas |
| Chave de governança comprometida | Alto | Timelock, limites no alvo, configs antigas imutáveis e nenhum poder de principal | Multisig/operadores e atraso ainda dependem de aprovação |
| Sandwich/MEV e corrida para graduação | Alto | MinOut, deadline, quotes atualizadas, opção migração atômica | Não elimina MEV nem garante preço externo |
| Spam/Sybil/wash trading com rebate | Alto | Custo irreversível divulgado, monitoramento e limite de identidades | Compra obrigatória resgatável; regras não tornam ataques inviáveis |
| Griefing por doações/ETH forçado | Médio | Não usar balance bruto como R, classificação de excesso e transferências restritas | Sobras podem ficar presas; não criar escape administrativo |
| Rounding dust/overflow/dos por micro-operações | Alto | BigInt de referência, bounds, mulDiv seguro, rejeitar saída zero, fuzz de fronteiras | Solidity e matemática DEX ainda não verificados |
| Gas extremo/keeper ausente | Médio | Operações O(1), sem percorrer holders; caller paga gas, orçamento separado se aprovado | Simulador usa listas apenas para verificar invariantes; não copiar loops para Solidity |
| RPC equivocado/reorg/indexação duplicada | Alto | Chain/config/hash, provedores independentes, checkpoints e rollback de derivados | Uma fonte RPC não prova verdade independente |
| Metadata XSS/SSRF/impersonação | Médio | Limites, validação de upload no servidor, escaping, alerta de imitação e moderação transparente | Metadados não certificam legitimidade do token |
| Liquidez rasa, range extremo, perda de valor | Alto econômico | Simular profundidade e full range, expor riscos e limites de execução | Principal bloqueado não garante valor, preço, compradores ou rendimento |

## Critérios de bloqueio

Não habilitar valores reais se houver inconsistência de solvência, identidade, supply, custódia, roundings de DEX ou poder administrativo capaz de retirar principal. Não usar um ícone de cadeado como evidência de verificação. Uma falha de benchmark/integração não deve ser contornada com parâmetros inventados, alteração silenciosa de termos ou retirada para multisig.

Sem assinatura de deploy, chave privada, seed ou movimentação de ETH nesta fase. A consulta Mainnet realizada foi somente leitura dos contratos públicos da Uniswap. A pasta de pesquisa não contém credenciais e não habilita operações no Web3 existente.
