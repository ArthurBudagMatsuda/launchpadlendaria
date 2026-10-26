# Especificação econômica candidata

**Todos os números de cenários e recomendações abaixo dependem de aprovação.** Fórmulas e invariantes devem passar por revisão independente antes da Fase 4. Unidades: ETH em wei; tokens em átomos de 18 decimais. Não usar `Number`, USD ou arredondamento de apresentação para execução.

## 1. Estoque e reservas

| Símbolo | Significado |
|---|---|
| S | Supply fixo inicialmente emitido uma única vez |
| C, L | Estoque inicial da curva e reserva inicial de tokens para LP; C + L = S |
| Q | Tokens líquidos em circulação fora do protocolo, após compras e vendas |
| I | Estoque físico da curva: C − Q |
| X0 | Reserva virtual efetiva inicial de tokens; X0 > C |
| Vt | Offset virtual de tokens: X0 − C; nunca pode ser transferido |
| V | Reserva virtual de ETH; nenhum ETH real é depositado para representá-la |
| R | ETH real contabilizado para resgates e migração |
| X, Y | Reservas efetivas de preço: X = I + Vt = X0 − Q; Y = V + R |
| F | Taxas efetivamente recebidas pelo FeeVault, fora de R |
| G | Threshold candidato baseado em R, não no saldo bruto do contrato |

O produto k = X·Y é calculado a cada operação a partir do estado anterior. Com arredondamento conservador, k não diminui. Não se usa um k fixo junto com uma regra de arredondamento diferente na implementação.

Tokens LP ficam segregados e indisponíveis antes da graduação. O criador recebe somente tokens comprados. Não há reserva gratuita de equipe/criador, inflação posterior, burn ou retirada de excedentes para a tesouraria. Tokens não utilizados na migração ficam permanentemente bloqueados, mantendo a conservação do supply. Essa destinação precisa de aprovação.

## 2. Compra exata em ETH

Dados entrada bruta g > 0 e taxa f em basis points, B = 10000:

    feeBuy = ceil(g · f / B)
    n = g − feeBuy
    q = floor(X · n / (Y + n))
    X' = X − q
    Y' = Y + n
    R' = R + n
    I' = I − q

Reverter se n = 0, q = 0, q > I, q < minTokensOut, deadline expirado, destinatário inválido, saldo final excede o cap ou n > G − R. Não fazer preenchimento parcial silencioso no threshold. O frontend informa o máximo aceito e a nova cotação se o estado mudar.

Para obter exatamente n de entrada líquida:

    grossForNet(n) = ceil(n · B / (B − f))

Para 0 ≤ f < B, `g − ceil(g·f/B)` equivale a `floor(g·(B−f)/B)`. A expressão acima é o menor g que cobre n; o modelo verifica inclusive fronteiras em wei. Taxa e tokens são arredondados em favor da cobertura, nunca inventando reserva.

BigInt tem precisão arbitrária e não reproduz todos os reverts por overflow de uint256. A configuração do modelo limita X0·(V+G), e entradas são verificadas como uint256, mas a implementação Solidity ainda precisa de limites de somas/produtos intermediários e mulDiv de precisão completa com arredondamento explícito. Não portar multiplicações do modelo supondo que sempre cabem em uint256. Comparação diferencial, limites de configuração e provas de bounds fazem parte dos gates posteriores.

## 3. Venda exata em tokens

Dados a > 0 tokens pertencentes ao vendedor:

    grossEthOut = floor(Y · a / (X + a))
    feeSell = ceil(grossEthOut · f / B)
    netEthOut = grossEthOut − feeSell
    X' = X + a
    Y' = Y − grossEthOut
    R' = R − grossEthOut
    I' = I + a

Reverter se a excede saldo/allowance, saída líquida é zero, saída fica abaixo de minEthOut, deadline expirou ou grossEthOut > R. Não limitar uma venda insolvente ao saldo restante: reverter preserva as condições cotadas. A venda é permitida em ACTIVE e READY; após GRADUATED usa-se a DEX.

O token é próprio do protocolo, sem taxas de transferência, rebase ou emissão posterior. Caso esses pressupostos mudem, esta prova deixa de servir.

## 4. Solvência condicionada e conservação

Inicialmente X0·V = k0 e R = 0. Cada compra/venda deixa X'Y' ≥ XY. Como não há mais tokens vendáveis do que os emitidos para circulação, X' ≤ X0. Logo:

    Y' ≥ k0 / X' ≥ k0 / X0 = V
    R' = Y' − V ≥ 0

Como Y' é inteiro e a divisão de saída usa floor, a desigualdade não depende de uma fração real representável. O teste explícito grossEthOut ≤ R continua obrigatório como defesa e detector de inconsistências.

Invariantes:

1. Antes da graduação: I + L + soma(saldos externos) = S.
2. Depois: LP + excedente bloqueado + soma(saldos externos) = S, na contabilidade inicial de migração. Depois de swaps, usar conservação ERC-20 global; composição da LP muda.
3. X = I + Vt, Y = R + V e XY ≥ X0V enquanto a curva opera.
4. Compras brutas acumuladas = R + vendas líquidas pagas + taxas ainda no vault + taxas já pagas + ETH migrado.
5. Créditos de taxas pendentes = saldo contabilizado das taxas no vault; nenhuma taxa é dívida de R.
6. A liquidez recebe apenas ETH real e tokens físicos; V e Vt não são transferíveis.

ETH forçado e tokens doados não alteram R, preço ou progresso. Saldos brutos excedentes devem ser classificados separadamente e não concedem poder de retirada. Resíduo de arredondamento do resgate integral permanece reservado; não é automaticamente receita. Essas condições exigem validação Solidity, incluindo armazenamento e callbacks.

## 5. Família com transição de preço financiada pela curva

Ignorando apenas a poeira de arredondamento, com R = r:

    X(r) = X0·V / (V+r)
    Q(r) = X0·r / (V+r)
    P(r) = (V+r)² / (X0·V) ETH por token

P é preço marginal; entrada líquida / tokens comprados é o preço médio. Com os dois ativos usando 18 decimais, Y/X é diretamente ETH/token; pares com outros decimais precisam de escala explícita.

Para vender C tokens até G e usar L tokens em uma LP ideal ao mesmo preço:

    C = X0·G/(V+G)
    L = G/P(G) = C·V/(V+G)
    G/V = (C−L)/L
    X0 = C²/(C−L)

Essa construção exige C > L e usa todo o ETH real G. Não financia V, taxas de trading, gas ou receitas com as reservas da LP.

| Alocação curva / LP | X0 / S | G / V | P(G) / P(0), ideal |
|---|---:|---:|---:|
| 70% / 30% | 1,225 | 4/3 | 49/9 ≈ 5,444 |
| 75% / 25% | 1,125 | 2 | 9 |
| 80% / 20% | 16/15 | 3 | 16 |
| 90% / 10% | 1,0125 | 8 | 81 |

Recomenda-se avaliar 80/20: mantém inventário relevante para descoberta de preço e 20% inicialmente reservado para LP, sem a inclinação de 90/10. Isso é uma escolha de produto, não uma otimização demonstrada de procura ou retorno. A configuração 70/30 pode ser preferível se menor variação for prioridade.

Para 80/20, X0 = floor(16S/15). O termo truncado e o crescimento de k podem deixar pequenos resíduos. O settlement deve usar os saldos reais no instante da graduação, não exigir que Q seja exatamente C.

Os três modelos simulados são configurações dessa mesma família de produto constante: A (V=0,25; G=0,75 ETH), B (V=1; G=3), C (V=3; G=9). Mantêm a forma e variam profundidade, preço inicial e capital necessário. Não são três algoritmos diferentes. [Resultados e trajetórias](SIMULATION_RESULTS.md).

## 6. Thresholds, liquidez e capacidade

No modelo B, alvos de 1, 2 e 3 ETH são alcançáveis no modelo. Os dois primeiros deixam estoque significativo e precisam destinar tokens não vendidos. Um alvo de 4 ETH é incompatível com o inventário de 800 milhões. Redefinir G sem rever X0, V e a alocação é uma mudança econômica, não um ajuste operacional.

Proporção ideal de tokens na LP:

    tNeeded = ceil(R·X/Y)
    tAvailable = L + I
    surplus = tAvailable − tNeeded, exigindo surplus ≥ 0

A escolha de ceil deixa preço R/tNeeded ligeiramente abaixo de Y/X por no máximo um átomo nessa aproximação. V3/V4 exigem matemática de posição com limites finitos, sqrtPriceX96, ordenação de ativos e ticks. O simulador não afirma que esses números sejam os amounts efetivamente aceitos pelo Position Manager. [Especificação de graduação](GRADUATION_AND_LOCK.md).

Comprar 0,01 ETH líquido no lançamento e respeitar cap de 5% exige, na aproximação inicial:

    V ≥ 0,01·(X0/(0,05S) − 1) ≈ 0,203333333333 ETH

Assim, a configuração V=0,1/G=0,3 é rejeitada. No modelo A o criador adquire cerca de 4,103% do supply; B, 1,056%; C, 0,354%. Variações nesses parâmetros precisam validar novamente o lançamento mínimo.

## 7. Taxas e receitas

Comparar 0,5% com divisão 80/20; 1% com 80/20; 2% com 70/30. Percentuais iguais nas compras e vendas reduzem assimetria. Não há taxa de transferência ERC-20. Recomendação de pesquisa: **1% e 80% protocolo / 20% criador**, com escolha ainda pendente. Taxa LP da DEX é separada; comparar 0,3% e 1% em fork.

Em cada taxa inteira Fop: creatorCredit = floor(Fop·creatorShare/B); treasuryCredit = Fop−creatorCredit. A tesouraria recebe a poeira da divisão. Creditar e permitir claims por pull, evitando distribuir a múltiplos destinatários durante cada trade. O custo de armazenamento do ledger compartilhado precisa de benchmark; não há medição de gas nesta fase.

No cenário B somente de compras até graduação: aproximadamente 3,03030303 ETH bruto, 3 ETH de R e 0,03030303 ETH de trading fees. Aproximadamente 0,02424242 vai ao protocolo e 0,00606061 ao criador. A taxa de lançamento de 0,001 ETH é adicional e propõe-se destiná-la integralmente ao protocolo. Esses valores não garantem sustentabilidade: não incluem custos operacionais, gas, volume posterior ou taxa ETH/fiat.

Rebate do criador sobre seus próprios trades é incluído no custo de spam. Bloqueá-lo apenas quando msg.sender é o criador seria contornável com outras carteiras. Não introduzir identificação pessoal ou regras ocultas.

## 8. Lançamento atômico e restituição

Recomendação: mínimo medido como **0,01 ETH líquido creditado a R**, antes de qualquer venda. Taxa de lançamento e taxa de compra são valores separados. A Factory recebe creatorGross explicitamente e exige msg.value ≥ launchFee + creatorGross. O frontend usa o valor exato por padrão.

Sequência não reentrante: validar identidade/configuração/deadline/valor; reservar contadores; criar token e curva; emitir S entre C e L segregados; executar compra qualificante e cap; creditar taxas; creditar eventual excesso ao refund ledger do pagador; emitir eventos. Qualquer falha reverte tudo, inclusive contadores, deploys, créditos e transferências.

Excesso não deve provocar uma chamada arbitrária ao criador no meio da criação. Proposta: crédito separado no FeeVault, resgatável pelo pagador via pull, com evento e exibição clara. Esse crédito não é taxa nem R. Uma falha no saque reverte o saque e mantém o crédito. O simulador não representa esse ledger nem chamadas externas; os testes Solidity da Fase 3/4 precisam cobri-lo. Claims de venda usam destinatário indicado pelo titular, CEI e reentrancy guard; se o pagamento falha, toda a venda reverte.
