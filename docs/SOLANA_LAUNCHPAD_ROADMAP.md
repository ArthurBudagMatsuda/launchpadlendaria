# RETRY — Roadmap Solana

| Etapa                          | Entrega                                                                                                                   | Critério de saída                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Migração atual                 | Provider único, Wallet Standard, SOL real por RPC, mint lookup, adaptadores Mainnet, frontend preservado, export estático | Testes e CI verdes; revisão do Draft PR; matriz de extensões reais documentada como pendente |
| Especificação econômica        | Curva, supply, decimals, taxas, graduação, governança e modelo de ameaças                                                 | Aprovação explícita dos parâmetros e invariantes simulados                                   |
| Escolha DEX e prova técnica    | Comparar LaunchLab/CPMM e DBC/DAMM v2 usando versões/IDL e contas verificadas                                             | Testar fluxo de migração, lock e direito de taxas em ambiente de teste autorizado            |
| Programa e SDK do protocolo    | Implementar Rust/Anchor ou adaptador do protocolo escolhido, IDL e clientes tipados                                       | Testes unitários, propriedades, integração e revisão de privilégios                          |
| Indexação e metadados          | Mints, contas SPL, ATAs, eventos de criação, preços e assinaturas com finality                                            | Reconciliação com RPC; retry/replay e tratamento de rollback                                 |
| Aplicação financeira em Devnet | Criação, curva, transações e graduação reais de teste                                                                     | Simulações, rejeição de conta/cluster errado, falhas e reconciliação; autorização separada   |
| Segurança e operação           | Auditoria independente, multisig/upgrade, observabilidade, RPC dedicado, resposta a incidente                             | Correções verificadas, ensaio operacional e limites aprovados                                |
| Lançamento público             | Domínio e publicação autorizados; Mainnet somente após os critérios anteriores                                            | Aprovação explícita, monitoramento e rollout controlado                                      |

Próxima entrega recomendada: especificação econômica Solana assinada pelos responsáveis, acompanhada de simulador offline e decisão DEX. Não iniciar a curva financeira a partir das métricas do frontend.
