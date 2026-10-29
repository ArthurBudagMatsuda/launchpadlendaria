# Metadados e armazenamento

Código: `src/lib/validation.ts` (rascunho), `src/lib/meteora/metadata-upload.ts` (envio e releitura), `src/lib/meteora/metadata.ts` (leitura on-chain e off-chain), `infra/metadata-worker/` (host). Configuração e implantação do host: [docs/cloudflare/RETRY_METADATA_WORKER_SETUP.md](../cloudflare/RETRY_METADATA_WORKER_SETUP.md) e [infra/metadata-worker/README.md](../../infra/metadata-worker/README.md). Este documento descreve como o app usa o host; não repete o guia de implantação.

**Estado em 29/10/2026: o Worker não está implantado.** Sem `NEXT_PUBLIC_RETRY_METADATA_URL`, o botão de lançar fica desligado com explicação, em qualquer rede. Os testes on-chain usam um JSON de teste versionado no repositório (abaixo).

## O que vai on-chain e o que fica fora

| Onde                                 | O quê                                                              | Pode mudar depois?                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Conta Metaplex do mint (on-chain)    | nome (≤ 32 bytes), ticker (≤ 10), URI (≤ 200), `isMutable = false` | não: a config RETRY usa `TokenAuthorityOption.Immutable`, update authority = System Program                         |
| JSON no host (`/v1/m/<sha256>.json`) | nome, ticker, descrição, imagem, links (formato Metaplex)          | o endereço é o SHA-256 do conteúdo; um administrador pode apagar o objeto, nunca trocar o conteúdo sem mudar o hash |
| Imagem no host (`/v1/i/<sha256>`)    | PNG, JPEG ou WebP de até 2 MB                                      | idem                                                                                                                |

Persistência e imutabilidade são coisas diferentes: a URI on-chain nunca muda, e o app detecta conteúdo trocado, mas não pode impedir que o host deixe de servir um arquivo. Nesse caso o token continua negociável e aparece sem imagem.

## Fluxo de criação

1. **Rascunho** (`src/lib/validation.ts`): nome de 2 a 32 bytes, ticker de 2 a 10 letras maiúsculas ou números, descrição, imagem com bytes mágicos de PNG/JPEG/WebP (SVG e URLs remotas recusados), links `https` (X só `x.com`/`twitter.com`, Telegram só `t.me`). O rascunho salvo no navegador é relido campo a campo; nada desconhecido é restaurado.
2. **Envio** (`uploadMetadata`): `POST <host>/v1/metadata` com `credentials: "include"` (a sessão do Cloudflare Access autoriza o envio) e `referrerPolicy: "no-referrer"`. Respostas tratadas: 429 (limite), 401/403 (sem sessão autorizada), outro erro (recusado).
3. **Releitura**: o app baixa a URI devolvida, calcula o SHA-256 dos bytes e exige que seja o hash do endereço `/v1/m/<sha256>.json`; depois exige nome, ticker e descrição iguais ao rascunho e uma imagem de host confiável. Qualquer diferença bloqueia o lançamento.
4. **On-chain**: a URI conferida entra em `createPoolWithFirstBuy`. `validateCreateInput` recusa URI de host não confiável ou com mais de 200 bytes.

O mesmo conteúdo sempre gera a mesma URI, então repetir o envio não cria cópias. A proteção contra lançamento duplicado é outra: `launchRequestId` (SHA-256 de carteira, nome, ticker e URI) e `pendingCreate`, ver [TOKEN_CREATION.md](TOKEN_CREATION.md).

## Validações no Worker

Resumo do que `infra/metadata-worker/src/index.ts` e `access.ts` fazem (detalhes no README do Worker):

- `POST /v1/metadata` só com JWT do Cloudflare Access válido (RS256, issuer, audience, expiração, JWKS da conta). A origem sozinha não autentica.
- Corpo lido em streaming até 3 MB; imagem até 2 MB com assinatura real; JSON precisa ser objeto; campos e links revalidados; URL com credenciais, SVG/HTML e tipo falso recusados.
- Limite de envios por identidade (binding de rate limit, aproximado por localização, não é teto global).
- `GET /v1/m/*` e `/v1/i/*` são públicos, com cache imutável; imagem com `nosniff` e tipo verificado.
- Sem configuração ou binding, o envio fica fechado (401, 429 ou 503 conforme o caso).

## Leitura e exibição

`metadata.ts`:

- `readMetadata` decodifica a conta Metaplex de cada mint (em lotes de 100) e só aceita conta do programa Metaplex, versão 1 e com o mint certo. Nome, ticker e `isMutable` vêm daí.
- `fetchOffchainMetadata` só busca URIs de hosts confiáveis: `raw.githubusercontent.com` restrito ao caminho deste repositório (metadados de teste) e o host de `NEXT_PUBLIC_RETRY_METADATA_URL`. Pedido sem cookies e sem referrer; resposta de até 16 KB.
- O JSON só é aceito se nome e ticker forem iguais aos on-chain. Descrição cortada em 300 caracteres; imagem só de host confiável; site qualquer `https`; X e Telegram só nos domínios oficiais. Nada do JSON vira HTML.
- Discover, página do token e portfolio usam o mesmo caminho. Metadados ilegíveis não escondem o token: ele aparece com o endereço do mint e sem imagem.

## Metadados de teste da Devnet

`docs/meteora/devnet-metadata/retry-devnet-test.json` é a URI gravada on-chain nos tokens de teste (validador e Devnet pública). O caminho não pode mudar, por isso ficou em `docs/meteora/` quando os documentos foram para `docs/meteora-mvp/`. Só caminhos deste repositório em `raw.githubusercontent.com` são aceitos.

## Testes

| Teste                                         | O que prova                                                                                                                                                                                                                           | Nível                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `tests/metadata-worker.test.ts` (16 testes)   | upload, hash na releitura, idempotência, origem, Access (token ausente, expirado, issuer/audience/assinatura errados), campos, imagens com tipo falso, limites, falhas de storage e rede, host que devolve conteúdo diferente do hash | unitário; KV, JWKS e limitador simulados |
| `tests/meteora.test.ts` ("Metaplex metadata") | decodificação Metaplex, recusa de outro dono/mint/tamanho, hosts confiáveis, JSON conferido contra a chain                                                                                                                            | unitário                                 |
| `tests/validation.test.ts`                    | limites do rascunho, links, bytes mágicos, restauração segura do rascunho                                                                                                                                                             | unitário                                 |
| `e2e/chain/meteora-browser.spec.ts`           | lançamento pelo navegador com o Worker real rodando no processo do teste (KV em memória, JWT de teste assinado) contra o validador                                                                                                    | navegador + programas reais no validador |
| `pnpm test:metadata:bundle`                   | o Worker empacota com o Wrangler fixado (dry-run, sem publicar)                                                                                                                                                                       | build local                              |

Nenhum desses testes comprova o Worker implantado na Cloudflare, cookies do Access entre origens reais ou persistência remota. Isso só pode ser verificado depois da implantação na conta do proprietário.

## Custos

KV no plano gratuito tem cotas diárias finitas (consultadas em 29/10/2026: 1 GB, 100 mil leituras e mil escritas por dia). Cada lançamento grava imagem e JSON. Ver [FEES_AND_COSTS.md](FEES_AND_COSTS.md) e o guia da Cloudflare.

## Moderação

Não há moderação automática de nome, imagem ou descrição. O Access restringe quem envia (piloto com operadores autorizados) e permite suspender envios num incidente. Remover um conteúdo abusivo é uma decisão administrativa registrada; a URI on-chain continua apontando para o endereço removido.
