# Identidades e spam

Requisitos confirmados: no máximo dois lançamentos por nome canônico e, independentemente, dois por ticker canônico; o mesmo criador não repete o par; vagas são permanentes para lançamentos bem-sucedidos; reversões não consomem vagas.

## Opção A — identificadores ASCII verificáveis, recomendada para MVP

Nome de entrada: até 64 bytes, somente A–Z, a–z, 0–9, espaço ASCII e hífen. Remover espaços iniciais/finais, colapsar espaços consecutivos e converter A–Z para a–z. Nome canônico: 2–32 bytes e começa/termina com letra ou dígito. Hífens internos são mantidos. Ticker: 2–10 bytes alfanuméricos, sem espaços, convertido para maiúsculas ASCII.

O próprio contrato percorre bytes e produz os canônicos. Rejeitar tabs, controles, pontuação não permitida, zero-width, espaços Unicode, acentos, alfabetos não ASCII, emojis e UTF-8 malformado. Não remover silenciosamente caracteres para transformar uma identidade inválida em outra válida.

`MOON   Coin` e `moon coin` compartilham identidade. `moon-coin` e `moon coin` são diferentes, assim como `MO0N` e `MOON`. A política não promete eliminar todas as semelhanças visuais, marcas ou variações lexicais. O produto deve mostrar o identificador canônico e o endereço, além de alertas de imitação.

O nome ERC-20 deve ser a forma de exibição ASCII validada correspondente ao canônico. Um título Unicode em metadados pode ser apenas apelido não registrado, claramente identificado e sem substituí-lo em confirmações de carteira. Não exibir um apelido como prova de exclusividade.

Identidades on-chain propostas:

    nameId = keccak256(abi.encode(NAME_DOMAIN_V1, bytes(canonicalName)))
    tickerId = keccak256(abi.encode(TICKER_DOMAIN_V1, bytes(canonicalTicker)))
    creatorPairId = keccak256(abi.encode(creator, nameId, tickerId))

Usar domínios separados e `abi.encode`, com versão fixa por Factory. Não confiar em hashes enviados pelo cliente. O modelo offline compara strings e tuplas diretamente; não calcula Keccak nem serve como vetor de hash para Solidity.

Contadores locais à Factory e por chainId: nameCount, tickerCount e creatorPairUsed. Sua imutabilidade é necessária: sem funções para apagar, decrementar ou reclassificar identidades. Ao criar, reservar sob guard antes de chamadas externas, concluindo numa única transação. EVM rollback desfaz toda reserva em falha. Não afirmar exclusividade entre redes diferentes.

## Opção B — Unicode amplo verificável

Uma implementação completa exigiria fixar versão Unicode, normalização NFKC/case folding e uma política de confusáveis. Alternativas: tabelas completas verificadas no contrato ou prova criptográfica de uma transformação determinística com circuito/verificador versionados e entrada UTF-8 vinculada ao hash. Ambas ampliam auditoria, custo, manutenção e risco de versões incompatíveis. Não há circuito, tabela, benchmark ou prova implementados nesta fase.

Atestado por serviço de normalização é mais simples, porém concede confiança ao emissor, que pode censurar ou atestar canônicos inconsistentes. Assinatura prova o emissor, não a correção Unicode. Hash fornecido pelo frontend sem verificação não é uma alternativa segura.

ASCII limita usabilidade internacional, mas tem regras curtas e verificáveis por bytes. Unicode verificado só deve ser reconsiderado como nova versão de registro, com migração/colisões explicitamente analisadas. Custos de gas devem ser medidos; não há números estimados apresentados como benchmark.

## Eficácia econômica

Com o cenário de taxa de lançamento de 0,001 ETH, compra mínima líquida de 0,01 ETH, trading fee de 1% e rebate de 20% ao criador, o custo irreversível de criar, vender imediatamente e reclamar suas taxas é aproximadamente **0,0011608081 ETH**, antes de gas. O capital temporariamente exigido é maior, mas recuperável.

Dois participantes controlados pelo mesmo atacante podem ocupar as duas vagas de uma identidade. Múltiplas carteiras contornam tanto a regra por criador quanto o cap de saldo. As regras limitam repetição exata; não demonstram unicidade humana ou proteção de marcas.

Não recomendar uma taxa maior sem evidência de custo de abuso e aceitação do produto. Monitorar taxa de lançamentos abandonados, venda inicial imediata, ocupação de identidades e volume artificial. Moderação off-chain pode sinalizar/ocultar conteúdo na interface com motivo público; não liberar vagas, alterar contratos, confiscar tokens ou fingir que o registro foi removido. Não introduzir bloqueio do criador, vesting ou depósito não resgatável como se já estivessem aprovados.
