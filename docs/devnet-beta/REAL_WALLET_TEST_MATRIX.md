# Carteiras reais — matriz de execução

**REAL WALLET: NOT TESTED / BLOCKED.** O proprietário ainda não tem Phantom exclusiva de testes disponível. Não houve assinatura de extensão real, instalação de carteira ou solicitação de seed/chave privada.

Preparar uma conta descartável sem ativos de valor, em browser compatível. O proprietário faz a criação/desbloqueio e as aprovações na extensão. Selecionar Devnet na Phantom e conferir também o cluster da aplicação; a seleção do aplicativo não altera silenciosamente as preferências da carteira.

| Caso                                                   | Phantom    | Solflare   | Backpack   | Evidência necessária                                 |
| ------------------------------------------------------ | ---------- | ---------- | ---------- | ---------------------------------------------------- |
| Detectar, conectar e mostrar chave pública             | NOT TESTED | NOT TESTED | NOT TESTED | Browser/versão, endereço público e rede              |
| Ler SOL e navegar Discover/Create/Trade/Portfolio      | NOT TESTED | NOT TESTED | NOT TESTED | Leituras sem assinatura, capturas sem dados privados |
| Reload, reconexão, troca de conta e desconexão         | NOT TESTED | NOT TESTED | NOT TESTED | Conta refletida e operações anteriores invalidadas   |
| Bloqueada, recusa e múltiplas extensões                | NOT TESTED | NOT TESTED | NOT TESTED | Mensagem e ausência de assinatura/envio indevido     |
| Criar pelo formulário                                  | NOT TESTED | NOT TESTED | NOT TESTED | URI, mint, pool, assinatura e confirmação Devnet     |
| Comprar e vender DBC                                   | NOT TESTED | NOT TESTED | NOT TESTED | Quantias, fees, mínimos, assinaturas e saldos        |
| Graduar e negociar DAMM v2                             | NOT TESTED | NOT TESTED | NOT TESTED | Migração, posições e operação pós-graduação          |
| RPC indisponível, conta alterada e confirmação perdida | NOT TESTED | NOT TESTED | NOT TESTED | Sem duplicar operação; reconciliação pelo estado     |

Métricas de testes simulados são registradas separadamente no relatório. Não marcar uma linha acima como APPROVED com base em mock ou chave de teste do CI.
