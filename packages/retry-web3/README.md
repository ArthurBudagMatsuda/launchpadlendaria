# @retry/web3

Web3 layer of the RETRY launchpad (Stage 2): EVM wallet connection, Base and Base Sepolia handling, a resilient RPC layer, native ETH balance reads, friendly errors and a contract registry that is ready for future deployments.

Everything in this package is **read-only**. It never asks for a signature, never sends a transaction, never requests a token approval and contains no contract address. `RETRY_FINANCIAL_OPERATIONS_ENABLED` is `false` and a test fails the build if signing or sending APIs appear in the source.

Built on wagmi 3, viem 2 and TanStack Query 5. React 18 or 19.

## Entry points

| Import                    | Contents                                                                          | Where                 |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------- |
| `@retry/web3`             | Provider, hooks, components, errors, formatting, explorer helpers                 | Client components     |
| `@retry/web3/config`      | Chains, env parsing, `createRetryWeb3Config`, `getRetryInitialState`, transports  | Server or client      |
| `@retry/web3/contracts`   | Contract registry (`NOT_DEPLOYED` everywhere today) and read-only helpers         | Server or client      |
| `@retry/web3/testing`     | `createMockEip1193Provider` and a mock connector for automated tests              | Tests only            |
| `@retry/web3/styles.css`  | Default styles, themable through `--rw3-*` CSS variables                          | Import once           |

## Quick start (Next.js App Router)

The full, verified wiring for the Stage 1 app is in [docs/web3/INTEGRATION_GUIDE.md](../../docs/web3/INTEGRATION_GUIDE.md). In short:

```ts
// src/config/web3.ts (server-safe)
import { createRetryWeb3Config, parseRetryWeb3Env } from '@retry/web3/config'

// Next.js only inlines NEXT_PUBLIC_* variables read by their full literal name.
export const retryWeb3Env = parseRetryWeb3Env({
  defaultChain: process.env.NEXT_PUBLIC_DEFAULT_NETWORK,
  baseMainnetRpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  baseSepoliaRpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
})

export function makeRetryWeb3Config() {
  return createRetryWeb3Config({ env: retryWeb3Env, app: { name: 'RETRY' }, ssr: true, storage: 'cookie' })
}
```

```tsx
// src/components/providers.tsx
'use client'
import { RetryWeb3Provider } from '@retry/web3'
import { useState, type ReactNode } from 'react'
import { makeRetryWeb3Config } from '@/config/web3'

export function Providers({ children }: { children: ReactNode }) {
  const [config] = useState(makeRetryWeb3Config)
  return <RetryWeb3Provider config={config}>{children}</RetryWeb3Provider>
}
```

```tsx
// header
import { ConnectWalletButton, NetworkIndicator } from '@retry/web3'

<NetworkIndicator />
<ConnectWalletButton />
```

`RetryWeb3Provider` creates the wagmi provider and a TanStack `QueryClient` (pass `queryClient` to reuse yours). App code should read wallet state through this package rather than importing `wagmi` hooks directly, so there is one source of truth (see the guide for why this matters with pnpm workspaces).

## Environment

Copy [.env.example](./.env.example). All four variables are optional.

| Variable                                | Default        | Notes                                                             |
| --------------------------------------- | -------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_DEFAULT_NETWORK`           | `base-sepolia` | `base-sepolia` or `base`. Anything else falls back with a warning |
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`      | public RPC     | https only (http allowed for localhost). Invalid values ignored   |
| `NEXT_PUBLIC_BASE_RPC_URL`              | public RPC     | Same rules                                                        |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`  | none           | 32 hex chars from dashboard.reown.com. Without it, WalletConnect is shown as not configured |

`parseRetryWeb3Env` validates the values and returns `warnings` that never echo the value itself (RPC URLs can contain API keys).

## Components

- `ConnectWalletButton`: `Connect Wallet` → wallet picker; once connected shows `0x84A2...3F91` (or `Wrong Network` in red) and opens the account menu: full address, Copy Address, network, ETH balance with refresh, explorer link, switch button when needed, Disconnect. On screens up to 480px the menu is a bottom sheet rendered into `<body>`, so headers with `backdrop-filter` or `transform` cannot clip it.
- `ConnectWalletModal`: EIP-6963 wallets (deduplicated with `window.ethereum`), MetaMask, Coinbase Wallet and WalletConnect, each with its availability.
- `NetworkIndicator`: live network pill (`Base Sepolia · Testnet`, `Base`, `Wrong Network`).
- `NetworkGuard`, `WrongNetworkNotice`, `SwitchNetworkButton`: gate a section on the right network. Switching only happens on click.
- `EthBalance`: `Balance: 0.0234 ETH` with loading, error and refresh states.

## Hooks

| Hook                        | Returns                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `useRetryWallet`            | Everything at once: status, address, `shortAddress`, connector, chain, explorer URL, network, balance |
| `useRetryConnectionStatus`  | `status`, `isConnected`, `isConnecting`, `isReconnecting`, `isDisconnected`                   |
| `useRetryNetwork`           | `scenario` (`disconnected`, `target`, `supported`, `wrong-network`), notice, `switchLabel`, `switchToTarget()`, switch status and error (also when the wallet undoes the switch) |
| `useRetryBalance`           | `status` (`disconnected`, `wrong-network`, `loading`, `success`, `error`), `value` (wei bigint), `formatted`, `exact`, `display`, `refetch()` |
| `useRetryWalletActions`     | `connect()`, `cancelConnect()`, `disconnect()`, `switchToTarget()`, `switchTo()`, pending connector and mapped errors |
| `useRetryWalletOptions`     | Wallet list for custom pickers                                                                |
| `useRetryWalletEvents`      | Callback on connect, disconnect, account change and network change                           |
| `useRetryDiagnostics`       | Config, connectors, announced wallets and an on-demand RPC health check                      |

Balances are `bigint` wei and are formatted with string arithmetic (`formatEth`, `formatTokenAmount`), never through `Number`. A failed read clears the value: no stale or estimated number is shown.

## Errors

`toRetryWeb3Error(error, { context })` maps wallet, RPC and viem errors to a `RetryWeb3Error` with a stable `code`, a short user-facing `message`, an optional `hint` and `retryable`. Examples: `Connection rejected. Please try again.`, `Please switch to Base Sepolia.`, `Unable to fetch your balance.`, `WalletConnect is not configured yet.` Raw provider messages are never shown to users.

## Contracts

`RETRY_CONTRACTS` lists `tokenFactory`, `bondingCurve`, `feeManager` and `liquidityMigrator` per network, all `NOT_DEPLOYED`. `getRetryContract(chainId, name)` throws `CONTRACT_NOT_DEPLOYED` until a reviewed address is added; `RETRY_ABIS` is empty on purpose. See [BASE_NETWORKS.md](../../docs/web3/BASE_NETWORKS.md#contracts) for how to register a deployment.

## Development

This package has its own toolchain (npm, Biome, Vitest) and does not depend on the app.

```bash
cd packages/retry-web3
npm ci
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # biome check .
npm test            # vitest run (jsdom, mock EIP-1193 wallet, mocked RPC)
npm run build       # dist/ with .d.ts and styles.css
```

The independent playground lives in [examples/web3-playground](../../examples/web3-playground) and has Playwright tests for desktop and mobile.

## Limits

- Automated tests use a simulated wallet and a mocked RPC. They prove the wiring, not real wallets. The manual checklist is in [WALLET_INTEGRATION.md](../../docs/web3/WALLET_INTEGRATION.md#manual-checklist-with-real-wallets).
- On page load wagmi tries to restore the previous session through each connector, which loads the MetaMask, Coinbase and (when configured) WalletConnect SDKs. See [WALLET_INTEGRATION.md](../../docs/web3/WALLET_INTEGRATION.md#known-trade-offs).
- No trading, token creation, signatures or transactions in this stage.
