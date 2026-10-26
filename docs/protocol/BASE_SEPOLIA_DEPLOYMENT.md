# Preparação futura — Base Sepolia

**Documento de preparação; implantação não autorizada.** Não há contrato RETRY, script de assinatura, endereço RETRY implantado, chave privada ou pedido de ETH nesta fase. Consultar uma rede em leitura não autoriza enviar transações.

## Condições anteriores a qualquer implantação

1. Aprovar arquitetura, economia, estado, cap, normalização, DEX, locker e poderes.
2. Implementar e revisar contratos com compilador/dependências fixados; executar unit, fuzz, invariantes, adversários, análise estática e testes de fork com bloco registrado.
3. Verificar os deployments da DEX por fonte oficial, bytecode/build/immutables e mais de um RPC; conferir chainId 84532 e token de cotação. O manifesto de pesquisa não substitui allowlist de execução.
4. Revisar quem assina, endereço do deployer, orçamento exclusivamente de teste, contratos alvo, papéis, atraso de governança e plano de verificação pública. Não solicitar segredos no chat ou versioná-los.
5. Obter autorização explícita de implantação em Base Sepolia para uma versão exata revisável. Um script preparado ou aprovação da Fase 3 não basta.

## Ordem proposta a validar na implementação

Bibliotecas e implementações imutáveis; locker/manager/vault com bindings sem janela de takeover; Factory e configuração; registro das relações e papéis; verificação de todas as fontes; só então renúncia de bootstrap quando os testes de papel/delay passarem. Endereços mutuamente dependentes precisam de plano de inicialização atômica ou construção verificável; não improvisar permissões temporárias abertas.

Manifesto futuro por rede: chainId, endereço, papel, ABI versionada, commit, compiler/settings, deployment tx/block/hash, runtime codehash EVM, constructor/immutables, source verification e status. Marcar NOT_DEPLOYED antes e VERIFIED somente após conferência; nunca usar hashes SHA-256 de pesquisa como EXTCODEHASH.

Após implantação autorizada, começar por leituras: chain, código, bindings, configurações, papéis e ausência de privilégios. Exercícios financeiros de teste também precisam estar no escopo autorizado; documentar valores de teste, token/curve e resultados. Não anunciar permanente lock sem testar propriedade, liquidez, approvals, claims e impossibilidade de diminuir principal.

Preparar monitoramento de divergência de reservas/passivos, mudanças de papéis, operação de timelock, curva perto do threshold, tentativas de graduação, owner/liquidity de posição, claims e indexer lag. Incidente: pausar somente capacidades aprovadas, avisar usuários e preservar resgates e evidências. Sem função de emergência que saque principal.

Mainnet requer nova autorização, revisão independente e plano operacional próprio. Nada neste guia libera essa etapa.
