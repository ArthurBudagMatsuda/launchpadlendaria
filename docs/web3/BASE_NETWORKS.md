# Base networks

> HISTÓRICO — redes EVM retiradas da aplicação ativa. Consulte [redes Solana](../SOLANA_NETWORK_CONFIGURATION.md).

RETRY supports exactly two networks. Chain objects come from `viem/chains`, so names, RPC defaults and explorers stay in sync with viem.

| Key            | Chain ID | Name         | Role                              | Public RPC                 | Explorer                       |
| -------------- | -------- | ------------ | --------------------------------- | -------------------------- | ------------------------------ |
| `base-sepolia` | 84532    | Base Sepolia | Development and testing (default) | `https://sepolia.base.org` | `https://sepolia.basescan.org` |
| `base`         | 8453     | Base         | Production                        | `https://mainnet.base.org` | `https://basescan.org`         |

Native currency on both is ETH (18 decimals). Any other chain the wallet reports, such as Ethereum (1), Arbitrum One (42161) or OP Mainnet (10), is treated as **Wrong Network**: the UI names it, stops reading balances and offers a `Switch to Base Sepolia` / `Switch to Base` button. The app never switches on its own.

## Choosing the target network

`NEXT_PUBLIC_DEFAULT_NETWORK` selects the network the app targets:

- `base-sepolia` (or unset): development. The header shows `Base Sepolia · Testnet`.
- `base`: production. Accepted aliases are `mainnet`, `base-mainnet` and `8453`; unknown values fall back to Base Sepolia with a configuration warning.

Both chains stay configured whatever the target. A wallet on the other Base network is in the `supported` scenario: it is not "wrong" and its balance is read on that network, but the UI shows a notice:

- Target Base Sepolia, wallet on Base: `Connected to Base Mainnet (read-only). Trading and token launches are not enabled yet.`
- Target Base, wallet on Base Sepolia: `Connected to Base Sepolia, a test network. Switch to Base to use RETRY.`

## RPC layer

Each chain gets a viem `fallback` transport over HTTP:

1. The custom endpoint from `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` / `NEXT_PUBLIC_BASE_RPC_URL`, when it is a valid https URL (plain http only for `localhost`, `127.0.0.1` or `[::1]`, for a local fork).
2. The public Base endpoint above, as fallback.

Defaults (`RETRY_TRANSPORT_DEFAULTS`):

| Setting          | Value | Meaning                                                   |
| ---------------- | ----- | --------------------------------------------------------- |
| `timeoutMs`      | 8 000 | Per request, per endpoint                                 |
| `retryCount`     | 2     | Retries over the whole fallback list, so at most 3 rounds |
| `retryDelayMs`   | 500   | Exponential backoff base (500 ms, then 1 s)               |
| `batch`          | false | No JSON-RPC batching at the transport level               |
| `publicFallback` | true  | Keep the public RPC behind a custom one                   |

Inner transports have their own retries disabled, so a failing read makes at most (retryCount + 1) × endpoints requests: 6 with the defaults and a custom RPC, 3 with the public RPC alone. A unit test asserts this bound. wagmi batches reads through Multicall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`, deployed on both networks), so a balance read is usually an `eth_call` to `getEthBalance`.

On top of that, TanStack Query caches reads for 15 s (`staleTime`), keeps them 5 min (`gcTime`), does not refetch on window focus and retries a failed query once only when the error is retryable (timeouts, 5xx, 429). The ETH balance refreshes every 30 s while the tab is visible, never in the background, and on demand through the refresh button.

### Public RPC is not for production

`sepolia.base.org` and `mainnet.base.org` are rate limited and meant for development. For production set a dedicated provider URL (Alchemy, QuickNode, Infura, Coinbase Developer Platform, etc.). Because the variable is `NEXT_PUBLIC_`, the key in the URL is visible to anyone: restrict it to RETRY's domains in the provider dashboard and set a spending cap. Logs and warnings only ever show the URL origin.

## Getting test ETH

Base Sepolia ETH has no value and comes from faucets. The official list is at <https://docs.base.org/base-chain/tools/network-faucets>. Bridging Sepolia ETH from Ethereum Sepolia also works.

## Adding Base to a wallet

`Switch to Base Sepolia` calls `wallet_switchEthereumChain`. If the wallet does not know the chain (error 4902), wagmi follows up with `wallet_addEthereumChain` using viem's chain definition; the user approves both prompts in the wallet. If the wallet cannot switch programmatically (some mobile and WalletConnect wallets), the UI says so and asks the user to switch inside the wallet.

## Migrating to Base Mainnet

Nothing in the code needs to change for the network itself. Before flipping the default:

1. Set `NEXT_PUBLIC_DEFAULT_NETWORK=base` in the production environment only. Keep previews on Base Sepolia.
2. Set `NEXT_PUBLIC_BASE_RPC_URL` to a dedicated, domain-restricted endpoint.
3. Register the production domain in the WalletConnect project (dashboard.reown.com → project → allowed domains).
4. Register the audited contract deployments for chain 8453 (below). Until then every contract helper throws `CONTRACT_NOT_DEPLOYED`.
5. Turn on financial operations only in the stage that implements them: `RETRY_FINANCIAL_OPERATIONS_ENABLED` is a `false` literal in Stage 2 on purpose, and the security test must be updated deliberately in that stage.
6. Run the manual wallet checklist in [WALLET_INTEGRATION.md](./WALLET_INTEGRATION.md#manual-checklist-with-real-wallets) against the production build with real wallets and a small amount of ETH.

## Contracts

`packages/retry-web3/src/contracts/registry.ts` holds one entry per network for `tokenFactory`, `bondingCurve`, `feeManager` and `liquidityMigrator`. Today all are:

```ts
{
  status: "not-deployed";
}
```

No address or ABI was invented. To register a real deployment after it is audited:

```ts
[BASE_SEPOLIA_CHAIN_ID]: {
  tokenFactory: {
    status: 'deployed',
    address: '0x…',            // checksummed, verified on Basescan
    deployedAtBlock: 12345678n, // optional, speeds up log queries
    deploymentTx: '0x…',        // optional, for audit trails
  },
  …
}
```

Then generate its ABI (for example with `@wagmi/cli` and the Foundry plugin) into `src/contracts/abis/` as a `const` export and add it to `RETRY_ABIS`. `validateContractRegistry()` rejects malformed addresses, the zero address and the same address reused across contracts; the unit tests call it, so a bad entry fails CI. `readRetryContract` is the only way to call a RETRY contract in this stage and it only reads.
