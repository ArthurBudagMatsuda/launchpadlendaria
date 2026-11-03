# Upload e disponibilidade

## Contrato

| Endpoint            | Autorização                                         | Resultado                                                                                   |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GET /v1/metadata    | Access, testador aprovado                           | Confirma sessão sem revelar identidade; permite login por navegação                         |
| POST /v1/metadata   | JWT Access verificado + origem exata + rate binding | 201 se os dois objetos foram relidos localmente; 202 se propagando; recibo com URI e imagem |
| GET /v1/m/hash.json | Público                                             | JSON content-addressed, hash conferido antes de servir                                      |
| GET /v1/i/hash      | Público                                             | PNG/JPEG/WebP, MIME e hash conferidos antes de servir                                       |

Falta de sessão = 401; origem recusada = 403; MIME incorreto = 415; corpo excessivo = 413; campos/imagem inválidos = 422; limite = 429; conflito de integridade = 409; armazenamento indisponível = 503. Corpo que não termina tem prazo de 5s (408). Respostas de erro não expõem detalhes internos nem são cacheadas como conteúdo imutável.

## Disponibilidade antes da assinatura

O cliente envia **um POST**, valida o recibo e guarda-o em memória na tela Create. Depois lê JSON de até 16 KiB e imagem de até 2 MiB sem cookies, conferindo hashes, tipo e correspondência com o rascunho. Cada fetch, incluindo o corpo, tem prazo de 7s. Leituras 404/429/503 usam no máximo sete tentativas com intervalos 0/1/2/4/8/15/30s; após isso a tela informa propagação pendente. Nova revisão retoma os GETs com o recibo, sem repetir o POST. Recarregar perde esse recibo em memória, mas um novo upload do mesmo conteúdo continua idempotente por hash.

Nenhuma transação é preparada antes dessa verificação. Preparação e execução financeira existentes continuam separadas, com simulação, revisão e assinatura explícita. Upload não cria mint, pool ou movimentação de SOL.

## O que os testes cobrem

- JSON válido/inválido/null/array, tamanho e streaming.
- Origem permitida/recusada e preflight sem autenticação.
- Sessão ausente, JWT falso, assinatura inválida, issuer/audience incorretos e expiração.
- Rate limit por identidade, sem tratá-lo como limite global de gastos.
- PNG/JPEG/WebP reais do repositório; tipo falso, truncamento, contêiner inválido, dimensões excessivas, markup e controles bidi.
- Links com credenciais, protocolos indevidos e campos extras.
- Repetição idempotente, KV falho, conteúdo adulterado, recusa de substituição e propagação pendente.
- Timeout de corpo/cliente, divergência do JSON/imagem e retomada por GET.
- Navegador desktop/mobile usando Worker real em processo, com **Access, KV, RPC e carteira simulados**.

A validação de contêiner/dimensões no Worker não é decodificação completa dos pixels, sanitização de metadados EXIF ou verificação antimalware. O cliente também faz a decodificação de imagem já existente. Não há moderação automática. A Beta deve ficar restrita a operadores aprovados; abertura irrestrita exige revisão de abuso e CPU/quota.

**Ainda não comprovado:** gravação remota no KV, persistência após novo acesso de região diferente, cookies reais, autenticação no edge e upload pelo preview publicado. Esses itens dependem da conta e do deploy. Não chamar testes em memória de validação de persistência Cloudflare.
