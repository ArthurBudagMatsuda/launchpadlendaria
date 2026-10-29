# RETRY — Relatório das Etapas 4, 5 e 6: criar, negociar e graduar na Meteora

Data: **29/10/2026**. Branch: **`feat/retry-meteora-create-trade-graduate`**, Draft PR [#9](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/9), empilhado sobre `feat/retry-meteora-dbc-mvp` (PR #8, etapa 3), que está sobre `migration/retry-solana` (PR #6). Escopo: criação de tokens (etapa 4), compra e venda na bonding curve (etapa 5), graduação para o Meteora DAMM v2 com liquidez travada e negociação depois da graduação na mesma página (etapa 6). Devnet e testes locais; Mainnet preparada e travada.

Este relatório só registra o que foi executado e medido. Cada resultado diz de que nível de evidência vem: **U** unitário, **I** integração, **B** navegador com RPC e carteiras simulados, **V** validador local com os programas oficiais da Meteora, **VB** navegador contra o validador, **D** Devnet pública, **R** carteira real. Um nível não prova o de cima ([TESTING.md](../meteora-mvp/TESTING.md)). Estimativas aparecem marcadas como estimativa. **Nenhuma transação foi enviada à Mainnet e nenhum SOL real foi movimentado.**

## 1. Resumo Executivo

As três etapas estão implementadas sobre os programas oficiais da Meteora, sem programa on-chain próprio, aproveitando o código das etapas anteriores:

- **Criar** (etapa 4): token SPL de supply fixo e pool DBC da config RETRY numa só transação, com primeira compra opcional, metadados imutáveis conferidos por hash, regras de nome da plataforma, custo simulado antes de assinar, conferência da config e do fee claimer on-chain e proteção contra envio duplicado.
- **Negociar** (etapa 5): compra e venda em SOL na curva com quotes do SDK sobre o estado lido, recotação antes de assinar, mínimo de saída garantido pelo programa, WSOL automático e taxas divididas na tela.
- **Graduar** (etapa 6): conclusão da curva por preenchimento parcial, migração para o DAMM v2 pela página do token (manual na Devnet), **prova on-chain do bloqueio** das duas posições de LP, negociação contínua na mesma página contra a pool DAMM v2, saque das taxas de LP e posições de LP no portfolio.

Evidência: o fluxo completo roda com transações reais contra os binários da Meteora **clonados da Devnet e da Mainnet** num validador local no GitHub Actions (V, 21 testes) e pela interface no navegador (VB, sete assinaturas: lançar, comprar, vender, completar a curva, graduar, comprar no DAMM v2, sacar taxas de LP). Na **Devnet pública**, com a carteira de teste do PR #8, foram confirmados config, criação, compra, venda, recusas de saldo e slippage e saque do criador (D). **Não foram executados na Devnet pública** a conclusão da curva, a migração, o DAMM v2 e a prova do bloqueio, por falta de autorização de graduação.

Nível de conclusão: o MVP funciona de ponta a ponta em ambiente de testes. **Não está pronto para produção**: faltam o Worker de metadados implantado, testes com carteiras reais, a graduação na Devnet pública, a tesouraria, a revisão independente de segurança, o tratamento dos alertas de dependências e a autorização do proprietário (seções 45 a 47).

## 2. Estado Inicial

| Branch                                      | Commit no início        | Situação                                                                                                          |
| ------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `main`                                      | `0fcc9e5` (PR #7)       | site publicado no GitHub Pages, ainda a versão Base. Não alterado                                                 |
| `migration/retry-solana` (PR #6, Draft)     | `a2d1748`               | migração para Solana: Wallet Standard, `@solana/kit`, leitura. Não alterado                                       |
| `feat/retry-meteora-dbc-mvp` (PR #8, Draft) | `2930621` (28/10 21:14) | etapa 3: config DBC, criação, compra e venda na curva, migração manual, Worker de metadados, relatório da etapa 3 |

O que a etapa 3 já entregava: criação com primeira compra, negociação na curva, migração manual testada no validador com conferência das posições travadas, executor com allowlist, registro de operações, Worker de metadados testado e não implantado, e um teste de navegador com três assinaturas (lançar, comprar, vender). A config RETRY da Devnet não existia (`devnet: null`).

O que faltava para as etapas 4 a 6: negociar o token depois da graduação, provar o bloqueio na interface, sacar taxas de LP, histórico e gráfico de tokens RETRY (a atividade era só uma lista de assinaturas), colunas do Discover por estado, posições de LP no portfolio, chaves separadas por recurso, folha de aprovação da Mainnet, regras de nome, os documentos da seção 43 e testes do DAMM v2 e adversariais.

Durante o trabalho, o PR #8 avançou por outro agente ("RETRY Development"): registrou a config da Devnet `8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N` (commit `4233212`), rodou o smoke público e protegeu o Worker com Cloudflare Access. Esses commits entraram aqui por merge (seção 3).

## 3. Estratégia Git

- **Base**: `feat/retry-meteora-dbc-mvp` em `2930621`. Branch nova `feat/retry-meteora-create-trade-graduate` e Draft PR #9 com base no PR #8, para o diff mostrar só as etapas 4 a 6. Ordem de merge: #6, #8, #9.
- **Isolamento**: nenhum push no PR #8, no PR #6 ou na `main`. O site público não muda: só a `main` publica o Pages.
- **Trabalho de outros agentes preservado**: os avanços do PR #8 entraram por **merge**, nunca por rebase ou force-push: `279e2d5` (correção do teste on-chain, `0c70480`) e `768181e` (desbloqueio da Devnet, `a3a34bb`). No segundo, os conflitos foram resolvidos mantendo os dois lados: `pnpm-workspace.yaml` (builds permitidos, exceções de idade mínima e o override do SDK do DAMM v2) e o workflow (o job de Devnet protegido do PR #8). O lockfile foi conferido com instalação congelada.
- **Pedidos do PR #8 respeitados**: `docs/meteora/devnet-metadata/retry-devnet-test.json` continua no mesmo caminho (é a URI gravada on-chain) e a entrada `RETRY_DBC_CONFIGS.devnet` manteve o formato.
- **Documentos**: os de `docs/meteora/` passaram para `docs/meteora-mvp/`; `docs/meteora/README.md` mapeia os nomes antigos. Como vários foram reescritos, o Git não os reconhece mais como renomeação: uma edição futura do PR #8 nos caminhos antigos vai precisar ser levada à mão para os novos.
- Nada foi apagado do remoto, nenhum merge foi feito em PR, nenhum histórico foi reescrito.

## 4. Decisão Meteora

**DBC + DAMM v2**, porque o pedido e a etapa 3 já fixavam esse caminho e porque ele cobre o MVP sem código financeiro próprio:

- o DBC dá a bonding curve com config de parceiro (taxas, threshold, supply, travamento) e um ponto de identificação on-chain (a config) para listar só tokens RETRY;
- o DBC migra para o DAMM v2 com a liquidez travada para sempre por instrução do próprio programa (`permanent_lock_position`), sem custódia da RETRY;
- na Mainnet, o keeper da Meteora migra pools em SOL com threshold de pelo menos 10 SOL;
- os dois programas têm SDK oficial em TypeScript, então quotes e transações são a matemática do programa, não uma cópia.

Fora do MVP, por regra: curva própria, Raydium, Base/EVM e programas Rust próprios.

## 5. SDKs e Dependências

| Pacote                                  | Versão | Licença    | Uso                                                                                          |
| --------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------- |
| `@meteora-ag/dynamic-bonding-curve-sdk` | 2.0.0  | MIT        | DBC (IDL `dynamic_bonding_curve` 0.2.2): config, criação, quotes, swap, migração             |
| `@meteora-ag/cp-amm-sdk`                | 1.5.1  | MIT        | DAMM v2 (IDL `cp_amm` 0.2.5): pool graduada, quotes, swap, taxas de LP. **Novo nesta etapa** |
| `@solana/web3.js`                       | 1.98.4 | MIT        | transações dos SDKs da Meteora                                                               |
| `@solana/spl-token`                     | 0.4.15 | Apache-2.0 | contas de token e WSOL                                                                       |
| `@solana/kit`                           | 8.5.0  | MIT        | carteira e leituras do PR #6                                                                 |
| `decimal.js`                            | 10.6.0 | MIT        | só preços e porcentagens para exibição; quantias são `bigint`                                |
| `lightweight-charts`                    | ^5.2.1 | Apache-2.0 | gráficos, carregado sob demanda                                                              |

As duas versões da Meteora eram as últimas publicadas no npm em 29/10/2026. Versões exatas, lockfile congelado e a política de idade mínima de releases do pnpm (PR #8). Compatibilidade:

- os SDKs usam web3.js v1 e o `Buffer` do Node: cada SDK tem um único ponto de importação que instala o polyfill (`sdk.ts`, `damm-sdk.ts`);
- `@meteora-ag/cp-amm-sdk` 1.5.1 declara como dependência o pacote `chain` (kit de interface EVM com wagmi, ethers e React 18), que o SDK nunca importa. O override `"@meteora-ag/cp-amm-sdk>chain": "-"` remove esse pacote, evitando trazer EVM de volta;
- `pnpm audit --prod` (PR #8) registra 10 alertas em dependências transitivas, 6 altos e 4 moderados: `bigint-buffer` (via `@solana/spl-token`, sem versão corrigida), `toml` (via `@coral-xyz/anchor`), `stream-json` e `uuid` (via `@solana/web3.js`). Não corrigidos nem suprimidos; não foi feita análise formal de exposição ([evidência](../devnet/evidence/DEPENDENCY_AUDIT.json)).

## 6. Program IDs

| Programa / conta                | Endereço                                       | Verificação                                                               |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| Meteora DBC                     | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`  | constante do SDK e da IDL (U); executável nos dois clusters (CI)          |
| Meteora DAMM v2 (`cp_amm`)      | `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`  | idem                                                                      |
| Meteora Locker                  | `LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn`  | idem (a config RETRY não usa vesting)                                     |
| Metaplex Token Metadata         | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`  | idem                                                                      |
| Pool authority do DBC           | `FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM` | constante conferida contra a derivação do SDK; saldo lido a cada execução |
| Pool authority do DAMM v2       | `HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC` | PDA derivada no código (`derivePoolAuthority` do SDK)                     |
| Event authority do DAMM v2      | `3rmHSu74h1ZcmAisVcWerTCiRDQbUrBKmcwptYGjHfet` | PDA `__event_authority` do `cp_amm`, derivada no código                   |
| Config DAMM v2 de migração (1%) | `Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp` | existe nos dois clusters, dono `cp_amm`, restrita à pool authority do DBC |

Os mesmos endereços em Devnet e Mainnet. O job "Pinned programs on Devnet and Mainnet (read-only)" confere a cada execução que os programas existem, são executáveis e pertencem ao loader atualizável, e registra a autoridade de upgrade e o hash dos binários. Em 29/10/2026: DBC e DAMM v2 atualizáveis por `JADaUV8kvDpDbJr55wxXJHVaBS3VCj8thZZHjfeuCVLd` na Mainnet e por `DHLXnJdACTY83yKwnUkeoDjqi4QBbsYGa1v8tJL76ViX` na Devnet; Locker por `CvQZZ23qYDWF2RUpxYJ8y9K4skmuvYEEjH7fK58jtipQ` na Mainnet; Metaplex imutável na Mainnet. **Os binários da Devnet e da Mainnet são diferentes** (hashes em [PROGRAMS_AND_NETWORKS.md](../meteora-mvp/PROGRAMS_AND_NETWORKS.md)), por isso o fluxo roda com os dois. O frontend não aceita Program IDs de fora: são constantes, e a allowlist recusa qualquer outro programa.

## 7. Arquitetura Técnica

UI → hooks (`src/hooks/use-retry.ts`) → `MeteoraContext` (mesma carteira, cluster e RPC do provider do PR #6, mais a config e o fee claimer registrados) → SDK do DBC ou do DAMM v2 → `validateTransaction` (allowlist de instruções e contas) → simulação → carteira (Wallet Standard `solana:signTransaction`) → `validateSigned` e `verifySignatures` → registro da operação → envio com preflight → confirmação reenviando os mesmos bytes → reconciliação e atualização das queries.

Módulos novos desta etapa em `src/lib/meteora/`: `damm-sdk.ts` (ponto único do SDK do DAMM v2), `damm-layout.ts` (layouts do `cp_amm` usados pela allowlist e pelo histórico sem carregar o SDK), `damm-v2.ts` (pool graduada, quotes, compra e venda, prova do bloqueio, taxas e posições de LP), `history.ts` (histórico decodificado dos eventos e velas), `naming.ts` (regras de nome) e `mainnet-approval.ts` (folha de aprovação). Componentes novos: `damm-panels.tsx` (negociação e taxas de LP no DAMM v2, carregado sob demanda) e `launch-history.tsx` (gráfico e atividade). Detalhes: [ARCHITECTURE.md](../meteora-mvp/ARCHITECTURE.md).

O site continua estático no GitHub Pages; não há API route. O único serviço extra é o Worker de metadados (não implantado).

## 8. Configuração RETRY

Uma config de parceiro DBC por cluster, construída com `buildCurve` do SDK (`src/lib/meteora/curve.ts`): SPL Token, 9 decimals, supply fixo de 1 bilhão, autoridades `Immutable`, taxa fixa de 1% cobrada em SOL, metade do que sobra da parte da Meteora para o criador, criação de pool gratuita, threshold de 10 SOL, migração para DAMM v2 com LP de 1% (`FixedBps100`), 0% de taxa de migração, liquidez 50% parceiro + 50% criador, **100% travada para sempre**, sem vesting, sem leftover, ativação imediata por timestamp.

Autoridades e contas: o **fee claimer** (parceiro) recebe a parte RETRY das taxas da curva e a NFT de uma das duas posições travadas. Na Devnet é `DbvhT2t9yBY4nNsXZLjDhf7Aa13x3TsA83RdxQDhNAqD`, chave de teste efêmera (`feeClaimerKind: "ephemeral-test-key"`); na Mainnet precisa ser uma tesouraria. Antes de montar qualquer transação, `configMismatches` compara **21 campos e todos os pontos da curva** da config on-chain com os revisados; a criação também exige que o fee claimer on-chain seja o registrado. Config da Devnet: `8Mfndt2X3CB3zVZyLmxtRxdQTSwk7uqXfFFuso3gUA6N`, criada em 29/10/2026 19:26:06 UTC (transação `5rKrTaNc…`, slot 516519451). Mainnet: nenhuma. Os parâmetros para aprovação estão na folha [MAINNET_APPROVAL.md](../meteora-mvp/MAINNET_APPROVAL.md), gerada do código, com hash `7ab74f6fe4709d4eaa9a6721cdd6a6533cd88688634e484c4898ab48305d3b0f`. Detalhes: [RETRY_LAUNCH_CONFIGURATION.md](../meteora-mvp/RETRY_LAUNCH_CONFIGURATION.md).

## 9. Supply e Decimals

1.000.000.000 tokens com 9 decimals, ou 10¹⁸ unidades, sem autoridade de mint depois da criação. Pela folha de aprovação: 799.999.791,745821028 tokens (79,9999%) vendidos na curva até o threshold e 200.000.208,254178972 (20%) para o DAMM v2; leftover 0; nenhuma alocação do criador.

Reconciliação medida numa graduação no validador (V; o teste confere a soma nas duas variantes do CI): 199.600.207,817670594 tokens na pool DAMM v2 + 400.000,436508994 no cofre do DBC (a retenção de ≈ 0,2% da Meteora) + 30.766.226,884943507 com o criador (primeira compra de 0,1 SOL) + 769.233.564,860876905 com o trader = **exatamente 10¹⁸ unidades**. Na Devnet pública, a criação conferiu supply, decimals e autoridades (D).

## 10. Criação de Tokens

Create, etapa 3 (`launch-panel.tsx`) → `prepareCreateToken` (`create-token.ts`): recurso `create` ligado, cluster conferido pelo genesis, config e fee claimer conferidos, regras de nome, `createPoolWithFirstBuy` do SDK, allowlist (só `initialize_virtual_pool_with_spl_token`, a primeira compra e as contas da própria carteira), simulação e custo na tela; "Sign & launch" vale 45 s depois da revisão; a carteira e o keypair do mint (gerado no navegador, nunca gravado) assinam; a assinatura é registrada antes do envio. Duplicatas: `launchRequestId` (SHA-256 de carteira, nome, ticker e URI) e o bloqueio de lançamento pendente. Recuperação: reconciliação pelo estado da chain ao recarregar, sem reenvio.

Resultado: criação confirmada no validador com os binários das duas redes (V), pela tela no navegador (VB, "Browser Cat") e na Devnet pública, mint `6WwkimyJfjEbeh7wSXYRZ6e26pmEyPLWwTUt9fTY1nUz`, transação [3nh1iy8t…](https://explorer.solana.com/tx/3nh1iy8tmTqZRDTdtBvKFTUUC4hPCLXXBrVB4QXhB9hJqJFANisp2ZDKDqAHq4h8ENsUQo9vqj8DBo9cVEWSaMr1?cluster=devnet) (D). Detalhes: [TOKEN_CREATION.md](../meteora-mvp/TOKEN_CREATION.md).

## 11. Metadados

On-chain (Metaplex): nome, ticker e URI imutáveis (`isMutable = false`, update authority = System Program), conferidos on-chain (V, D). Off-chain: JSON e imagem no Worker RETRY (Cloudflare Workers + KV), endereçados pelo SHA-256 do conteúdo; o app relê o JSON, confere o hash e os campos e só então grava a URI. O envio exige sessão do Cloudflare Access (o Worker confere o JWT: RS256, issuer, audience, expiração) e é limitado a 10 por minuto por identidade. A leitura só aceita hosts confiáveis, conteúdo de até 16 KB, nome e ticker iguais aos on-chain, e nada vira HTML.

**O Worker não está implantado**: sem ele ninguém lança pela tela. Os testes usam o JSON versionado em `docs/meteora/devnet-metadata/` (V, D) e o Worker rodando no processo do teste (VB). 16 testes do Worker com KV, JWKS e limitador simulados (U). Detalhes: [METADATA_AND_STORAGE.md](../meteora-mvp/METADATA_AND_STORAGE.md).

## 12. Custos de Criação

Criação com primeira compra de 0,1 SOL, com a taxa de rede, para quem assina:

| Ambiente       | Valor          | Tipo           |
| -------------- | -------------- | -------------- |
| Validador (CI) | 0,12654696 SOL | medido         |
| Devnet pública | 0,12208008 SOL | medido         |
| Mainnet        | 0,12208008 SOL | **estimativa** |

Fórmula, conferida nas transações: 0,1 SOL de compra + 0,01 SOL que o programa Metaplex deposita na conta de metadados além do aluguel (a RETRY não recebe nada) + aluguel de seis contas novas (mint, metadados, pool, dois cofres e a conta do token do criador; 2.376 bytes contando 128 por conta) + 0,00001 de rede (2 assinaturas). O aluguel é do cluster: o validador cobra 6.960 lamports por byte e a Devnet e a Mainnet 5.080 (lidos pelo CI em 29/10/2026), então o aluguel é 0,01653696 SOL no validador e 0,01207008 nos clusters públicos. A estimativa da Mainnet usa o aluguel da Mainnet e as contas medidas; não houve medição na Mainnet.

Infraestrutura: Pages R$ 0; Worker e KV no plano gratuito (cada envio grava dois objetos; mil gravações por dia, cerca de 500 lançamentos); config da Mainnet ≈ 0,00598408 SOL uma vez (estimativa). Detalhes: [FEES_AND_COSTS.md](../meteora-mvp/FEES_AND_COSTS.md).

## 13. Compra Inicial

Opcional, de 0 a 1 SOL (`MAX_INITIAL_BUY_LAMPORTS`), **na mesma transação** da criação: ninguém compra antes do criador e o criador recebe só o que comprou, ao preço da curva, pagando a mesma taxa de 1%. Pela curva RETRY, 0,1 SOL compra 3,0766% do supply, 0,5 SOL 13,7918% e 1 SOL 24,4255%; a revisão mostra a porcentagem e o mínimo antes de assinar. A quote vem de `getQuoteFromInputAmount` sobre a própria config, porque a pool ainda não existe. Medido (V): o criador recebeu exatamente a saída cotada (30.766.226,884943507 tokens por 0,1 SOL).

## 14. Bonding Curve

Modelo da Meteora: liquidez concentrada sobre `sqrtPrice` entre o preço inicial e o de migração, com reservas virtuais e reais na conta `VirtualPool`. Curva RETRY de um segmento: preço inicial 3,125 × 10⁻⁹ SOL por token (FDV 3,125 SOL), preço final 5 × 10⁻⁸ (FDV 50 SOL), threshold de 10 SOL de reserva real. A tela mostra só reservas reais (o SOL e os tokens nos cofres), o progresso `quoteReserve / threshold` e o preço do `sqrtPrice` lido; reservas virtuais não aparecem como fundos. Medido (V): depois da primeira compra de 0,1 SOL, FDV 3,3134 SOL; compra de 0,5 SOL com impacto de 15,58%; curva completa com 10,000000001 SOL a 5 × 10⁻⁸ SOL por token. O impacto alto no início vem do FDV inicial pequeno e é decisão econômica do proprietário ([BONDING_CURVE_TRADING.md](../meteora-mvp/BONDING_CURVE_TRADING.md)).

## 15. Quotes

- Curva: `client.pool.swapQuote2` do SDK do DBC sobre `VirtualPool` + `PoolConfig` lidos no mesmo slot; compra `PartialFill` (a que completa a curva preenche até o threshold e devolve o resto), venda `ExactIn`.
- DAMM v2: `swapQuoteExactInput` do SDK do DAMM v2 (o mesmo cálculo de `CpAmm.getQuote2` para `ExactIn`) sobre a pool conferida por `validateDammPool`.
- Validações: quote de no máximo 30 s; antes de assinar, a pool é relida e a quote refeita; recusa se mudaram lado, valor ou slippage, se o novo mínimo for menor ("The price moved. Review the new quote first.") ou se a quote for da outra fonte ou de outra pool. Slippage de 0,1% a 10%, padrão 1%, gravado na instrução.

Medido (V): a compra recebeu exatamente a quantidade cotada e as vendas pelo menos o mínimo, na curva e no DAMM v2. Detalhes: [QUOTE_AND_SLIPPAGE.md](../meteora-mvp/QUOTE_AND_SLIPPAGE.md).

## 16. Compras

Fluxo: formulário da página do token → quote → "Buy" → `prepareTrade` (curva) ou `prepareDammTrade` (DAMM v2) → executor (seção 7). A tela reserva 0,01 SOL para rede e aluguel.

| Ambiente           | Compra                               | Resultado                                                            | Transação                                                                                                                                           |
| ------------------ | ------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devnet pública (D) | 0,5 SOL                              | −0,501488440 SOL; taxa 0,005 = 0,001 + 0,002 + 0,002; impacto 15,58% | [4dFMi1QJ…](https://explorer.solana.com/tx/4dFMi1QJuyTuvVJfBPJPS4PG9ufrpcLGkDGw9xcEuGahpDosesTAuQcyaeoFmxib6Vmjm2Fg6TRsuytRXFmRkCQF?cluster=devnet) |
| Validador (V)      | 0,5 SOL                              | −0,502039280 SOL (aluguel do validador)                              | `2vmYYqVr…` (validador efêmero do CI)                                                                                                               |
| Validador (V)      | completa a curva                     | −9,767824717 SOL; o programa usou só o necessário                    | `4UBuAb4r…`                                                                                                                                         |
| Validador (V)      | 0,2 SOL no DAMM v2                   | −0,200000000 SOL; taxa 0,002                                         | `5Xc9Ncix…`                                                                                                                                         |
| Navegador (VB)     | 0,1; 10,5 (completa); 0,2 no DAMM v2 | confirmadas pela tela                                                | assinaturas do validador do teste                                                                                                                   |

Execução [40972474049](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40972474049) (commit `6247354`) para os valores do validador; assinaturas completas em [DEVNET_E2E_RESULTS.md](../meteora-mvp/DEVNET_E2E_RESULTS.md).

## 17. Vendas

Mesmo fluxo, com conferência do saldo do token na carteira antes de montar ("venda acima do saldo" recusada sem envio).

| Ambiente           | Venda            | Resultado                                            | Transação                                                                                                                                           |
| ------------------ | ---------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devnet pública (D) | metade, na curva | +0,261505003 SOL                                     | [37r53BzU…](https://explorer.solana.com/tx/37r53BzUER16sRQK8nuj1jBL64PLbfktbZnk22NQWvviLP3ud6UNTqT8HpvypTxydMUS7z1yJj8q6zmUobVs6hLn?cluster=devnet) |
| Validador (V)      | metade, na curva | +0,261505003 SOL                                     | `5kLCNGRv…`                                                                                                                                         |
| Validador (V)      | no DAMM v2       | recebeu 1,661645052 SOL contra mínimo de 1,645033551 | `5CBn4aVn…`                                                                                                                                         |
| Navegador (VB)     | 50%, na curva    | confirmada pela tela                                 | —                                                                                                                                                   |

A venda no DAMM v2 pela tela não está no teste de navegador; está coberta em V pela mesma camada de negociação que a tela usa.

## 18. SOL/WSOL

Compra: o SOL vai para a conta WSOL da própria carteira, `SyncNative`, swap, e a conta é fechada de volta para a carteira na mesma transação. Venda: a saída chega em WSOL e é desembrulhada na mesma transação. A conta do token é criada na primeira compra e fica com o usuário (0,00148844 SOL de aluguel na Devnet e na Mainnet). WSOL antigo da carteira não é tocado além do necessário, e a tela avisa se existir. Medido (V): a compra no DAMM v2 de 0,2 SOL custou exatamente 0,2 SOL e 0,000005 de rede, com a conta WSOL temporária aberta e fechada; o saque de taxas de LP também fecha a sua.

## 19. Taxas e Distribuição

| Onde    | Total | Meteora | Criador                               | RETRY (fee claimer)                    |
| ------- | ----- | ------- | ------------------------------------- | -------------------------------------- |
| Curva   | 1%    | 0,2%    | 0,4% (`claim_creator_trading_fee`)    | 0,4% (`claim_trading_fee`, tesouraria) |
| DAMM v2 | 1%    | 0,2%    | ≈ 0,4% como dono de uma posição de LP | ≈ 0,4% como dono da outra posição      |

Na graduação a Meteora retém 0,2% da liquidez (10,000000001 SOL na curva viraram 9,98 SOL no DAMM v2). Sem taxa de criação, sem taxa de migração da RETRY, sem referral, sem priority fee da RETRY.

Medido: compra de 0,5 SOL com taxa de 0,005 dividida em 0,001 + 0,002 + 0,002 (V, D); saque do criador de 0,042527885 SOL no validador e 0,003456586 SOL na Devnet pública; no DAMM v2, 0,01903855 SOL de taxas em duas operações, 0,00380771 para a Meteora e 0,01523084 para as posições, das quais o criador sacou exatamente a metade (0,00761542 SOL) sem mexer na liquidez (V, VB). A parte RETRY é sacada fora do app, pela tesouraria. Detalhes: [FEES_AND_COSTS.md](../meteora-mvp/FEES_AND_COSTS.md).

## 20. Discover

`listRetryPools`: `getProgramAccounts` no programa DBC com filtro de memória pelo endereço da config RETRY; só aparecem pools dessa config. Cada pool é decodificada e validada (`validateRetryPool`: PDA canônica, config, quote mint WSOL e parâmetros revisados). Colunas: **New on RETRY** (últimas 24 horas), **Active**, **Near graduation** (80% ou mais, completa aguardando migração ou migração com atenção) e **Graduated** (preço e FDV na graduação, "Trades on DAMM v2"). Lançamentos que quebram as regras de nome são marcados. Custo por atualização (20 s): 1 `getProgramAccounts`, 1 config, 1 slot, metadados em lotes de 100 e 1 leitura por pool graduada.

Resultado: a listagem pela config passou no validador e na Devnet pública (V, D), e o card do token lançado aparece na coluna Graduated no navegador (VB). Limite: sem paginação nem indexador. Detalhes: [TOKEN_DISCOVERY.md](../meteora-mvp/TOKEN_DISCOVERY.md).

## 21. Token Detail

`/token/?cluster=…&mint=…`, terminal RETRY (`retry-terminal.tsx`): cabeçalho com nome, ticker, imagem, estado, cluster, mint e explorer; preço, FDV, SOL e tokens na pool, onde negocia e supply, com slot e horário da leitura; gráfico; atividade e contas; formulário de negociação (curva ou DAMM v2); painel de graduação com a prova do bloqueio; taxas de LP; taxas do criador; fatos do token (supply, autoridades, metadados, alocação do criador, taxa). Tudo vem da chain e dos metadados conferidos. Medido na tela ao final do teste do navegador (VB): preço 5,2 × 10⁻⁸ SOL, FDV 52 SOL, 10,179 SOL e 195,72 milhões de tokens na pool, "Trades on DAMM v2 · 1% fee".

## 22. Gráficos

Origem: velas montadas a partir do histórico decodificado dos eventos da Meteora (`EvtSwap2` do DBC e do `cp_amm`), com o preço depois de cada negociação; intervalos de 5 min, 15 min, 1 h e 1 dia sem nova consulta; alternância entre curva e DAMM v2. Nada é inferido de transferências de token: transação sem evento reconhecido é "Other" e transação falha é "Failed", nunca uma negociação, e não entra no gráfico.

Limitações: só as transações das páginas lidas (20 por pool por página, mais sob demanda), sem indexador; intervalos sem negociação são pulados, não preenchidos; preços são números de exibição. Medido (V): 17 transações decodificadas, de acordo com o que o fluxo executou, e velas das duas fontes.

## 23. Portfolio

Abas **SPL holdings** (saldo de SOL e de tokens RETRY), **Tokens created**, **LP positions** (posições de LP da carteira em pools RETRY graduadas, com o estado do bloqueio: "Permanently" ou "Partly") e **Activity** (o registro local das operações com estado). Saldos lidos do RPC a cada 15 s e posições de LP a cada 60 s. Medido (VB): a posição do criador aparece como "Permanently" e a atividade mostra o lançamento e a graduação confirmados.

## 24. Graduação

- **Threshold**: 10 SOL de reserva real. Estados calculados da chain: "Bonding curve active", "Near graduation" (≥ 80%), "Awaiting migration", "Migration in progress", "Graduated", "Migration needs attention".
- **Elegibilidade**: curva completa com `migrationProgress = 2`; `prepareMigration` recusa antes de montar se o token já graduou, se a config DAMM v2 não pertencer ao `cp_amm` ou se a pool authority do DBC estiver sem SOL (aluguel emprestado, achado da etapa 3).
- **Execução**: Devnet manual pela página do token ("Graduate to DAMM v2", permissionless, quem envia paga só rede e aluguel); Mainnet pelo keeper da Meteora (não testado).

Medido (V, duas variantes): migração confirmada, 0,032518200 SOL de custo total, continuidade de preço de 0% (5 × 10⁻⁸ SOL), segunda migração recusada pelo DBC com 6022 `NotPermitToDoThisAction`. Pela tela (VB): "Graduated. The DAMM v2 pool is live." **Não executado na Devnet pública.** Detalhes: [GRADUATION.md](../meteora-mvp/GRADUATION.md).

## 25. DAMM v2

A pool graduada é **derivada** (config de migração `Hv8L…`, mint e WSOL), nunca recebida de fora, e conferida por `validateDammPool`: dono `cp_amm`, endereço da pool graduada do lançamento, par token/SOL e cofres de SPL Token. Uma pool desativada não cota. Medido (V): taxa 1% com 20% para o protocolo, coleta em SOL, liquidez 823.314.404.508.605.138.322.788.080.705.105 com 823.314.404.508.605.138.322.788.080.705.104 travada permanentemente. O SDK do DAMM v2 carrega só quando a página precisa (189.551 bytes, 41.173 gzip). Detalhes: [DAMM_V2_TRADING.md](../meteora-mvp/DAMM_V2_TRADING.md).

## 26. Liquidity Lock

Configuração: 50% + 50% das posições, ambas `permanentLockedLiquidityPercentage = 100`, sem vesting, sem liquidez livre. Na migração o DBC chama `permanent_lock_position` do `cp_amm` em cada posição e passa as NFTs ao fee claimer e ao criador.

Evidência (V, duas variantes, e na tela em VB): `checkLock` lê as posições da pool e exige vesting 0, no máximo 1 unidade destravada (arredondamento do DBC) e soma travada igual a `permanentLockLiquidity` da pool. Posições medidas: 411.657.202.295.550.785.824.274.880.615.505 (1 destravada) e 411.657.202.213.054.352.498.513.200.089.599 (0), 100% travado. Cinco retiradas enviadas sem preflight foram recusadas on-chain pelo `cp_amm`: o criador retirando a liquidez travada (6023) ou mais que a sobra (6023), um estranho retirando da posição RETRY (6053) ou de tudo da posição do criador (6053), e o criador fechando a posição (6039); um estranho sacando as taxas do criador (6053). O saque legítimo de taxas não mudou a liquidez travada.

Limites conhecidos: a prova identifica as duas posições graduadas pelo tamanho do bloqueio; as NFTs são transferíveis (quem as recebe coleta as taxas, nunca a liquidez); a prova confia no RPC lido; o programa da Meteora é atualizável. **Não verificado na Devnet pública.** Detalhes: [LIQUIDITY_LOCKING.md](../meteora-mvp/LIQUIDITY_LOCKING.md).

## 27. Trading Pós-Graduação

Mesma página, mesmo formulário: depois da graduação ele cota e negocia na pool DAMM v2 do lançamento ("Graduated: trades go to this token's Meteora DAMM v2 pool"), com as mesmas regras de validade, recotação e slippage; quotes da curva não executam no DAMM v2 e vice-versa. Resultado (V): compra de 0,2 SOL, venda com recebimento acima do mínimo, quote velha, piorada, da curva ou de outra pool recusadas antes de montar, mínimo impossível recusado pelo `cp_amm` (6002), saque de taxas de LP pelo dono e recusa para um estranho. Pela tela (VB): compra no DAMM v2 e saque de taxas de LP. Histórico e saldos atualizam pelas mesmas queries. **Não executado na Devnet pública.**

## 28. Anti-spam

Implementado: regras de nome da RETRY (no máximo dois lançamentos por nome e dois por ticker no cluster; o mesmo criador não repete nome e ticker), conferidas na tela de criação e marcadas no Discover para lançamentos feitos por fora; id de lançamento contra envio duplicado; envio de metadados só com Cloudflare Access e limite de 10 por minuto por identidade; tamanhos e tipos de arquivo limitados; primeira compra de no máximo 1 SOL.

Pendente ou fora do alcance: unicidade global de ticker (impossível on-chain: qualquer um chama o DBC com a config RETRY diretamente, e o resultado aparece marcado), moderação automática de conteúdo, taxa anti-spam de criação (a config cobra 0), limite por carteira on-chain (o DBC não oferece).

## 29. Segurança

Ameaças consideradas e controles ([SECURITY_MODEL.md](../meteora-mvp/SECURITY_MODEL.md)):

| Ameaça                                                          | Controle                                                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transação adulterada pelo app, por dependência ou pela carteira | allowlist de instruções e contas; `validateSigned` (só Compute Budget e Lighthouse podem ser acrescentados); `verifySignatures`                     |
| Conta trocada durante a assinatura                              | assinatura de outra conta recusada antes do envio; nada registrado                                                                                  |
| RPC de outra rede                                               | `assertCluster` pelo genesis antes de montar                                                                                                        |
| Config, fee claimer, pool ou mint falsos                        | 21 campos e curva conferidos; fee claimer registrado; PDA canônica; pool DAMM v2 derivada                                                           |
| Preço movido                                                    | recotação antes de assinar e mínimo na instrução                                                                                                    |
| Reenvio de transação já confirmada                              | confirmação reenviando os mesmos bytes; reconciliação sem reenvio; `skipPreflight` só nesse reenvio e no helper de teste                            |
| Mainnet acionada por engano                                     | constante, recursos desligados, sem config e sem aprovação; conferido na interface e na biblioteca; teste de aprovação                              |
| Metadados maliciosos                                            | hosts confiáveis, hash conferido, limites, nada vira HTML                                                                                           |
| Chaves                                                          | nenhuma chave no bundle; keypairs de mint e NFTs gerados no navegador, usados uma vez e não gravados; nenhuma carteira da RETRY assina por usuários |

Riscos residuais: sem revisão independente; 10 alertas de dependências; programas da Meteora atualizáveis; RPC público; MEV dentro do slippage; regras de nome contornáveis por fora; limites da prova do bloqueio; Worker não implantado; carteiras reais não testadas. **O código não foi auditado.**

## 30. Testes Unitários

`pnpm test` (Vitest): **185 testes em 18 arquivos, todos aprovados** (local e no job "validate" do CI). Principais: `meteora.test.ts` 33 (allowlist, assinatura, executor, cluster, quotes, metadados), `meteora-damm.test.ts` 25 (IDL do `cp_amm`, pool falsa, mint falso, quotes, prova do bloqueio), `solana-config.test.ts` 17 (recursos por rede, Mainnet travada), `metadata-worker.test.ts` 16, `mainnet-approval.test.ts` 4, `meteora-naming.test.ts` 2. Novos nesta etapa: o executor grava antes de enviar e recusa a assinatura de outra conta; erro de preflight nomeado pelo programa certo; nada é montado com RPC de outro cluster; pool, mint e config falsos recusados.

## 31. Testes de Integração

`tests/integration/solana-wallet.test.tsx` (17, dentro dos 185): componentes React com Wallet Standard e RPC simulados (conexão, troca de conta, desconexão, endereço que não corresponde à chave, cluster). Os testes on-chain (seção 33) são a integração real com os programas.

## 32. Testes Browser

- **Simulado** (`pnpm test:e2e`, `e2e/solana-app.spec.ts`): 26 testes, 13 em desktop e 13 em mobile emulado (Pixel 7), RPC e carteiras simulados, incluindo Mainnet travada e lançamento sem host de metadados. Aprovados no job "Browser tests" (B).
- **Contra o validador** (`pnpm test:chain:browser`, `e2e/chain/meteora-browser.spec.ts`): o export real do app no Chromium, com uma carteira de teste Wallet Standard e o Worker no processo do teste. Lança, compra, vende, completa a curva, gradua, confere a prova do bloqueio, compra no DAMM v2, saca taxas de LP, abre o portfolio e o Discover; exatamente sete assinaturas e nenhum erro de console. Aprovado nas duas variantes do CI (33,1 s e 40,3 s) e localmente (18,5 s) (VB).

Limitações: nenhuma extensão real; o Worker não é o implantado; a venda no DAMM v2 pela tela não está coberta.

## 33. Testes Locais

`tests/chain/meteora-flow.chain.ts` (21 testes) e o teste do navegador contra um `solana-test-validator` (Agave 3.1.10):

- **No CI**: programas, config DAMM v2 de migração e pool authority clonados da Devnet ou da Mainnet; na variante de Devnet, também a config RETRY registrada. Aprovado nas duas variantes ([execução 40972474049](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40972474049)).
- **No container** (sem acesso à rede Solana): binários das fixtures do repositório do SDK do DBC (commit `3a965ec`, 22/10/2026), que não são os da Devnet nem os da Mainnet (hashes em [DEVNET_E2E_RESULTS.md](../meteora-mvp/DEVNET_E2E_RESULTS.md#validador-no-container-fixtures-do-sdk)); config DAMM v2 carregada dos bytes da Mainnet que o CI imprime e pool authority criada com 50 SOL. Resultado: 21 de 21 (repetido) e o navegador 1 de 1.

O fluxo grava endereços, assinaturas e valores em JSON (`RETRY_CHAIN_EVIDENCE`) e o CI os publica em anotações. Os valores em SOL foram os mesmos nas duas variantes; as compute units variam.

## 34. Testes Devnet

Na Devnet pública, com a carteira de teste descartável `3r8gEonYHrXEao85oFAu2UzVgT1KsxFmWUZLWBd8G5B3` do PR #8 (procedimento local do proprietário; a chave nunca foi ao repositório nem ao navegador):

| Tentativa | Código    | Resultado                                                                                    |
| --------- | --------- | -------------------------------------------------------------------------------------------- |
| 1         | `e83cf8b` | falhou no RPC público (HTTP 429 em `getAccountInfo`): 5 aprovados, 3 falhas, 2 pulados       |
| 2         | `4233212` | **8 aprovados, 0 falhas, 2 pulados** (completar a curva e migrar, não autorizados), 120,71 s |

Transações confirmadas (`finalized` na conferência de 29/10 19:37 UTC):

| Passo                                  | Transação                                                                                                                                           | Slot      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Config RETRY                           | [5rKrTaNc…](https://explorer.solana.com/tx/5rKrTaNcbnwmysG9VpHRyeQ9zrbkY6cU2UUYckcNeKvv1TcnGWvvqovf19B2jR1F76G2VgastRkkbbNSrnXeasPK?cluster=devnet) | 516519451 |
| Criação com primeira compra de 0,1 SOL | [3nh1iy8t…](https://explorer.solana.com/tx/3nh1iy8tmTqZRDTdtBvKFTUUC4hPCLXXBrVB4QXhB9hJqJFANisp2ZDKDqAHq4h8ENsUQo9vqj8DBo9cVEWSaMr1?cluster=devnet) | 516520928 |
| Compra de 0,5 SOL                      | [4dFMi1QJ…](https://explorer.solana.com/tx/4dFMi1QJuyTuvVJfBPJPS4PG9ufrpcLGkDGw9xcEuGahpDosesTAuQcyaeoFmxib6Vmjm2Fg6TRsuytRXFmRkCQF?cluster=devnet) | 516521010 |
| Venda de metade                        | [37r53BzU…](https://explorer.solana.com/tx/37r53BzUER16sRQK8nuj1jBL64PLbfktbZnk22NQWvviLP3ud6UNTqT8HpvypTxydMUS7z1yJj8q6zmUobVs6hLn?cluster=devnet) | 516521097 |
| Saque do criador                       | [3BcbUyn3…](https://explorer.solana.com/tx/3BcbUyn3GaZv7TUgKZcV6cHzDBTnVJZ3BcYvDt22wyddhQaeKoJAjFTh4oXxSPVmCA3E9BHY1WB8DkaoCCAjWwiT?cluster=devnet) | 516521237 |

Mint `6WwkimyJfjEbeh7wSXYRZ6e26pmEyPLWwTUt9fTY1nUz`, pool `2Lu2YaaHJLibHxzYG45b2y8YTyXhyGS2xqb23fZJhRpd`. Consumo das duas tentativas: 0,486351091 SOL de teste; saldo final 2,013648909. Nesta etapa, um teste do fluxo passou a marcar como **pulados** (e não aprovados) os passos depois da graduação quando nada graduou (`cf649fc`). Evidências: [docs/devnet/evidence/](../devnet/evidence/) e [DEVNET_E2E_RESULTS.md](../meteora-mvp/DEVNET_E2E_RESULTS.md).

## 35. Testes de Carteiras

- **Reais: pendentes.** Nenhuma extensão real foi usada nesta etapa; não há carteira exclusiva de testes do proprietário para isso, e a carteira pessoal não deve ser usada. Roteiro manual, agora com graduação, DAMM v2 e taxas de LP, em [OPERATIONAL_RUNBOOK.md](../meteora-mvp/OPERATIONAL_RUNBOOK.md).
- **Simuladas**: Phantom, Solflare e Backpack simuladas pelo Wallet Standard em desktop e mobile (B), integração do provider (I), carteira de teste que assina no navegador contra o validador (VB), e carteiras que devolvem lixo, alteram a transação ou assinam com outra conta (U).

## 36. Problemas Encontrados

| Problema                                                                          | Causa                                                                                     | Solução                                                                                                    |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| O SDK do DAMM v2 traz um kit de interface EVM                                     | `@meteora-ag/cp-amm-sdk` 1.5.1 declara `chain` (wagmi, ethers, React 18) e não o usa      | override do pnpm removendo o pacote                                                                        |
| Instruções do DBC e do `cp_amm` com o mesmo discriminador                         | os dois programas usam os mesmos nomes Anchor (`swap`, `swap2`)                           | allowlist e histórico conferem o programa antes do discriminador                                           |
| Uma negociação contada duas vezes no histórico                                    | o `swap2` do DBC emite `EvtSwap` e `EvtSwap2`                                             | uma negociação por instrução de swap                                                                       |
| Mensagem de erro do programa errado                                               | DBC e DAMM v2 repetem números (6002 etc.) e a recusa no preflight do RPC chegava sem logs | a mensagem vem do nome que o programa escreve no log, e o executor guarda os logs do preflight (`5f04bfd`) |
| Passos depois da graduação contados como aprovados quando nada graduou            | o teste retornava cedo                                                                    | marcados como pulados (`cf649fc`)                                                                          |
| Custos do validador maiores que os da Devnet                                      | o validador usa a tabela de aluguel padrão (6.960 lamports por byte), os clusters 5.080   | o CI registra o aluguel de cada cluster (`6247354`) e os documentos separam medido e estimado              |
| O workflow on-chain não rodava em mudanças do Discover, do portfolio ou dos hooks | filtro de caminhos só com arquivos Meteora                                                | roda para qualquer mudança em `src/` (`7895993`)                                                           |
| Rodar o teste do navegador de novo no mesmo validador falhava                     | a regra de nome bloqueia o terceiro "Browser Cat" (é a regra funcionando)                 | o teste procura o card pelo mint; o runbook manda reiniciar o validador                                    |
| O container não alcança a Devnet nem a Mainnet                                    | rede da sessão                                                                            | fixtures do SDK no container; os binários reais rodam no CI                                                |
| Conflito com o PR #8 em `pnpm-workspace.yaml` e no workflow                       | os dois PRs mudaram os mesmos blocos                                                      | merge mantendo os dois lados e conferindo o lockfile                                                       |
| Primeira tentativa na Devnet pública falhou (PR #8)                               | limite do RPC público (HTTP 429)                                                          | nova tentativa aprovada; RPC dedicado recomendado                                                          |

## 37. Infraestrutura

- **RPC**: público do cluster por padrão (`NEXT_PUBLIC_SOLANA_RPC_URL` para trocar). Para a Mainnet, RPC pago que aceite `getProgramAccounts` com filtro.
- **Hospedagem**: GitHub Pages, site estático, sem servidor. Só a `main` publica; este PR não muda o site público.
- **Armazenamento**: Worker de metadados na Cloudflare (KV, conteúdo por SHA-256, Access), **não implantado**; o registro das operações fica no navegador.
- **Custos**: R$ 0 hoje; Worker e KV no plano gratuito dentro das cotas; Mainnet com custo de RPC a definir e aluguel da config (≈ 0,006 SOL, estimativa).
- **Devnet**: carteira de teste no environment protegido `retry-devnet` (PR #8).

## 38. GitHub Actions

| Workflow                                           | Jobs                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RETRY quality checks (`ci.yml`)                    | "validate": format, lint, typecheck, testes unitários, build e export do Pages (sem publicar); "Browser tests": e2e simulado desktop e mobile                                                                                                                                                                                                          |
| RETRY Meteora on-chain tests (`meteora-chain.yml`) | "Pinned programs" (só leitura: programas, autoridades, config de migração, pool authority, aluguel); validador com os programas da Devnet e da Mainnet (fluxo on-chain e navegador, evidências em anotações e artefatos); "Solana Devnet (test wallet)", manual, com environment protegido, SHA revisado e orçamento, disponível só na branch do PR #8 |

Mudanças nesta etapa: o teste do navegador cobre a graduação e o DAMM v2; o job de leitura registra o aluguel de cada cluster; o resumo inclui a segunda migração recusada; o workflow on-chain roda para qualquer mudança no app. O dispatch do job de Devnet não está disponível enquanto o workflow não estiver na `main`. CI do head deste relatório: seção 42.

## 39. Arquivos Criados

| Arquivo                                                           | Descrição                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/meteora/damm-sdk.ts`                                     | ponto único de importação do SDK do DAMM v2                                  |
| `src/lib/meteora/damm-layout.ts`                                  | layouts do `cp_amm` para allowlist e histórico, conferidos contra a IDL      |
| `src/lib/meteora/damm-v2.ts`                                      | pool graduada, quotes, negociação, prova do bloqueio, taxas e posições de LP |
| `src/lib/meteora/history.ts`                                      | histórico decodificado dos eventos e velas                                   |
| `src/lib/meteora/naming.ts`                                       | regras de nome e marcações do Discover                                       |
| `src/lib/meteora/mainnet-approval.ts`                             | parâmetros da Mainnet e folha de aprovação com hash                          |
| `src/components/launch/damm-panels.tsx`                           | negociação e taxas de LP no DAMM v2                                          |
| `src/components/launch/launch-history.tsx`                        | gráfico e tabela de atividade do lançamento                                  |
| `tests/meteora-damm.test.ts`                                      | testes do DAMM v2, da prova do bloqueio e de pools e mints falsos            |
| `tests/meteora-naming.test.ts`                                    | regras de nome                                                               |
| `tests/mainnet-approval.test.ts`                                  | folha de aprovação e trava da Mainnet                                        |
| `tests/chain/verify-programs.mjs`                                 | leitura dos programas, autoridades, contas e aluguel nos dois clusters       |
| `docs/meteora-mvp/*.md` (19 arquivos, mais `MAINNET_APPROVAL.md`) | documentação da seção 43 ([índice](../meteora-mvp/README.md))                |
| `docs/meteora/README.md`                                          | mapa dos nomes antigos                                                       |
| este relatório                                                    | —                                                                            |

## 40. Arquivos Modificados

| Arquivo                                                                                                                                                                      | Mudança                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/config/retry-protocol.ts`                                                                                                                                               | recursos separados por rede, aprovação da Mainnet, parada de emergência                                       |
| `src/lib/meteora/client.ts`                                                                                                                                                  | fee claimer no contexto, `assertWritable` por recurso                                                         |
| `src/lib/meteora/transactions.ts`                                                                                                                                            | allowlist do DAMM v2, logs do preflight                                                                       |
| `src/lib/meteora/create-token.ts`, `curve.ts`, `pools.ts`, `quotes.ts`, `trade.ts`, `graduation.ts`, `fees.ts`, `errors.ts`, `programs.ts`                                   | fee claimer, coluna do Discover, fonte da quote, continuidade de preço, mensagens por programa, contas fixas  |
| `src/hooks/use-retry.ts`                                                                                                                                                     | hooks do DAMM v2, histórico, posições de LP, prova do bloqueio, executor por recurso                          |
| `src/components/launch/*.tsx`, `discover/discover.tsx`, `portfolio/solana-portfolio.tsx`, `market/candle-chart.tsx`, `src/lib/market/chart-series.ts`, `src/app/globals.css` | página do token depois da graduação, graduação com prova, colunas do Discover, posições de LP, gráfico em SOL |
| `tests/meteora.test.ts`, `tests/solana-config.test.ts`                                                                                                                       | testes adversariais e de recursos                                                                             |
| `tests/chain/meteora-flow.chain.ts`, `harness.ts`, `summarize-evidence.mjs`                                                                                                  | DAMM v2, negativos do bloqueio, segunda migração, histórico, passos pulados                                   |
| `e2e/chain/meteora-browser.spec.ts`                                                                                                                                          | graduação, DAMM v2 e taxas de LP pela tela; sete assinaturas                                                  |
| `.github/workflows/meteora-chain.yml`                                                                                                                                        | job de leitura, nomes, gatilhos                                                                               |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.prettierignore`                                                                                                   | SDK do DAMM v2 e override                                                                                     |
| `docs/meteora/*.md` → `docs/meteora-mvp/`                                                                                                                                    | movidos e atualizados                                                                                         |
| `docs/reports/RETRY_METEORA_MVP_IMPLEMENTATION_REPORT.md`                                                                                                                    | links para os novos caminhos                                                                                  |

Ao todo, 76 arquivos em relação ao head do PR #8 (`a3a34bb`), contando este relatório.

## 41. Commits

| Commit    | Mudança                                                               |
| --------- | --------------------------------------------------------------------- |
| `b14b2ac` | SDK oficial do DAMM v2 e leitura dos programas fixados                |
| `279e2d5` | merge da correção do teste on-chain do PR #8 (`0c70480`)              |
| `04c4138` | negociar pools graduadas no DAMM v2 e verificar o bloqueio            |
| `0223e6c` | histórico do lançamento a partir dos eventos da Meteora               |
| `c508709` | testes on-chain do DAMM v2, negativos do bloqueio e histórico         |
| `614d57c` | recursos por rede, prova do bloqueio e posições de LP na biblioteca   |
| `36699b5` | negociar tokens graduados no DAMM v2 pela página do token             |
| `334739d` | colunas do Discover por estado e posições de LP no portfolio          |
| `b62601b` | folha de aprovação da Mainnet gerada do código                        |
| `e75f35a` | regras de nome no Create e marcação no Discover                       |
| `dd56cfb` | documentos movidos para `docs/meteora-mvp`                            |
| `a776872` | o executor grava antes de enviar e recusa a assinatura de outra conta |
| `768181e` | merge do desbloqueio da Devnet do PR #8 (`a3a34bb`)                   |
| `cf649fc` | passos depois da graduação marcados como pulados quando nada graduou  |
| `5f04bfd` | erro do programa certo quando o preflight recusa o envio              |
| `8a6bf04` | nada é montado com RPC de outro cluster                               |
| `c8f8a71` | pools e mints falsos e segunda migração recusados                     |
| `96ff79c` | graduação, DAMM v2 e taxas de LP pelo navegador                       |
| `6247354` | aluguel de cada cluster e segunda migração nas anotações do CI        |
| `585ab85` | documentação completa das etapas 4 a 6                                |
| `7895993` | workflow on-chain para qualquer mudança no app                        |

O commit deste relatório vem depois desses.

## 42. Pull Request

[Draft PR #9](https://github.com/ArthurBudagMatsuda/launchpadlendaria/pull/9), aberto, base `feat/retry-meteora-dbc-mvp` (PR #8), sem merge. CI verde em `7895993`, o último commit de código antes deste relatório: "RETRY Meteora on-chain tests" [40974575982](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40974575982) (leitura dos programas e as duas variantes do validador, com o fluxo e o navegador) e "RETRY quality checks" nos eventos de push e de PR. Os valores citados neste relatório vêm da execução [40972474049](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/40972474049) (`6247354`), a primeira com as linhas de aluguel; a de `7895993` repetiu os mesmos valores em SOL e os mesmos erros. Ordem de merge: #6, #8, #9; nenhum deles foi mesclado.

## 43. Funcionalidades Completas

| Funcionalidade                                         | Evidência                                  |
| ------------------------------------------------------ | ------------------------------------------ |
| Integração dos SDKs oficiais (DBC e DAMM v2)           | U, V                                       |
| Config RETRY verificável                               | U, V; registrada e conferida na Devnet (D) |
| Criação de token e pool com primeira compra            | V, VB, D                                   |
| Compra e venda na curva com quotes do SDK              | V, VB, D                                   |
| Slippage garantido pelo programa                       | V (DBC e DAMM v2), D (DBC)                 |
| Taxas e divisão verificáveis                           | U, V, D                                    |
| Discover com lançamentos reais da config               | V, VB, D                                   |
| Página do token com dados on-chain                     | VB                                         |
| Portfolio com saldos e posições de LP reais            | VB                                         |
| Graduação para o DAMM v2 com segunda migração recusada | V, VB                                      |
| Prova on-chain do bloqueio e retiradas recusadas       | V, VB                                      |
| Negociação depois da graduação na mesma página         | V (compra e venda), VB (compra)            |
| Saque de taxas do criador e de LP                      | V, VB (LP), D (criador)                    |
| Mainnet travada em mais de uma camada                  | U, B                                       |

## 44. Funcionalidades Parciais

- **Lançamento pela tela em qualquer rede**: depende do Worker implantado.
- **Graduação, DAMM v2 e prova do bloqueio**: só no validador; falta a Devnet pública.
- **Venda no DAMM v2 pela tela**: coberta em V, não em VB.
- **Discover e gráficos**: sem paginação nem indexador; histórico limitado às páginas lidas.
- **Anti-spam**: regras da plataforma, não on-chain; sem moderação automática.
- **Carteiras**: só simuladas e de teste.
- **Custos na Mainnet**: estimativas, não medições.

## 45. Bloqueios

| Bloqueio                              | Depende de                                                        |
| ------------------------------------- | ----------------------------------------------------------------- |
| Worker de metadados                   | conta Cloudflare do proprietário, Access configurado, autorização |
| Graduação na Devnet pública           | autorização explícita e até 12 SOL de teste na carteira do PR #8  |
| Dispatch do job de Devnet pelo GitHub | workflow na `main` (não fazer merge para contornar)               |
| Testes com carteiras reais            | carteira de teste do proprietário e alguém operando a extensão    |
| Tesouraria (fee claimer da Mainnet)   | decisão do proprietário, de preferência multisig                  |
| Revisão de segurança e jurídica       | revisores independentes                                           |
| Este container                        | sem acesso à rede Solana: on-chain real só pelo CI                |

## 46. Segurança de Produção

Pendências antes de qualquer operação na Mainnet (as 27 verificações estão em [MAINNET_RELEASE_CHECKLIST.md](../meteora-mvp/MAINNET_RELEASE_CHECKLIST.md)): aprovação dos parâmetros pelo hash da folha; tesouraria como fee claimer; config da Mainnet criada pela tesouraria e conferida; Worker implantado com Access; RPC de produção; carteiras reais; graduação e DAMM v2 na Devnet pública; confirmação com a Meteora sobre o keeper; monitoramento e responsáveis por incidentes; tratamento dos alertas de dependências; revisão independente de segurança; revisão jurídica; autorização específica do proprietário. Até lá, `MAINNET_EXECUTION_ENABLED = false` e nenhum recurso da Mainnet assina nada.

## 47. Próximas Etapas

1. Revisar e fazer o merge na ordem #6, #8, #9 (decisão do proprietário).
2. Implantar o Worker de metadados na conta Cloudflare do proprietário e definir `NEXT_PUBLIC_RETRY_METADATA_URL` ([guia](../cloudflare/RETRY_METADATA_WORKER_SETUP.md)).
3. Autorizar a graduação na Devnet pública com até 12 SOL de teste e rodar o fluxo completo com a carteira do PR #8.
4. Testar Phantom, Solflare e Backpack na Devnet com o roteiro do runbook.
5. Decidir a economia (FDV inicial, curva) e aprovar a folha pelo hash.
6. Criar a tesouraria multisig e decidir quem opera a NFT da posição RETRY.
7. Tratar os alertas de dependências e contratar a revisão independente de segurança.
8. Escolher o RPC de produção e o monitoramento; planejar um indexador quando houver muitos lançamentos.

## 48. Conclusão

A RETRY deixou de ser uma interface demonstrativa: no ambiente de testes, um usuário cria um token pela RETRY, negocia na bonding curve da Meteora, acompanha e executa a graduação, vê o bloqueio da liquidez provado on-chain e continua negociando o mesmo token no DAMM v2, sem programa próprio, sem custódia e sem chave no navegador.

| Critério da seção 46                | Estado                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Meteora SDK                         | integrado (DBC e DAMM v2)                                                                                        |
| RETRY Config                        | válida e verificável; registrada na Devnet                                                                       |
| Create Token                        | mint e pool criados no validador, pela tela e na Devnet pública                                                  |
| Metadata                            | URI imutável e conferida; persistência dependente do Worker, que não está implantado                             |
| Bonding Curve                       | pool consultável (V, VB, D)                                                                                      |
| Buy / Sell                          | confirmados no validador, pela tela e na Devnet pública                                                          |
| Fees                                | valores verificados on-chain                                                                                     |
| Quotes                              | do SDK sobre o estado lido                                                                                       |
| Discover / Token Detail / Portfolio | dados reais                                                                                                      |
| Graduation                          | migração efetivamente testada no validador com os binários das duas redes; Devnet pública pendente e documentada |
| DAMM v2                             | pool de destino derivada, lida e conferida                                                                       |
| Liquidity Lock                      | configuração e posições verificadas on-chain, retiradas recusadas pelo programa                                  |
| Trading após graduação              | funcional no validador e pela tela                                                                               |
| Segurança                           | nenhuma operação na Mainnet                                                                                      |
| Testes                              | resultados reais registrados com nível de evidência                                                              |
| GitHub                              | branch, Draft PR e relatório publicados                                                                          |

O MVP **não está pronto para produção** e não foi auditado. Os bloqueios que restam são externos ao código (Worker, carteiras reais, autorização de graduação na Devnet, tesouraria, revisões e autorização do proprietário) e estão listados com o caminho para resolver cada um.
