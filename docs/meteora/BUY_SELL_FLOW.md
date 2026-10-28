# Fluxo de compra e venda

Tela: terminal do token RETRY (`src/components/launch/retry-terminal.tsx` e `retry-trade-panel.tsx`). Código: `src/lib/meteora/quotes.ts`, `trade.ts`, `transactions.ts`.

## Quote

- Lida do estado atual da pool (`VirtualPool` + `PoolConfig`) com `swapQuote2` do SDK, que reproduz a matemática do programa.
- Atualizada a cada 10 segundos e no momento de revisar.
- Mostra: quantidade recebida, mínimo garantido, taxa (e a divisão Meteora/criador/RETRY), preço à vista, preço de execução e impacto de preço.
- Compra que completaria a curva: o programa preenche só até o threshold (`PartialFill`) e devolve o resto. A tela avisa e mostra quanto SOL será usado.
- Pool completa ou graduada: não há quote; a tela aponta para a graduação.

## Slippage

- Opções de 0,5% a 10%, padrão 1%. Valores fora do intervalo aceito por `validateSlippage` (0,1% a 10%) são recusados.
- O mínimo de saída é gravado na instrução. Se o preço andar além do limite, **o programa recusa a transação** (erro DBC 6002 `ExceededSlippage`) e nada é negociado. Isso foi testado on-chain.
- A RETRY não promete proteção contra MEV. O limite de slippage limita a perda, não impede sandwich dentro dele.

## Montagem e conferência

`prepareTrade` (`src/lib/meteora/trade.ts`):

1. confere política de execução e cluster;
2. recusa quote com mais de 30 segundos;
3. relê a pool e refaz a quote; recusa se lado, valor ou slippage mudaram, ou se o novo mínimo for menor do que o revisado;
4. na venda, confere que a carteira tem o saldo;
5. monta `client.pool.swap2` (compra `PartialFill`, venda `ExactIn`), sem conta de referral.

A allowlist fixa: instrução `swap2` apenas; `pool`, `config`, `base_mint`, `quote_mint`, `base_vault`, `quote_vault`, contas de entrada e saída da carteira, `payer` = carteira e `referral_token_account` = o próprio programa DBC (ausente). Testes adversariais em `tests/meteora.test.ts` trocam cada uma dessas contas, acrescentam transferências, fechamentos de conta de terceiros, programas desconhecidos, priority fee, signatários e pagadores estranhos. Todos são recusados.

## WSOL

- Compra: SOL é transferido para a conta WSOL da própria carteira, sincronizado, usado no swap, e a conta é fechada de volta para a carteira na mesma transação.
- Venda: a saída chega em WSOL e é desembrulhada para SOL na mesma transação.
- Se a carteira já tiver WSOL antigo, a tela avisa; ele não é tocado além do necessário.
- A tela reserva 0,01 SOL na compra para taxa de rede e aluguel.

## Execução

Mesmo executor de todas as operações (`execute`): simulação → assinatura na carteira → `validateSigned` → registro → envio com preflight → confirmação (reenvio do mesmo transaction bruto enquanto o blockhash vale) → atualização de saldos, pool, atividade e portfolio. Erros viram uma frase (`src/lib/meteora/errors.ts`): rejeição na carteira, slippage, saldo insuficiente, pool completa, expiração, RPC fora do ar, cluster errado, Mainnet bloqueada.

## Resultados on-chain (validador local com os programas oficiais)

| Operação | Resultado |
| --- | --- |
| Compra de 0,5 SOL | recebeu exatamente a quantidade cotada (130.564.541,249646396 tokens); taxa 0,005 SOL = 0,001 Meteora + 0,002 criador + 0,002 RETRY; impacto 15,58%; variação de saldo 0,502039280 SOL (inclui aluguel da ATA nova) |
| Venda de metade | recebeu ≥ mínimo cotado; +0,261505003 SOL |
| Venda acima do saldo | recusada antes de assinar |
| Slippage violado | recusado pelo programa na simulação; mensagem de slippage |
| Compra que completa a curva | preenchimento parcial até 10 SOL; quotes seguintes recusadas |
