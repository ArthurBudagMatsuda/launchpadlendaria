# Criação, compra e venda públicas

**Etapa 7 pública: BLOCKED — Worker/preview/Phantom reais não disponíveis.** Nenhuma transação pública nova enviada. Contas e assinaturas de validadores do CI pertencem a redes locais.

## Roteiro após desbloqueio

1. Abrir a URL estável da Beta; conferir commit, aviso e Devnet. Autorizar uploads com conta de testador, depois conectar Phantom de testes.
2. Create: nome/ticker inéditos, descrição e imagem válida; percorrer Preview e Summary. Conferir supply de 1 bilhão/9 decimals e parâmetros on-chain da config RETRY.
3. Revisar upload, URI pública e hash; conferir imagem e JSON em acesso sem cookies. Ausência de propagação impede preparação de transação.
4. Revisar custo simulado, primeira compra opcional e mint/pool esperados. O proprietário aprova a transação na extensão.
5. Conferir confirmação Devnet, supply/decimals/autoridades, config, criador e metadados; abrir o token a partir do Discover.
6. Buy: revisar SOL, quote oficial, fees, impacto e mínimo de saída; aprovar e registrar assinatura/slot/saldos antes e depois.
7. Sell: revisar saldo SPL, unidades e mínimo de SOL; aprovar e conferir os mesmos elementos.
8. Conferir Portfolio e atividade por **cluster + mint**, nunca somente por nome/ticker.

Em recusa, expiração, timeout ou resposta perdida: consultar assinatura e contas antes de qualquer nova tentativa. Não reenviar uma operação com nova assinatura cegamente. O transporte não repete `sendTransaction`; o executor existente reconcilia/reenvia os mesmos bytes quando aplicável.

## Registro a preencher na execução real

Data/browser/extensão, commit, URL, cluster/genesis, config, carteira pública, nome/ticker, URI/hash, mint, pool, assinatura/slot/confirmations, quantias brutas, fees/rent e saldos. Links Explorer devem conter `?cluster=devnet`. Não registrar chaves, cookies, JWTs ou imagens de dados privados.

Os [resultados públicos antigos](../devnet/evidence/PUBLIC_TEST_SUMMARY.json) de 29/10 tiveram criação/compra/venda e oito casos aprovados, mas **não passaram pelo preview/Phantom desta etapa**. São histórico, não aprovação da Beta Etapa 7.

O [CI novo](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41568352309) aprovou o formulário completo em dois validadores locais, com sete assinaturas de carteira simulada em cada cenário. Exercitou Create, Buy/Sell DBC, graduação, compra DAMM v2, claim LP, Portfolio e Discover. O teste de cadeia também vende na DAMM v2. Não comprova Phantom nem serviço Cloudflare publicado. Uma corrida entre conclusão da compra e input de venda foi corrigida e coberta por regressões React.
