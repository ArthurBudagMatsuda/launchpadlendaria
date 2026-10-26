# Governança limitada — proposta

Recomendação: usar TimelockController estabelecido, sem construir uma DAO própria nesta fase. O [modelo de papéis e timelock OpenZeppelin](https://docs.openzeppelin.com/contracts/5.x/access-control) é a referência; suas garantias dependem da configuração correta dos papéis e dos alvos.

## Matriz de poderes

| Ação | Autoridade proposta | Afeta lançamentos existentes? |
|---|---|---|
| Registrar novo preset econômico | Timelock, dentro de limites aprovados | Não |
| Mudar treasury para receitas de novos lançamentos | Timelock | Não; créditos e destinatários antigos permanecem |
| Agendar nova versão Factory/adapter | Processo versionado e revisão independente | Não migra posições antigas |
| Pausar novos lançamentos em incidente | Guardian limitado, se aprovado | Não bloqueia vendas, claims ou LP |
| Reclamar taxas | Beneficiário ou caller que só envia ao destinatário fixo | Somente crédito existente |
| Alterar supply/cap/taxas/configuração de token lançado | Ninguém | Proibido |
| Liberar nomes/tickers ou alterar registros concluídos | Ninguém | Proibido |
| Sacar R, principal LP, sobras bloqueadas ou confiscar saldos | Ninguém | Proibido |

Tokens, curvas e lockers devem ser imutáveis; upgrade de Factory é nova versão explícita, sem reset do registro existente. Se houver múltiplas Factories futuras, a política de exclusividade entre versões exige registro compartilhado imutável ou migração verificável aprovada; não afirmar continuidade de vagas sem esse desenho.

## Candidatos de política, ainda não aprovados

- Timelock de 48 horas, comparado com 7 dias: menor agilidade versus mais tempo de revisão pública. Recomenda-se 48 horas para configurações de novos lançamentos, sem função administrativa sobre principal.
- Proposer/canceller: multisig com signatários independentes; executor aberto pode executar apenas operações já maduras. Número de signatários, endereços e quórum dependem de decisão e verificação.
- Parâmetros de pesquisa para limites de novos presets: launch fee entre 0 e 0,01 ETH; trading fee entre 0 e 200 bps; creator share entre 0 e 30%. Esses intervalos são propostas, não permissões concedidas.
- Cap, G, reservas e alocação são vinculados ao configHash e imutáveis por lançamento. Não permitir mudanças econômicas no meio da curva.
- Guardian opcional pode suspender apenas novos lançamentos por até 24 horas por ativação; cooldown/repetições e cancelamento precisam de especificação aprovada para evitar pausa permanente indireta. Por padrão, não implementar guardian até resolver isso.

Guardas precisam estar nos contratos alvo: possuir um timelock não torna um saque de reservas aceitável. Locker não concede approval nem poder ao timelock. Não há função de emergência que mova principal para multisig.

Renunciar a papéis de bootstrap somente depois de testar distribuição, atraso mínimo e execução real em ambiente autorizado. Administrador remanescente, papel que pode recriar outro admin, proxy ou aprovação ampla invalida a alegação de restrição. Exibir alterações pendentes de presets e sua data de vigência no frontend; configHash esperado protege lançamento contra mudança silenciosa de termos.
