# Uploads autenticados — Etapa 9

## Mecanismo escolhido

Autenticação por mensagem assinada da carteira, restrita a testadores aprovados. Reutiliza o Worker e o KV de metadados. Acrescenta somente um coordenador de nonce em Durable Object SQLite, disponível no [Workers Free](https://developers.cloudflare.com/durable-objects/platform/pricing/). O KV de metadados não é usado como trava de replay.

O projeto anterior permanece em leitura. O código novo só será publicado após validar o runtime e conhecer as origens Vercel reais. A configuração gerada em `.qa/stage-9/worker/` não contém credenciais e não publica nada sozinha. O proprietário autorizou a implementação transacional no roteiro da Etapa 9; nenhum plano pago ou cadastro de cartão está autorizado.

## Protocolo

1. O formulário serializa uma única vez o corpo do upload. Pede a `/v1/auth/challenge` um desafio para sua chave pública e SHA-256 desse corpo.
2. O Worker exige uma origem exata aprovada, carteira na allowlist (máximo oito), limiter nativo configurado e binding do coordenador. Configuração ausente ou modo desconhecido falha fechado.
3. O coordenador gera 32 bytes aleatórios, registra a mensagem por dois minutos e limita o estado a oito desafios pendentes por carteira. Origens diferentes compartilham a mesma autoridade de nonce por carteira.
4. A mensagem fixa inclui domínio, origem, URI, POST, escopo `retry:metadata:upload:devnet:v1`, genesis Devnet, carteira, hash do corpo, nonce e datas. O cliente recompõe o texto e verifica todos os campos antes de solicitar `solana:signMessage`.
5. A carteira assina uma mensagem; não assina uma transação financeira nessa etapa. O cliente confere o texto retornado e a assinatura Ed25519 da conta conectada.
6. O POST leva somente chave pública, nonce e assinatura nos cabeçalhos, com cookies omitidos. O Worker verifica o hash exato e a assinatura. O coordenador relê e consome o nonce em uma [transação de storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#transaction), antes de qualquer escrita em KV.
7. MIME, tamanho, estrutura da imagem, campos, conteúdo inseguro e URLs continuam validados pelo Worker. A URI retornada só habilita a revisão do lançamento após imagem e JSON públicos serem lidos e conferidos por hash.

Não há token compartilhado no frontend, chave de assinatura do servidor nem sessão persistente de upload. O CORS não substitui a assinatura. Nenhum `*.vercel.app` genérico é autorizado; cada deployment ou alias verificado precisa constar nas origens exatas.

## Limites e falhas

O coordenador limita cada carteira a dez uploads aceitos por dia UTC, de maneira durável e compartilhada entre origens. O limiter nativo continua aproximado, com dez requisições por minuto por chave/localização. Até oito carteiras significam no máximo 160 escritas de conteúdo KV/dia pelo caminho de upload (duas por tentativa aceita), sem incluir gravações administrativas externas. As cotas de requests, CPU e SQLite também se aplicam; o Free falha ao exceder seus limites, sem ativar plano pago.

Um nonce consumido permanece recusado após reiniciar o runtime. Concorrência aceita somente um POST. Falhas de storage após consumir a autorização não a reabrem nem repetem o POST automaticamente; a pessoa deve rever o estado e, se necessário, pedir nova autorização. Uma mensagem válida apenas autoriza aquele corpo e origem durante a validade. Não permite criar o token ou enviar SOL sozinha.

Desafios sem assinatura podem ser solicitados para uma carteira conhecida; limites de IP e estado reduzem abuso, mas não garantem disponibilidade contra negação de serviço. Isso deve ser revisto antes de abrir uploads para público irrestrito. O allowlist desta Beta permanece pequeno.

## Evidência atual

**LOCAL WORKER RUNTIME:** assinaturas Ed25519 reais com chave descartável apenas em memória; SQLite Durable Object e KV em disco. Upload 201, leitura pública 200, replay 409, assinatura inválida 401 e origem indevida 403. Seis POSTs simultâneos com o mesmo nonce resultaram em um 201 e cinco 409. Reiniciar preservou conteúdo e rejeição de replay. [JSON](evidence/wallet-upload-runtime.json).

Essa evidência não é deploy remoto, assinatura Phantom real ou transação Devnet pública. Esses resultados serão acrescentados somente quando observados.
