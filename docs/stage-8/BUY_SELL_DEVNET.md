# Buy/Sell — evidência por ambiente

**Novas operações públicas: BLOCKED no preview de leitura; zero enviadas.** Quote não é confirmação de swap. Não reutilizar as assinaturas públicas de outubro como evidência nova.

Regressão de venda ampliada: digitar quantidade e receber novas holdings, slot/preço, quote, slippage e foco não apaga o input; a reconciliação de uma compra anterior também não remove a venda recém-digitada. Trocar de conta continua remontando o formulário para não usar o estado de outra carteira.

Nos validadores locais passaram buy, sell, minimum output, recusa de slippage/oversell, confirmação e conservação de saldos. Os builders continuam validando cluster, programas, mint/pool e quote antes de assinatura. O transporte não repete `sendTransaction`. [Validador Devnet local](evidence/validator-devnet-programs-local.json), [Mainnet local](evidence/validator-mainnet-programs-local.json).

O próximo ensaio público deve registrar amount in/out, fee, signature, slot e leitura de saldos após confirmação pela URL real. A matriz histórica não substitui esse ensaio. [Procedimento anterior](../devnet-beta/CREATE_TRADE_E2E.md).
