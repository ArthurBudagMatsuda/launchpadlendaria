# Fluxo de criação de token

Telas: Create, etapas 1 e 2 (dados e imagem, do PR #6) e etapa 3 (`src/components/launch/launch-panel.tsx`). Código: `src/lib/meteora/create-token.ts`, `metadata-upload.ts`, `transactions.ts`.

## Passo a passo

1. **Dados**: nome (2–32 bytes), ticker (2–10 letras maiúsculas ou números), descrição, imagem PNG/JPEG/WebP de até 2 MB, links opcionais (site, X, Telegram), validados por `src/lib/validation.ts`.
2. **Condições do lançamento** (etapa 3): a tela mostra supply fixo de 1 bilhão, 9 decimals, sem autoridade de mint/freeze, metadados imutáveis, taxa de 1% e divisão, threshold de 10 SOL e liquidez 100% travada na graduação.
3. **Primeira compra opcional**: de 0 a 1 SOL (`MAX_INITIAL_BUY_LAMPORTS`). Ela entra **na mesma transação** da criação, então ninguém compra antes do criador e o criador não recebe nada além do que comprou. Pela curva RETRY, 0,1 SOL compra 3,08% do supply, 0,5 SOL 13,79% e 1 SOL 24,43%; a revisão mostra a porcentagem antes de assinar.
4. **"Review launch cost"**:
   - envia os metadados para o host RETRY (uma vez por rascunho; o resultado fica em cache);
   - calcula o id da requisição (`launchRequestId`: SHA-256 de carteira, nome, ticker e URI) e recusa se já existe um lançamento pendente ou confirmado com o mesmo id;
   - monta a transação (`prepareCreateToken`) e simula;
   - mostra o custo simulado: primeira compra (com tokens recebidos e % do supply), aluguel e taxas de programa, taxa de rede e total.
5. **"Sign & launch"**: válido por 45 segundos depois da revisão. A revisão fica presa aos dados revisados; se algo mudar, é preciso revisar de novo.
6. **Envio e confirmação**: a assinatura é registrada no navegador antes do envio. Depois da confirmação, aparece "Launched." com link para o explorer e "Open your token".

## O que a transação contém

`client.creator.createPoolWithFirstBuy` do SDK, verificada por `validateTransaction`:

- Instruções DBC permitidas: `initialize_virtual_pool_with_spl_token` e `swap`/`swap2` (primeira compra).
- Contas fixadas: `config` = config RETRY, `pool` = PDA derivada de (WSOL, mint, config), `base_mint` = mint novo, `quote_mint` = WSOL, `creator` e `payer` = carteira conectada.
- Além disso, só: transferência de SOL da carteira para a própria conta WSOL, `SyncNative`, `CloseAccount` da própria WSOL de volta para a carteira, criação das ATAs da carteira para o mint e para WSOL, e limite de compute units. Qualquer outra instrução, programa, signatário ou pagador é recusado.
- Signatários: a carteira e o keypair do mint, gerado no navegador só para esta transação. A chave do mint não tem poder depois: o DBC remove a autoridade de mint.

Antes de montar, `configMismatches` confere a config on-chain. Depois da assinatura, `validateSigned` confere que a carteira não trocou pagador, blockhash ou instruções (pode apenas acrescentar compute budget ou instruções Lighthouse, que algumas carteiras inserem).

## Metadados persistentes

- O GitHub Pages não executa servidor. Os metadados vão para o **Worker RETRY** (`infra/metadata-worker/`, Cloudflare Workers + KV, plano gratuito), configurado por `NEXT_PUBLIC_RETRY_METADATA_URL`.
- `POST /v1/metadata`: aceita só origens permitidas, corpo de até 3 MB, revalida os campos, confere os bytes mágicos da imagem e limita uploads por IP por hora (10 por padrão).
- O JSON e a imagem são gravados pelo SHA-256 do conteúdo: `GET /v1/m/<sha256>.json` e `GET /v1/i/<sha256>`, com cache imutável. Uma URI nunca passa a apontar para outro conteúdo.
- O app relê o JSON gravado, confere que o hash bate com o endereço e que os campos batem com o rascunho, e só então usa a URI on-chain.
- Sem `NEXT_PUBLIC_RETRY_METADATA_URL`, o botão de lançar fica desabilitado com explicação. **Situação atual: o Worker não foi implantado** (precisa da conta Cloudflare do proprietário). Os testes on-chain usam um JSON de teste versionado no repositório (`docs/meteora/devnet-metadata/retry-devnet-test.json`), servido pelo `raw.githubusercontent.com` e aceito apenas para caminhos deste repositório.

## Recuperação e duplicatas

- Cada operação é gravada em `localStorage` (`retry:operations`) com assinatura, `lastValidBlockHeight` e status, **antes** do envio.
- Ao recarregar, `reconcile` consulta `getSignatureStatuses`: confirmada, falhou, expirou (blockhash vencido sem registro) ou continua pendente. Nada é reenviado automaticamente.
- Um lançamento pendente com o mesmo id bloqueia um segundo envio. Se a transação expirou, é seguro tentar de novo, porque um mint novo é gerado.
- O mint e a pool ficam no registro, então "Open your token" funciona mesmo depois de recarregar.

## Custos observados

Validador local com os programas oficiais, primeira compra de 0,1 SOL: variação simulada de 0,127038080 SOL mais 0,00001 SOL de taxa de rede (2 assinaturas). Detalhes em [FEES_AND_COSTS.md](FEES_AND_COSTS.md).

## Verificações on-chain do teste (`tests/chain/meteora-flow.chain.ts`)

Depois da criação: autoridade de mint e de freeze nulas, 9 decimals, supply exatamente 10¹⁸ unidades, metadados com nome/ticker/URI corretos e `isMutable = false`, update authority = System Program, criador com exatamente a saída da primeira compra, e cofre da pool com todo o resto do supply.
