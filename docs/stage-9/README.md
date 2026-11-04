# RETRY — Etapa 9 em execução

Base: PR #11, `625e8a4e8ebd6e3e8ffe0094e74fc401cedfe07b`. Branch exclusiva: `feat/retry-stage-9-transactional-beta-vercel`. Os PRs #6, #8, #9, #10 e #11 foram consultados em 04/11/2026 e continuam abertos, Draft e sem merge, com os mesmos HEADs registrados na Etapa 8.

O preview Cloudflare continua em `1c5127a35eaf67515d06afe13378a8ae0e15e646`. O site GitHub Pages respondeu 200 e manteve o SHA-256 anterior. Nenhuma transação pública nova ou alteração remota do Worker foi feita até este registro inicial.

O build Vercel foi preparado e validado localmente como export estático no domínio raiz, Devnet, sem Functions, com o Worker Cloudflare existente. Exige a branch desta etapa e ambiente Preview. A publicação depende de concluir a seleção/autorização da conta correta: a integração identifica `arthurbudagmatsuda`, enquanto o navegador está em `brenotrade` (Hobby, sem projetos), usuário `xxmanarthurbudagmatsuda-8355`. O proprietário foi consultado; nenhum projeto foi criado em uma conta presumida.

Uploads da Etapa 9 usam a assinatura de uma mensagem específica, com carteiras de testes aprovadas, nonce consumido atomicamente em Durable Object SQLite, hash do corpo, domínio, origem, URI, escopo e validade de dois minutos. O código mantém compatibilidade com Access nos builds anteriores; o build Vercel seleciona explicitamente `wallet-devnet`. Leia [autenticação](CLOUDFLARE_AUTHENTICATED_UPLOADS.md).

Evidências novas em [evidence/](evidence/): inventário remoto inicial, integridade dos sites preservados, saldos por slot, auditoria antes/depois e runtime local com criptografia real, SQLite e KV persistidos. As categorias **UNIT**, **MOCKED BROWSER**, **LOCAL VALIDATOR**, **PUBLIC DEVNET**, **REAL PHANTOM** e **VERCEL PREVIEW E2E** serão distinguidas na matriz final. Uma aprovação local não comprova um teste público.

Saldo público reconsultado: Phantom 0 lamports, slot 518702677; funder 2.013648909 SOL de teste, slot 518702679. Déficit apenas para atingir o threshold de 10 SOL: 7.986351091 SOL, antes de taxas, rent e migração. Não foram solicitados fundos reais nem ignorados os limites de faucet.

O relatório completo e a matriz de aceite serão concluídos com o resultado efetivamente observado. Este registro inicial não declara a Beta transacional pronta.
