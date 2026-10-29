# Fluxo de criação de token

Telas: Create, etapas 1 e 2 (dados e imagem, do PR #6) e etapa 3 (`src/components/launch/launch-panel.tsx`). Código: `src/lib/meteora/create-token.ts`, `naming.ts`, `metadata-upload.ts`, `transactions.ts`.

## Passo a passo

1. **Dados**: nome (2–32 bytes), ticker (2–10 letras maiúsculas ou números), descrição, imagem PNG/JPEG/WebP de até 2 MB, links opcionais (site, X, Telegram), validados por `src/lib/validation.ts`.
2. **Regras de nome da RETRY** (`naming.ts`): no máximo dois lançamentos RETRY por nome e dois por ticker no mesmo cluster, e o mesmo criador não repete nome e ticker. Nomes comparam sem diferenciar maiúsculas e com espaços normalizados. Acima do limite a tela recusa ("2 RETRY launches already use this name, the most RETRY allows (2). Pick another name."). São regras da plataforma, não garantias on-chain: nomes e tickers SPL não são únicos na Solana e qualquer um pode chamar o DBC com a config RETRY diretamente; por isso o Discover marca um lançamento feito fora das regras e um token é sempre identificado pelo mint. Ver [TOKEN_DISCOVERY.md](TOKEN_DISCOVERY.md).
3. **Condições do lançamento** (etapa 3): a tela mostra supply fixo de 1 bilhão, 9 decimals, sem autoridade de mint/freeze, metadados imutáveis, taxa de 1% e divisão, threshold de 10 SOL e liquidez 100% travada na graduação.
4. **Primeira compra opcional**: de 0 a 1 SOL (`MAX_INITIAL_BUY_LAMPORTS`). Ela entra **na mesma transação** da criação, então ninguém compra antes do criador e o criador não recebe nada além do que comprou. Pela curva RETRY, 0,1 SOL compra 3,08% do supply, 0,5 SOL 13,79% e 1 SOL 24,43%; a revisão mostra a porcentagem antes de assinar.
5. **"Review launch cost"**:
   - envia os metadados para o host RETRY (uma vez por rascunho; o resultado fica em cache) e confere o que voltou;
   - calcula o id da requisição (`launchRequestId`: SHA-256 de carteira, nome, ticker e URI) e recusa se já existe um lançamento pendente ou confirmado com o mesmo id;
   - monta a transação (`prepareCreateToken`) e simula. Antes de montar, a biblioteca confere o recurso `create`, o cluster pelo genesis, os 21 campos e a curva da config on-chain (`configMismatches`), o quote mint e o **fee claimer**: ele precisa ser o registrado em `RETRY_DBC_CONFIGS`, porque recebe a parte RETRY das taxas e uma das duas posições de LP travadas. Qualquer diferença: "The on-chain RETRY config does not match this app.";
   - mostra o custo simulado: primeira compra (com tokens recebidos e % do supply), aluguel e taxas de programa, taxa de rede e total.
6. **"Sign & launch"**: válido por 45 segundos depois da revisão. A revisão fica presa aos dados revisados; se algo mudar, é preciso revisar de novo.
7. **Envio e confirmação**: a assinatura é registrada no navegador antes do envio. Depois da confirmação, aparece "Launched." com link para o explorer e "Open your token".

## O que a transação contém

`client.creator.createPoolWithFirstBuy` do SDK, verificada por `validateTransaction`:

- Instruções DBC permitidas: `initialize_virtual_pool_with_spl_token` e `swap`/`swap2` (primeira compra).
- Contas fixadas: `config` = config RETRY, `pool` = PDA derivada de (WSOL, mint, config), `base_mint` = mint novo, `quote_mint` = WSOL, `creator` e `payer` = carteira conectada.
- Além disso, só: transferência de SOL da carteira para a própria conta WSOL, `SyncNative`, `CloseAccount` da própria WSOL de volta para a carteira, criação das ATAs da carteira para o mint e para WSOL, e limite de compute units. Qualquer outra instrução, programa, signatário ou pagador é recusado.
- Signatários: a carteira e o keypair do mint, gerado no navegador só para esta transação. A chave do mint não tem poder depois: o DBC remove a autoridade de mint.

Depois da assinatura, `validateSigned` confere que a carteira não trocou pagador, blockhash ou instruções (pode apenas acrescentar compute budget ou instruções Lighthouse, que algumas carteiras inserem), e `verifySignatures` confere todas as assinaturas antes do envio.

## Metadados

O JSON e a imagem vão para o **Worker RETRY** (`infra/metadata-worker/`, Cloudflare Workers + KV), configurado por `NEXT_PUBLIC_RETRY_METADATA_URL`. O envio exige uma sessão do Cloudflare Access (o Worker confere o JWT) e é limitado a 10 envios por minuto por identidade. O conteúdo fica endereçado pelo SHA-256 e o app relê o JSON gravado, confere o hash e os campos, e só então usa a URI on-chain. Detalhes em [METADATA_AND_STORAGE.md](METADATA_AND_STORAGE.md).

Sem `NEXT_PUBLIC_RETRY_METADATA_URL`, o botão de lançar fica desabilitado com explicação. **Situação atual: o Worker não foi implantado** (precisa da conta Cloudflare do proprietário). Os testes on-chain usam um JSON de teste versionado no repositório (`docs/meteora/devnet-metadata/retry-devnet-test.json`), servido pelo `raw.githubusercontent.com` e aceito apenas para caminhos deste repositório; o teste no navegador roda o Worker no próprio processo.

## Recuperação e duplicatas

- Cada operação é gravada em `localStorage` (`retry:solana:operations:v1`, só dados públicos) com assinatura, `lastValidBlockHeight` e status, **antes** do envio.
- Ao recarregar, a reconciliação consulta `getSignatureStatuses`: confirmada, falhou, expirou (blockhash vencido sem registro) ou continua pendente. Nada é reenviado automaticamente.
- Um lançamento pendente com o mesmo id bloqueia um segundo envio. Se a transação expirou, é seguro tentar de novo, porque um mint novo é gerado.
- O mint e a pool ficam no registro, então "Open your token" funciona mesmo depois de recarregar.

## Custos

Primeira compra de 0,1 SOL, com a taxa de rede (2 assinaturas): **0,12208008 SOL medidos na Devnet pública** e 0,12654696 SOL no validador, cuja tabela de aluguel é mais cara. São 0,1 SOL de compra, 0,01 SOL do programa Metaplex na conta de metadados, o aluguel de seis contas novas e 0,00001 de rede. Para a Mainnet, a estimativa é a mesma da Devnet pública (mesmo aluguel). Detalhes em [FEES_AND_COSTS.md](FEES_AND_COSTS.md).

## Verificações on-chain

`tests/chain/meteora-flow.chain.ts`, depois da criação: autoridade de mint e de freeze nulas, 9 decimals, supply exatamente 10¹⁸ unidades, metadados com nome/ticker/URI corretos e `isMutable = false`, update authority = System Program, criador com exatamente a saída da primeira compra, e cofre da pool com todo o resto do supply. O mesmo fluxo rodou na Devnet pública (smoke do PR #8) e o lançamento pela tela roda no navegador contra o validador (`e2e/chain/meteora-browser.spec.ts`). Resultados em [DEVNET_E2E_RESULTS.md](DEVNET_E2E_RESULTS.md).
