# RETRY — Modelo de tokens SPL

Um token fungível Solana é identificado por **cluster + mint + Token Program dono**. Mint é uma conta com estado; Token Program é o programa que a controla. Uma token account guarda saldo de um mint para um owner; não é o mint nem a carteira. Uma Associated Token Account é derivada considerando owner, mint e Token Program. `src/lib/solana/token-model.ts` prepara esses modelos sem criar contas.

O lookup consulta `getAccountInfo` em `jsonParsed`, valida owner contra SPL Token ou Token-2022, tipo `mint`, inicialização, decimals e supply `u64`. Mint authority e freeze authority são validadas e exibidas. Isso não aprova segurança, liquidez ou metadados do ativo. Nomes, ticker e imagens não são inferidos a partir do endereço. O número de holders e a oferta circulante ainda não são indexados.

| Decisão                                               | Situação                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| SPL Token legado ou Token-2022 para novos lançamentos | Pendente; modelo de leitura reconhece ambos                                                      |
| Supply fixo e decimals                                | Proposta para análise: 1 bilhão com 9 decimals; ainda não aprovada                               |
| Mint authority                                        | Política de revogação/PDA depende da emissão e da curva                                          |
| Freeze authority                                      | Proposta conservadora: ausente; aprovação pendente                                               |
| Metadata e update authority                           | Escolher padrão e política de atualização; não carregar conteúdo remoto arbitrário sem validação |
| Token-2022                                            | Revisar cada extensão; leitura de mint não autoriza negociação                                   |

Supply raw e saldos são inteiros `bigint`. Máximo `u64`: `18_446_744_073_709_551_615`. `1_000_000_000 × 10^9 = 10^18` cabe; `1_000_000_000 × 10^18 = 10^27` excede. Não portar os 18 decimals da especificação Base para SPL automaticamente. `rawSupply` e seus testes demonstram esse limite; não definem parâmetros de um lançamento.

Transfer fee, transfer hook, permanent delegate, default frozen, non-transferable, confidential transfer e autoridades de atualização podem mudar compatibilidade e risco. Analisar combinações contra a versão/IDL do DEX escolhido. Token-2022 não é um sinônimo de suporte universal. ATA, token account e mint devem carregar o programa correto em leituras e futuras instruções.

Fontes: [tokens Solana](https://solana.com/docs/tokens), [criação e layout de mint](https://solana.com/docs/tokens/basics/create-mint), [extensões](https://solana.com/docs/tokens/extensions).
