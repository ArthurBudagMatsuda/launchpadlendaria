# RETRY — Roadmap

> HISTÓRICO — planejamento Base substituído pelo [roadmap Solana](SOLANA_LAUNCHPAD_ROADMAP.md). Não usar parâmetros ou contratos EVM para a versão atual.

| Stage                    | Deliverable                                                                                    | Dependencies / exit criteria                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Foundation           | Identity, four application views, local fixtures, initial wallet connectors, docs, Git/CI      | Formatting, lint, strict types, tests, build and browser checks; execution unavailable                                                                         |
| 2 · Web3 infrastructure  | Complete connector matrix, RPC strategy, session/chain handling, network-scoped data contracts | Test real injected, Coinbase and WalletConnect flows on Base Sepolia; rejection/account/chain/RPC tests; no financial signatures                               |
| 3 · Real data            | Chain-indexed registry, prices, activity and history adapters                                  | Verified contract/event sources, reorg/finality policy, rate limits and explicit freshness/provenance; depends on test fixtures or factory events from Stage 4 |
| 4 · Token creation       | Reviewed ERC-20/factory specification and testnet creation                                     | Economic/admin decisions approved, unit/property tests, metadata sanitization and contract address verification                                                |
| 5 · Bonding curve        | Mathematical specification, implementation and invariant/property tests                        | Formal reserves/rounding/fee rules, boundary analysis, independent review; testnet only                                                                        |
| 6 · Onchain trading      | Quote/simulation → wallet signing → receipt/index reconciliation                               | Stage 5 verified; slippage, deadlines, MEV considerations, failure recovery and no custody                                                                     |
| 7 · Graduation           | Idempotent curve completion and DEX liquidity migration                                        | Reviewed DEX compatibility, ownership/locks and adversarial tests; no arbitrary liquidity decisions                                                            |
| 8 · Portfolio and tools  | Indexed holdings/history, created tokens, advanced terminal features                           | Reorg-correct data reconciled against onchain balances; privacy and performance review                                                                         |
| 9 · Production readiness | Audit, legal review, complete testnet exercise and operational preparation                     | All earlier security requirements met; monitoring, incident response, deployment controls and explicit mainnet approval                                        |

The data specification in Stage 3 can precede contracts, but verified live indexing depends on a testnet factory/event schema. Economic specifications must precede Stage 4/5 implementation. Independent security review is continuous, not deferred entirely to Stage 9. No roadmap date or economic parameter is a promise.

## Immediate Stage 2 work

Configure public RPC endpoints and WalletConnect origin restrictions, run a real-wallet test matrix, introduce a network-scoped indexer adapter contract, and record wallet/runtime compatibility before adding transaction code.
