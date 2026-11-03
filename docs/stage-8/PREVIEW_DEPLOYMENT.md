# Preview publicado

**URL estável:** https://retry-solana-devnet-beta.pages.dev/

Deployment Cloudflare Pages **`b0b2983a-f0b8-452b-8564-74b3633087ad`**: [URL desse deployment](https://b0b2983a.retry-solana-devnet-beta.pages.dev/).

Commit servido e associado ao deployment: **`1c5127a35eaf67515d06afe13378a8ae0e15e646`**. [beta-version.json](https://retry-solana-devnet-beta.pages.dev/beta-version.json) confirmou `dirty=false`, `cluster=devnet`, `mainnetExecution=false`, `capabilities=read-only`, `metadata=null`.

Projeto exclusivo, Direct Upload, production branch **feat/retry-stage-8-public-devnet-beta**. “Production” é o nome do ambiente do projeto **Beta isolado**, não da RETRY Mainnet. Não há conexão Git/autodeploy da main nem domínio personalizado. 75 assets estáticos, gateway somente em `/v1/*`, serviço de metadados separado. Base path da Beta é a raiz; o export GitHub Pages continua usando `/launchpadlendaria`.

[QA público sem mocks](evidence/public-browser.json): desktop e Pixel 7 emulado, Chrome 156.0.8078.80; Discover mostra dois lançamentos históricos reais; Create/Portfolio/Token retornam 200; modal de carteira abre; sem erro JavaScript, asset quebrado ou chamada Mainnet observados; nenhuma escrita Solana. [Desktop](evidence/public-desktop.png), [mobile](evidence/public-mobile.png). Em mobile as categorias usam rolagem horizontal local; não houve overflow horizontal do documento nos percursos verificados.

O [site antigo](https://arthurbudagmatsuda.github.io/launchpadlendaria/) permanece em `0fcc9e5`, deployment GitHub `7395136316`, HTTP 200. [Prova GitHub](evidence/previous-site-status.json), [hash HTTP](evidence/previous-site-http.json). Nenhuma publicação desta etapa foi direcionada a ele.
