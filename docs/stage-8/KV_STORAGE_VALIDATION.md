# KV — integridade e persistência

Namespace exclusivo **RETRY_STAGE8_METADATA**, ID `05a067e97f004418aa8ee24bbb0a43a8`, binding **METADATA**. Foram gravados **dois objetos**, sem expiração, usando o administrador autenticado no Wrangler. **Isso não foi um POST de usuário pela interface.**

| Objeto              | Tamanho   | SHA-256                                                            |
| ------------------- | --------- | ------------------------------------------------------------------ |
| PNG válido de teste | 70 bytes  | `6b7fa434f92a8b80aab02d9bf1a12e49ffcae424e4013a1c4f68b67e3d2bbcd0` |
| JSON de metadados   | 459 bytes | `67129784c523c2084254fd55550cf5426d390951b2d3c0a4158a0e271bbda431` |

[Imagem pública](https://retry-solana-devnet-beta.pages.dev/v1/i/6b7fa434f92a8b80aab02d9bf1a12e49ffcae424e4013a1c4f68b67e3d2bbcd0) · [JSON público](https://retry-solana-devnet-beta.pages.dev/v1/m/67129784c523c2084254fd55550cf5426d390951b2d3c0a4158a0e271bbda431.json).

Primeira leitura verificada em **2026-11-03T18:13:06Z**: dois HTTP 200, SHA-256 igual ao conteúdo local, `image/png` e `application/json`, `nosniff`, leitura CORS pública e cache por hash. [Evidência](evidence/public-kv-first-read.json). O JSON possui nome/símbolo/imagem/properties.files; **nenhum mint SPL foi criado a partir dele**. Compatibilidade estrutural não substitui um teste de criação.

O teste [local de runtime](evidence/metadata-runtime.json) reiniciou workerd e releu os mesmos bytes de KV em disco. A [releitura pública às 18:31:45Z](evidence/public-kv-repeat-read.json), cerca de 18 minutos após a primeira, confirmou os mesmos hashes sem nova gravação. A prova remota demonstra leitura do KV Cloudflare em um ponto observado; não garante propagação instantânea ou disponibilidade mundial. O cliente existente retém recibo e tenta GETs, sem repetir POST, quando há propagação.

Limites oficiais consultados em 03/11/2026: Free com **100.000 leituras/dia, 1.000 escritas/dia, 1 GB armazenado**; valor até **25 MiB**, uma escrita/segundo por chave. A aplicação limita imagem a 2 MB e corpo a 3 MB. Dois objetos novos usam duas escritas; isso não torna 500 uploads/dia uma capacidade garantida, pois recursos/leituras/CPU e operações administrativas também contam. Nenhum plano pago foi ativado. [Limites](https://developers.cloudflare.com/kv/platform/limits/), [preços](https://developers.cloudflare.com/kv/platform/pricing/).

KV usa consistência eventual, inclusive cache negativo; outra região pode levar 60 segundos ou mais. Não tratar o cache HTTP como garantia de permanência. Administradores ainda podem apagar/substituir objetos; o Worker recusa conteúdo cujo hash não corresponde ao endereço. [Modelo oficial](https://developers.cloudflare.com/kv/concepts/how-kv-works/).
