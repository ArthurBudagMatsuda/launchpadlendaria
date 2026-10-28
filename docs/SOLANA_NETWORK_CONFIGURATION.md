# RETRY — Redes e RPC Solana

Devnet é o padrão. `mainnet-beta` é opt-in e permite apenas leitura. Testnet e redes EVM são rejeitados.

| Configuração pública              | Padrão / uso                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SOLANA_CLUSTER`      | `devnet` ou `mainnet-beta`                                                           |
| `NEXT_PUBLIC_SOLANA_RPC_URL`      | RPC oficial do cluster se vazio                                                      |
| `NEXT_PUBLIC_SOLANA_WS_URL`       | Reservado; esta versão usa polling HTTP e não abre WebSocket                         |
| `NEXT_PUBLIC_ENABLE_LIVE_TRADING` | `false`; outro valor ativo invalida a configuração                                   |
| `NEXT_PUBLIC_ENABLE_TOKEN_LAUNCH` | `false`; outro valor ativo invalida a configuração                                   |
| `NEXT_PUBLIC_BASE_PATH`           | Prefixo HTTP de hospedagem, não uma blockchain; `/launchpadlendaria` no export Pages |

Endpoints HTTP requerem HTTPS, com exceção de loopback. Credenciais embutidas no URL são rejeitadas. `NEXT_PUBLIC_*` é incorporado ao JavaScript; nunca usar uma chave secreta. Um endpoint com identificador público também pode exigir restrição de origem e quota. Para uso público consistente, provisionar RPC dedicado por cluster e validar CORS. RPC público não tem garantia de disponibilidade e pode limitar tráfego.

Antes de uma leitura, `getGenesisHash` confirma o ambiente; a confirmação dura 60 s por URL/cluster. Verificações reais nos endpoints oficiais durante a migração retornaram:

- Devnet: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
- Mainnet: `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.

Cada operação tem até duas tentativas, 7 s por tentativa e 150 ms entre tentativas. Cancelamento acompanha a query. Mismatch de genesis falha imediatamente. O SDK e `bigint` preservam lamports; `1 SOL = 1_000_000_000 lamports`. Um erro nunca vira zero. Saldo: cache fresco por 15 s e polling a cada 30 s. O cache inclui cluster, URL e endereço; trocar ambiente não reaproveita saldo de outro cluster. O seletor usa o endpoint público padrão do ambiente escolhido; um RPC customizado se aplica ao ambiente inicial configurado.

Explorer recebe `?cluster=devnet` para Devnet. O cluster escolhido no RETRY não altera as preferências da carteira. Não há seleção EVM por chain ID.

Atualização da revisão do PR #6: o RPC configurado inicialmente é preservado ao sair do cluster e voltar. O cliente RPC é reutilizado em cache limitado a oito URLs. O prazo de leitura rejeita também quando um transporte ignora o cancelamento; não depende apenas do AbortController. As sondas reais dos dois clusters e seus limites de evidência estão no [relatório de revisão](reports/RETRY_PR6_REVIEW_AND_WALLET_VALIDATION.md).

Fontes: [clusters](https://solana.com/docs/references/clusters), [RPC HTTP](https://solana.com/docs/rpc/http), [getBalance](https://solana.com/docs/rpc/http/getbalance), [getGenesisHash](https://solana.com/docs/rpc/http/getgenesishash).
