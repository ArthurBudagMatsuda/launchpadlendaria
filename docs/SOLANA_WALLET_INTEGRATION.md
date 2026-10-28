# RETRY — Integração de carteiras Solana

## Implementação

Revisão posterior: [relatório do PR #6](reports/RETRY_PR6_REVIEW_AND_WALLET_VALIDATION.md) e [matriz reproduzível](testing/SOLANA_REAL_WALLET_TEST_MATRIX.md). O operador optou por manter testes de extensões reais pendentes nesta revisão.

O seletor exige features v1 de conexão, eventos e desconexão, com métodos válidos; versões incompletas não são anunciadas como disponíveis. Marcas duplicadas são consolidadas na lista. Contas/eventos malformados e falhas de inscrição não derrubam a aplicação. Conexão e desconexão têm prazo de 20 s; uma resposta tardia não altera a sessão seguinte. A confirmação de cópia acompanha o endereço copiado.

Um `RetrySolanaProvider` envolve toda a aplicação. Descoberta via `@wallet-standard/app`; conexão via `standard:connect`; desconexão via `standard:disconnect`; contas via `standard:events`. Phantom, Solflare e Backpack aparecem se registrarem suporte Solana. O nome de uma carteira no registro não certifica sua autenticidade; instalar somente pelos links oficiais apresentados na interface.

O endereço retornado deve ser base58 com 32 bytes e corresponder aos bytes de `publicKey`. Contas Ethereum de extensões multichain não são aceitas. Uma conta deve declarar uma chain Solana. O cluster do aplicativo determina o RPC; não há `switchChain` Ethereum nem promessa de mudar a configuração da extensão. Se a conta não anunciar o cluster selecionado, a interface explica a limitação e só consulta sua identidade pública.

O menu permite conectar, copiar endereço, abrir Explorer, atualizar saldo e desconectar. Erros de rejeição não expõem mensagens brutas da extensão. Conexão tem limite de 20 s; cancelamento e gerações de sessão impedem respostas atrasadas de restaurar contas desconectadas. Alterações de conta, remoção da carteira do registro e lista de contas vazia atualizam o contexto.

Somente o nome da última carteira é salvo em `retry:solana:last-wallet:v1`. Após reload, a aplicação tenta `connect({silent:true})` apenas nessa carteira. Uma carteira deve respeitar a conexão silenciosa já autorizada; não se pede nova aprovação automaticamente. Desconectar remove somente essa chave. Nenhuma seed, private key, assinatura, transação ou saldo é persistido.

## Evidência e matriz manual

Testes automatizados usam implementações Wallet Standard simuladas com os nomes Phantom, Solflare e Backpack. Eles verificam o contrato de integração; **não comprovam uma aprovação em extensões reais**. Nenhuma carteira real foi conectada nesta execução.

| Ambiente real a validar          | Conectar/rejeitar | Conta/desconectar/reload | SOL Devnet/Mainnet | Estado        |
| -------------------------------- | ----------------- | ------------------------ | ------------------ | ------------- |
| Phantom desktop                  | Pendente          | Pendente                 | Pendente           | Não executado |
| Solflare desktop                 | Pendente          | Pendente                 | Pendente           | Não executado |
| Backpack desktop                 | Pendente          | Pendente                 | Pendente           | Não executado |
| Navegadores móveis das carteiras | Pendente          | Pendente                 | Pendente           | Não executado |

Validar com endereço público conhecido, saldo comparado ao Explorer no mesmo cluster, RPC indisponível, carteira bloqueada, troca de conta e página recarregada. Não assinar nem enviar fundos nessa matriz. Se a extensão não anunciar Wallet Standard no navegador usado, mostrar instalação/abertura no navegador da carteira, sem inventar um conector.

Fontes: [Wallet Standard oficial](https://github.com/wallet-standard/wallet-standard), [frontend Solana](https://solana.com/docs/frontend), [Phantom](https://phantom.com/), [Solflare](https://solflare.com/), [Backpack](https://backpack.app/).
