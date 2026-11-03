# Graduação pública — bloqueada

Config `8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N`, threshold **10.000000000 SOL**, reconfirmados por RPC. Funder: **2.013648909 SOL de teste**; Phantom informada: **0 SOL**. Nenhuma compra de aproximação ou migração pública foi enviada.

Mesmo antes de rent/fees, faltam pelo menos **7.986351091 SOL** para uma curva nova acumular 10 SOL a partir apenas do saldo do funder. Para a reserva operacional histórica de **12 SOL**, o déficit é **9.986351091 SOL de teste**. Estes são limites de planejamento, não uma cotação garantida de execução; recalcular reserva da pool, custos, slippage, migração e margem. Vender para recuperar SOL reduz a reserva da curva e não elimina o déficit.

Não reduzir threshold nem alterar distribuição. Não solicitar fundos reais ou contornar faucet. O proprietário escolheu preview sem execução; não houve solicitação de airdrop nesta etapa.

O [migrador manual oficial](https://migrator.meteora.ag/) atende Devnet; o keeper Mainnet não é prova de automação Devnet. [Documentação Meteora](https://github.com/MeteoraAg/docs/blob/main/developer-guides/dbc/index.mdx). O método `migrateToDammV2` do SDK fixado foi testado localmente, com segunda migração recusada. Para fechar esta fase, registrar reservas antes/depois, assinaturas, pool DAMM, posições e principal na Devnet pública. [Gates](RELEASE_CHECKLIST.md).
