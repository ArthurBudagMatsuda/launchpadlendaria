# Registro de decisões — 26/10/2026

**Aprovação da Fase 2 autoriza pesquisa, documentos, simulações, testes e publicação desta branch. Não aprova parâmetros financeiros, Fase 3 ou implantação.**

## Requisitos recebidos

| ID | Requisito | Status |
|---|---|---|
| R01 | Base; ETH; ERC-20; produto constante | Requisito do produto |
| R02 | Oferta fixa, emissão única e sem alocação gratuita oculta | Requisito do produto |
| R03 | Dois usos por nome e dois por ticker, independentes | Requisito do produto |
| R04 | Mesmo criador não repete par; slots permanentes; rollback sem consumo | Requisito do produto |
| R05 | Criação e compra qualificante atômicas | Requisito do produto |
| R06 | Principal LP permanentemente indisponível | Requisito do produto, ainda não implementado/provado |
| R07 | Sem capital próprio recorrente para LP, se modelo viável | Objetivo atendido apenas no modelo ideal; confirmar DEX |
| R08 | Isolamento Git, sem sobrescrever agentes ou merge na main | Restrição vigente |

## Propostas que precisam de decisão explícita

| ID | Tema | Recomendação candidata | Evidência e motivo | Status |
|---|---|---|---|---|
| D01 | Supply/decimais | 1 bilhão / 18 | Referência recebida; unidades e conservação simuladas | Pendente |
| D02 | Alocação | 80% curva; 20% LP; zero gratuito para criador | Transição ideal com 800m vendidos/200m LP; comparar 70/30 e 75/25 | Pendente |
| D03 | Curva inicial | Modelo B: X0=floor(16S/15), V=1 ETH | Compra inicial ~1,056% do supply; menor impacto que A, menor capital que C | Pendente |
| D04 | Graduação | G=3 ETH de R para modelo B | Compatibilidade ideal de preço e inventário; 1/2 ETH deixam sobras, 4 é inalcançável | Pendente |
| D05 | Launch fee | 0,001 ETH; integralmente protocolo | Proposta recebida; não demonstra custo anti-spam suficiente | Pendente |
| D06 | Compra inicial | 0,01 ETH líquido em R, além das taxas | Definição transparente; bruto e total divulgados separadamente | Pendente |
| D07 | Trading fee curva | 1% compra e venda | Comparada com 0,5% e 2%; sem taxa ERC-20 | Pendente |
| D08 | Divisão trading fees | 80% protocolo / 20% criador | Créditos por pull e rebate próprio incluído no custo de spam | Pendente |
| D09 | Taxas LP | Propor mesma divisão 80/20, nos ativos recebidos | Não há previsão de receita LP; decisão distinta de D08 | Pendente |
| D10 | Cap | 5% por saldo, transfers incluídos; termina após graduação validada | Sem isenção ampla; não impede Sybil | Pendente |
| D11 | Identidade | ASCII verificável, policy V1 | Menor superfície verificável no MVP; Unicode não implementado | Pendente arquitetural |
| D12 | DEX | V3/WETH/full range; comparar tiers 0,3% e 1% | Menos lógica específica; falta benchmark/fork | Pendente |
| D13 | Desvio inicial máximo | Testar 10 bps | Candidato para teste exato, sem validação DEX ainda | Pendente |
| D14 | Sobras de settlement | Bloqueio permanente, separado das taxas | Preserva supply e impede dreno por dust | Pendente |
| D15 | Falhas de graduação | READY aceita vendas; venda retorna ACTIVE; opção final buy+migrate atômica | Evita bloqueio indefinido; permite griefing de disponibilidade | Pendente arquitetural |
| D16 | Restituição de excesso | Crédito segregado por pull; frontend envia valor exato | Evita callback do criador durante launch | Pendente arquitetural |
| D17 | Governança | Timelock 48h, configs apenas futuras, multisig | Comparar 7 dias; sem poder de retirar principal | Pendente |
| D18 | Limites de novos presets | Launch 0–0,01 ETH; trading 0–200bps; share criador 0–30% | Limites de pesquisa; não configurar sem decisão | Pendente |
| D19 | Pausa e signatários | Guardian omitido até definir duração/cooldown; endereços e quórum a escolher | Não bloquear vendas; evitar privilégios de bootstrap persistentes | Pendente |
| D20 | Fase 3 | Interfaces, bibliotecas, registry e token testados, sem curva financeira ativa | [TEST_PLAN](TEST_PLAN.md) | Requer aprovação própria |
| D21 | Implantação | Nenhuma autorizada | Base Sepolia e Mainnet exigem autorizações separadas | Não autorizada |

Não transformar o nome "balanced" de uma fixture em aprovação. As três configurações e variações de fee estão marcadas HYPOTHETICAL_NOT_APPROVED no código e nos resultados. Mudanças futuras devem registrar responsável, data, versão, justificativa, riscos, evidência de teste e autorização correspondente. Não alterar este status apenas porque um teste passou.
