# Estados e recuperação

Especificação candidata. **READY permite resgates.** Fechar compras e vendas indefinidamente quando uma DEX falha converteria um problema de integração em bloqueio de fundos. Esta escolha refina a proposta inicial da inspeção.

| Estado | Condição | Compras | Vendas | Saída |
|---|---|---|---|---|
| CREATING | Apenas durante a transação de lançamento | Compra inicial atômica | Não | ACTIVE ou rollback global |
| ACTIVE | Inicialização concluída; R < G | Até atingir G | Sim | READY |
| READY | R = G e ativos continuam na curva | Não | Sim | ACTIVE após venda, ou MIGRATING transitório |
| MIGRATING | Guard transitório, dentro de uma transação | Não | Não | GRADUATED ou rollback para estado anterior |
| GRADUATED | Posição recebida e validada no locker | Na curva, não | Na curva, não | Terminal; negociação na DEX |

CREATING/MIGRATING não são estados em que uma transação encerrada possa abandonar fundos. Se qualquer chamada falhar, EVM rollback restaura todo o estado anterior. `GRADUATED` só é registrado depois de verificar os pós-requisitos de custódia e settlement.

No simulador, CREATING/MIGRATING são operações locais, não estados persistidos. `buyAndGraduate` usa uma cópia transacional: falha de migração reverte também a compra final. A alternativa em duas transações, READY seguido de `graduate`, preserva vendas em caso de erro. Uma venda reduz R e retorna ACTIVE; o keeper deve recalcular, sem usar uma cotação anterior.

## Graduação, concorrência e idempotência

Qualquer pessoa pode acionar a graduação elegível, com destino, implementação e parâmetros fixados no lançamento. O manager só movimenta ativos pela chamada autorizada da curva; o chamador público não escolhe destinatários de principal. Um segundo acionamento em GRADUATED deve reverter com erro específico e não transferir ativos novamente.

Recomenda-se oferecer a opção atômica de compra final + graduação, expondo seu gas estimado. O modo separado é útil para keepers, mas uma venda antes da inclusão pode tornar sua transação inelegível. Esse risco afeta disponibilidade, não autoriza confiscar tokens ou impedir vendas.

Uma pool pré-inicializada em preço hostil, liquidez concorrente ou posição fora da tolerância deve causar rollback. Não mudar DEX, fee tier, preço ou destino por decisão instantânea de administrador para forçar conclusão. Os fundos continuam resgatáveis na curva. A falta persistente de uma rota segura é um bloqueio de graduação a reportar, sem promessa de conclusão garantida.

## Guardas adicionais

- Quotes não reservam estado; minOut, deadline, rede e configHash são verificados na execução.
- Callback não pode entrar em buy, sell, launch, graduate ou claim enquanto seus efeitos estão incompletos.
- Durante MIGRATING, apenas transferências exatas de settlement para os endereços conhecidos são permitidas; usuários não obtêm uma janela para burlar cap.
- Desativar o cap somente após validação da LP e simultaneamente à transição terminal; rollback restaura restrições em falha.
- Pausa administrativa, se aprovada, pode restringir novos lançamentos/compras; não deve bloquear resgates ou transferir principal. Política de pausa e duração ainda dependem de aprovação.
- Registro de duplicatas nunca volta a disponibilizar vagas após venda, abandono ou graduação.
