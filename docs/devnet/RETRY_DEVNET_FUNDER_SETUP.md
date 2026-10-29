# RETRY — Carteira financiadora exclusiva de Devnet

Estado em 29/10/2026: **carteira descartável e environment secret configurados com autorização explícita; financiamento confirmado**. O usuário respondeu “Sim, automatize a carteira e o secret”, autorizando o agente a assumir os passos inicialmente manuais. Nenhuma carteira pessoal foi acessada.

Endereço público: `3r8gEonYHrXEao85oFAu2UzVgT1KsxFmWUZLWBd8G5B3`. Saldo recebido confirmado por RPC: **2.500.000.000 lamports (2,5 SOL de teste)**, slot `516518391`, genesis Devnet. O usuário solicitou o financiamento no faucet. Uma tentativa anterior por RPC recebeu HTTP 410, sem signature; não houve repetição ou submissão web pelo agente. O site orienta agentes a não usar o formulário, portanto foi deixado para interação humana.

`RETRY_DEVNET_FUNDER` existe exclusivamente no environment `retry-devnet`, protegido por revisão do proprietário, branch exata e sem bypass administrativo. Chave gerada em processo, selada com libsodium para o GitHub, sem exibição em conversa/log/argumentos. Backup criptografado Windows DPAPI CurrentUser fora do checkout: `%USERPROFILE%\retry-devnet-private\launchpadlendaria-ci\keypair.dpapi`.

## Automação autorizada

`scripts/manage-devnet-funder.mjs` oferece `plan` e `status` somente leitura; `provision` recusa substituir environment/secret/carteira existentes. Usa libsodium **0.8.4** conforme a [API oficial GitHub](https://docs.github.com/en/rest/guides/encrypting-secrets-for-the-rest-api). O backup DPAPI foi validado com texto inofensivo antes de gerar a chave. Credencial GitHub permanece na memória do processo e não é impressa.

```powershell
node scripts/manage-devnet-funder.mjs status
node scripts/manage-devnet-funder.mjs run-smoke
```

`run-smoke` exige checkout limpo/revisado, genesis Devnet e saldo mínimo antes de abrir o backup no processo local. Repassa a chave somente ao teste por ambiente, com teto bruto de 2 SOL e graduação desligada. O teste anterior com saldo zero recusou execução antes de descriptografar/assinar. O auxiliar não aprova ambientes, faz merge ou publica sites. Resultado real do smoke deve ser conferido no relatório/evidência, não presumido pelo financiamento.

O backup depende da mesma identidade Windows; GitHub não devolve conteúdo de secrets. Não apagar a cópia protegida nem rotacionar automaticamente uma carteira financiada. Os passos manuais abaixo ficam como alternativa; **não gerar outra carteira por engano**.

## Formato confirmado

`tests/chain/devnet-safety.ts` aceita **array JSON de exatamente 64 inteiros entre 0 e 255** ou base58 que decodifique o mesmo keypair completo. Não aceita seed phrase nem seed de 32 bytes. Erros não reproduzem a chave. O genesis é conferido antes da leitura do segredo: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.

Não é necessário exportar nada da Phantom. CI deve usar uma carteira descartável diferente da carteira manual.

## 1. Proprietário: gerar localmente

Depois de revisar o commit e instalar as dependências fixadas, executar **pessoalmente** em terminal confiável:

```powershell
node scripts/create-devnet-funder.mjs "$env:USERPROFILE\retry-devnet-private\funder.json"
```

O auxiliar usa o SDK oficial já instalado, exibe apenas a chave pública, recusa sobrescrita e caminhos dentro do checkout, inclusive por symlink. **O agente não executou este comando.** O arquivo contém chave privada: não enviar ao chat, ao agente ou ao Git. Restringir as permissões da pasta à própria conta; `0600` não substitui ACLs no Windows. Evitar pastas sincronizadas/compartilhadas.

Alternativa com a [Solana CLI oficial](https://solana.com/docs/intro/installation/solana-cli-basics), em terminal privado do proprietário: `solana-keygen new --outfile <caminho-seguro-fora-do-checkout>` e `solana-keygen pubkey <caminho-seguro>`. A CLI pode exibir frase de recuperação; não gravar a sessão nem executá-la em ferramenta do agente. Uma chave não tem cluster intrínseco; a restrição Devnet vem da política e do genesis RPC.

## 2. Financiar somente com SOL de teste

Usar [faucet oficial](https://faucet.solana.com/), respeitando login e quotas. Não comprar SOL, mover fundos pessoais ou contornar limites com outras identidades. A tentativa RPC e o pedido humano desta etapa estão documentados acima; não repetir automaticamente.

- **Smoke:** 0,4 SOL ao criador + 1 SOL ao trader + taxas da financiadora. Exige **1,40002 SOL de teste antes de qualquer transferência**; planejar 2 SOL, sujeitos ao faucet. Limite bruto cumulativo: 2 SOL. Cobre config, criação com compra inicial de 0,1 SOL, compra de 0,5 SOL, venda, fees e leitura.
- **Graduação:** threshold efetivo = **10.000.000.000 lamports (10 SOL)**. Top-up calculado do estado: `threshold - quoteReserve + 0,5 SOL - saldo do trader`. Requer autorização separada, `RETRY_CHAIN_GRADUATION=1` e teto bruto explícito de 12 SOL. **Não é garantia de suficiência nem custo líquido.** Conferir saldo, taxas, reserva e rent float antes.
- Restantes das chaves efêmeras são devolvidos quando possível. Rent e reservas na pool não são automaticamente recuperáveis. Refund não reduz o teto bruto.

## 3. Inserir o secret diretamente no GitHub

Antes, configurar [environment protegido](RETRY_GITHUB_ACTIONS_SECURITY.md). Preferir **environment secret** para reduzir a exposição.

GitHub → Settings → Environments → `retry-devnet` → Environment secrets → Add secret. Nome: `RETRY_DEVNET_FUNDER`. O proprietário insere diretamente o conteúdo do arquivo no formulário seguro. Não enviar ao agente nem colocar em `.env.example` ou `NEXT_PUBLIC_*`.

Alternativa, se GitHub CLI já estiver instalado/autenticado, em terminal privado:

```powershell
Get-Content -Raw -LiteralPath "$env:USERPROFILE\retry-devnet-private\funder.json" | gh secret set RETRY_DEVNET_FUNDER --env retry-devnet --repo ArthurBudagMatsuda/launchpadlendaria
```

O valor passa pela entrada padrão, sem literal em argumentos ou histórico. O agente verifica depois apenas o **nome**, nunca o conteúdo.

## 4. Fornecer somente a chave pública

Informar apenas o endereço público e a confirmação de que o secret foi inserido. A leitura independente pode ser feita assim:

```powershell
$env:RETRY_DEVNET_FUNDER_ADDRESS = '<ENDERECO_PUBLICO>'
pnpm test:devnet:readiness
Remove-Item Env:RETRY_DEVNET_FUNDER_ADDRESS
```

Registra cluster, genesis, endereço, lamports, SOL, slot e RPC, sem assinatura. Endereço e saldo recebido foram verificados; conferir o saldo após o teste na evidência pública. Ver [execução pública/local](RETRY_PUBLIC_DEVNET_TESTS.md), pois o dispatch ainda depende da presença do workflow na default branch.
