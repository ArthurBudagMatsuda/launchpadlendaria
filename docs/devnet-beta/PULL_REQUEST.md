## Etapa 7: preparação da RETRY Solana Devnet Beta

O lançamento pela interface dependia de um Worker não publicado e de uma releitura incompleta dos metadados. Esta mudança preserva a integração Meteora do PR #9, verifica JSON e imagem públicos antes da preparação da transação e permite retomar a propagação do KV sem repetir o POST. Acrescenta autorização explícita de uploads, gateway Pages na mesma origem e um build Devnet-only na raiz.

Também reutiliza o transporte RPC dos testes públicos no cliente Meteora e atualiza de forma pontual toml/uuid. A auditoria de produção cai de 10 para 4 alertas sem supressões; os restantes estão documentados.

**Base pretendida:** `feat/retry-meteora-create-trade-graduate` (PR #9), preservando #6 → #8 → #9. Não mesclar automaticamente.

**Release pública bloqueada:** faltam conta/configuração Cloudflare, deploy real, Phantom de teste e ciclo público completo. Esta entrega não declara Worker/preview publicados nem novas transações Devnet. Mainnet continua desabilitada e GitHub Pages não foi alterado.

O primeiro CI revelou uma corrida entre a conclusão da compra e a digitação da venda; o formulário preserva agora o input novo e mantém a operação ocupada até reconciliar saldos. O teste de segunda migração exige erro no registro confirmado, tolerando indexação atrasada sem reenviar.

Validação local: **210 testes em 22 arquivos**, **26 cenários existentes + 4 Beta no navegador**, lint, tipos, build de produção e bundle do Worker aprovados. A sonda pública Devnet confirmou programas, config, fee claimer e saldo, com **zero transações públicas enviadas**. CI remoto deve corresponder ao último HEAD publicado.

No commit de código `e01344f`, [CI de qualidade](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41568357450), [Beta](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41568357517) e [validadores](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/runs/41568352309) passaram. Cada validador executou **21 testes de cadeia + um cenário completo de navegador com sete assinaturas**. As duas variantes usam binários Devnet/Mainnet em redes locais; o job de transações públicas ficou skipped. O commit documental posterior preserva esse código e seus próprios checks são conferidos no HEAD final.

Validação e limites: [relatório da Etapa 7](https://github.com/ArthurBudagMatsuda/launchpadlendaria/blob/feat/retry-devnet-beta-stage-7/docs/reports/RETRY_STAGE_7_SOLANA_DEVNET_BETA_REPORT.md), [checklist](https://github.com/ArthurBudagMatsuda/launchpadlendaria/blob/feat/retry-devnet-beta-stage-7/docs/devnet-beta/RELEASE_CHECKLIST.md), [segurança](https://github.com/ArthurBudagMatsuda/launchpadlendaria/blob/feat/retry-devnet-beta-stage-7/docs/devnet-beta/SECURITY_FINDINGS.md) e [evidências](https://github.com/ArthurBudagMatsuda/launchpadlendaria/tree/feat/retry-devnet-beta-stage-7/docs/devnet-beta/evidence).
