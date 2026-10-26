# Graduação, DEX e bloqueio permanente

Especificação candidata, sem integração executável. [Manifesto de pesquisa](research/dex-deployments.json) e [consulta pública registrada](research/dex-readonly-check.json). Os endereços de pesquisa não são allowlist de execução do RETRY.

## Evidência de implantação

Em 26/10/2026 foram consultadas as páginas oficiais de [V3 na Base/Base Sepolia](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments) e [V4](https://developers.uniswap.org/docs/protocols/v4/deployments). O script verificou chainId, presença de bytecode de quatro contratos por rede, correspondência de `factory()` V3 e `poolManager()` V4 e leu `WETH9()` V3. Registrou bloco/hash e fingerprints SHA-256; nova leitura do mesmo bloco confirmou seu hash durante a consulta.

Isso confirma presença de código e relações de configuração, não equivalência ao bytecode auditado, ausência de proxies ou segurança da integração. Antes de executar: verificar source/build, immutables, dependências, WETH, bytecode/hash com ferramenta EVM, funcionalidades/fee tiers e uma segunda fonte RPC independente. Não inferir um endereço Sepolia a partir de Mainnet.

## Comparação de V3 e V4

| Critério | V3 | V4 |
|---|---|---|
| Estrutura | Factory e pool própria por par/fee | PoolManager singleton com PoolKey |
| Posição | NFT do NonfungiblePositionManager | NFT do PositionManager, contabilidade por pool/posição |
| Ativo de cotação | WETH; wrapper no settlement | Suporta ETH nativo ou ERC-20; escolha precisa ser fixa |
| Liquidez | Range/ticks; full range possível | Range/ticks; full range possível |
| Inicialização | Pool inexistente ou preço existente precisa ser validado | PoolKey e preço existente precisam ser validados |
| Integração | Custódia NFT e collect mais diretos para o escopo atual | Actions, unlock/settlement e deltas ampliam a superfície a revisar |
| Gas | Criar uma pool por lançamento tem custo próprio | Singleton e net settlement podem reduzir custos; medir o fluxo RETRY |
| Customização | Não exige hooks | Hooks opcionais; recomendar hook zero e taxa fixa no primeiro estudo |
| Principal permanente | Locker imutável sem decrease/transfer/approval | Locker com ações estritamente permitidas e nenhuma redução de liquidity |

A arquitetura singleton e a liquidação por deltas estão descritas em [Flash Accounting](https://developers.uniswap.org/docs/protocols/v4/concepts/flash-accounting). Não houve benchmark comparativo; não afirmar um percentual de economia. Recomendação MVP: V3/WETH/full range para reduzir a lógica específica de integração. V4 sem hooks pode ser reavaliada após comparação de fork; não escolher V3 por supor que V4 seja insegura.

## Compatibilidade de preço e inventário

Preço terminal alvo P = Y/X. Quantidades ideais: ETH R e tokens ceil(R·X/Y); usar estoque L + I, não reservas virtuais. A família 80/20, G=3V aproxima 800 milhões circulantes / 200 milhões LP, com sobra pequena bloqueada. Outros thresholds podem deixar milhões de tokens fora da LP; sua destinação precisa ser explícita e imutável.

Na implementação exata, ordenar token0/token1 por endereço e transformar P em razão de unidades atômicas; se token RETRY for token1, inverter a razão. Para uma razão pRaw = amount1/amount0:

    sqrtPriceX96 = floor(sqrt(pRaw) · 2^96)

Usar aritmética inteira de precisão adequada, verificar limites uint160/ticks e confirmar a conversão inversa. Para sqrtPrice s dentro de [a,b], a matemática de posição usa quantidades proporcionais a liquidity·(1/s−1/b) do token0 e liquidity·(s−a) do token1, com escalas Q96 e arredondamentos próprios. Ver [LiquidityAmounts oficial](https://github.com/Uniswap/v3-periphery/blob/main/contracts/libraries/LiquidityAmounts.sol). O full range real é finito e alinhado ao tickSpacing do fee tier; não presumir que R/tokens do simulador seja o valor mintado.

Recomenda-se testar fee tiers de 0,3% e 1%; o tier da DEX não é automaticamente a trading fee da curva. Candidato de tolerância máxima inicial: 10 bps entre preço final e preço inicial da pool, a confirmar por matemática exata e testes. Não realizar swap corretivo custeado pelas reservas para mascarar incompatibilidade de preço.

Pool preexistente é um caso adversarial obrigatório: atacante pode inicializá-la ou adicionar liquidez antes da graduação. Conferir factory/poolKey, ativos, fee, tickSpacing, hooks, preço e liquidez existente. Pool incompatível faz a migração reverter. Não prometer reset de pool nem trocar silenciosamente de tier. Como READY permite vendas, uma falha persistente não bloqueia a saída da curva. A mitigação de griefing e a rota final são condições de revisão da Fase 5.

## Settlement atômico

1. Guard e checagem de estado, chain/config, R e saldos físicos.
2. Calcular amounts exatos e tolerâncias; autorizar apenas o manager fixado, com allowances exatas.
3. Transferir/embrulhar ETH real para WETH quando necessário; nenhuma dedução administrativa de R para taxas ou keeper.
4. Inicializar ou validar a pool; mintar uma posição nova diretamente ao locker com amounts mínimos e prazo.
5. Confirmar owner, ativos, posição, tick range, liquidity > 0, ausência de approvals e coerência entre entradas/amounts retornados.
6. Zerar allowances; classificar todo resíduo de tokens/WETH em bloqueio permanente separado; registrar dados.
7. Só então desativar cap e registrar GRADUATED. Qualquer falha reverte todas as etapas.

Caller paga gas; se for necessário incentivo de keeper, ele precisa de orçamento de taxas separado e aprovação. Não financiar operação com principal escondido. Um pequeno excedente de WETH de mint por arredondamento permanece bloqueado; se material, o settlement deve falhar por tolerância. Não enviar dust para criador/tesouraria.

## Locker e promessa verificável

Promessa: **os direitos de remover liquidity da posição criada pelo RETRY e os excedentes classificados como principal ficam permanentemente indisponíveis**. A quantidade de cada ativo dentro da posição e seu valor variam com swaps; não prometer quantidades ou preço fixos, nem custódia de LPs criadas por terceiros.

Locker sem proxy/upgrade, delegatecall, executor genérico, resgate de ativos de principal, transferência de NFT, approve/setApprovalForAll, permit/assinatura de autorização, decreaseLiquidity ou burn de posição financiada. Governança não recebe exceção. Sem private key de owner da NFT; o owner é o contrato imutável. Inicializações/registros somente da Factory/manager esperados.

A posição deve ser nova, resultado da mint autorizada, com liquidity inicial registrada e principal nunca reduzido. Não aceitar importação arbitrária de NFTs: em V3 valores sacados podem ficar misturados com fees em tokensOwed. O [Position Manager V3](https://github.com/Uniswap/v3-periphery/blob/main/contracts/NonfungiblePositionManager.sol) permite decrease seguido de collect; impedir decrease e sua autorização é parte da prova. A mint V3 usa `_mint`, portanto não depender de `onERC721Received` para registrar a custódia; validar explicitamente o tokenId retornado. Receiver só aceita o Position Manager esperado em transferências seguras, sem fornecer rota de retirada.

Coleta V3: chamar exclusivamente collect sobre os IDs registrados, direcionando ao vault e conciliando os amounts nos dois ativos. Beneficiários e divisão por lançamento são imutáveis; a proposta é repetir 80/20, sujeita à aprovação separada. No modelo sem decrease, a coleta não pode retirar principal da posição. A semântica exata e adversários devem ser provados em fork.

Em V4, o [PositionManager oficial](https://github.com/Uniswap/v4-periphery/blob/main/src/PositionManager.sol) usa ações de modificação; coleta pode exigir decrease com delta de liquidity zero. Isso não autoriza delta negativo, burn, transfer ou uma sequência arbitrária de actions. Um locker V4 teria de construir internamente a sequência fixa, sem calldata arbitrária e com todos os deltas conciliados. Não há implementação ou prova RETRY desse caminho nesta fase.

Postconditions: owner continua locker; liquidity após coleta ≥ liquidity inicial; posição/range/ativos não mudam; não existe approval; taxas creditadas têm entrada real; todos os resíduos têm destino bloqueado. A afirmação de permanência ainda requer revisão de bytecode e testes de implementação, incluindo rotas herdadas e autorizações indiretas.
