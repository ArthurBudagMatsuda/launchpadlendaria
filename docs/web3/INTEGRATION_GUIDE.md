# Integrating @retry/web3 into the RETRY app

For whoever wires Stage 2 into the Stage 1 Next.js app (`feat/etapa-1-foundation`). Stage 2 does not touch any Stage 1 file; this guide lists the exact changes instead.

> **Applied.** These steps were applied on `feat/retry-frontend-web3-integration` (the patch unchanged, then extended): see [the integration report](../reports/RETRY_FRONTEND_WEB3_INTEGRATION_REPORT.md). Two points below no longer hold there: section 10 (the app and the module now resolve to one wagmi copy, thanks to a `use-sync-external-store` override in `pnpm-workspace.yaml`) and section 11 (the module and the playground install from the pnpm workspace; their npm lockfiles were removed). Keep this guide as the record of what the patch does.

## Status

The steps below were applied to a local copy of `feat/etapa-1-foundation` at `2c8a156` (the GitHub Pages commit) plus this branch's `packages/retry-web3`, and checked there:

- `pnpm install`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (20 tests), `pnpm build` (Next.js 16.4.3, Turbopack; routes stay static) and `pnpm build:pages` (static export) all pass.
- Playwright against `next start`, desktop and Pixel 7: the server renders `Connect Wallet` and hydrates with no warnings; connecting in the Stage 1 header works; Discover's own `useQuery` keeps working under the new provider; Portfolio shows the live balance, the Wrong Network state and the switch; the trade panel reads the balance; the account menu opens fully on screen as a bottom sheet on mobile; reload restores the session in both layout variants below.

The whole change is in [etapa-1-integration.patch](./etapa-1-integration.patch). After both branches are merged it should apply with `git apply docs/web3/etapa-1-integration.patch` as long as those Stage 1 files have not changed since `2c8a156`; otherwise follow the steps by hand. Then run `pnpm install` to update `pnpm-lock.yaml` (the patch does not include the lockfile).

## What happens if you merge without these steps

Merging both branches and changing nothing else breaks the Stage 1 CI, because the root tools pick up the module's files:

- `pnpm format:check` flags dozens of module files (the module is formatted by Biome with its own style).
- `pnpm typecheck` fails on the module tests (`@testing-library/react` is not a root dependency) and would fail on the playground (`@retry/web3` path alias).
- `pnpm lint` is clean on the module source now, but it is still owned by Biome, not the app's ESLint.

Step 2 fixes that.

## 1. Workspace and dependencies

`pnpm-workspace.yaml`:

```yaml
packages:
  - .
  - packages/retry-web3
allowBuilds:
  # existing entries…
  # Pulled in by the MetaMask SDK (@metamask/connect-evm); its postinstall is not needed.
  protobufjs: false
```

Without the `protobufjs` entry pnpm 11 stops the install with `ERR_PNPM_IGNORED_BUILDS`.

`package.json`:

```jsonc
"scripts": {
  "dev": "pnpm web3:build && next dev --hostname 127.0.0.1",
  "build": "pnpm web3:build && next build",
  "build:pages": "pnpm web3:build && node scripts/build-pages.mjs",
  "typecheck": "pnpm web3:build && next typegen && tsc --noEmit",
  "web3:build": "pnpm --filter @retry/web3 build"
},
"dependencies": {
  "@metamask/connect-evm": "^2.1.0",
  "@retry/web3": "workspace:*"
  // wagmi, viem, @tanstack/react-query, @coinbase/wallet-sdk and
  // @walletconnect/ethereum-provider are already there and satisfy the peer ranges
}
```

The app consumes the built `dist/` (JavaScript plus `.d.ts`), so the module is built before `dev`, `build` and `typecheck`. `next.config.ts` needs no change: the package ships ESM with `'use client'` directives preserved, so `transpilePackages` is not required.

## 2. Keep the root tools off the module

The module has its own TypeScript, Biome and Vitest setup and its own CI job.

```jsonc
// tsconfig.json
"exclude": ["node_modules", "packages", "examples"]
```

```js
// eslint.config.mjs
globalIgnores([".next/**", "next-env.d.ts", ".qa/**", "packages/**", "examples/**"]),
```

```text
# .prettierignore
packages/retry-web3
examples
```

## 3. One config for server and client

New file `src/config/web3.ts` (no `'use client'`; `@retry/web3/config` is server-safe):

```ts
import { createRetryWeb3Config, parseRetryWeb3Env } from "@retry/web3/config";

// Next.js only inlines NEXT_PUBLIC_* variables read by their full literal name.
export const retryWeb3Env = parseRetryWeb3Env({
  defaultChain: process.env.NEXT_PUBLIC_DEFAULT_NETWORK,
  baseMainnetRpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  baseSepoliaRpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
});

/** Same config on the server (cookie → initial state) and in the browser. */
export function makeRetryWeb3Config() {
  return createRetryWeb3Config({
    env: retryWeb3Env,
    app: { name: "RETRY", description: "A new beginning on Base." },
    ssr: true,
    storage: "cookie",
  });
}
```

The variable names are the ones Stage 1 already documents in its `.env.example`; nothing to add there.

## 4. Provider

In `src/components/providers.tsx` replace `WagmiProvider` + `QueryClientProvider` with `RetryWeb3Provider`, and drop `walletOpen`, `setWalletOpen`, `selectedChainId` and `setSelectedChainId` from `AppContext` (the module owns the wallet modal and the network now):

```tsx
import { RetryWeb3Provider, type RetryWeb3ProviderProps } from "@retry/web3";
import { makeRetryWeb3Config } from "@/config/web3";

export function Providers({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: RetryWeb3ProviderProps["initialState"];
}) {
  const [config] = useState(makeRetryWeb3Config);
  // notices / notify unchanged
  return (
    <RetryWeb3Provider config={config} initialState={initialState}>
      <AppContext.Provider value={{ notify }}>
        {children}
        {/* toasts unchanged */}
      </AppContext.Provider>
    </RetryWeb3Provider>
  );
}
```

`RetryWeb3Provider` also provides the TanStack `QueryClient` used by Discover and the token terminal. Pass `queryClient={…}` if the app wants its own defaults.

## 5. Layout

Import the module styles once, before `globals.css` so the app can override them:

```tsx
import "@retry/web3/styles.css";
import "./globals.css";
```

That is all the patch does, which keeps `/create`, `/portfolio` and the token pages static. Returning users briefly see `Connect Wallet` until the browser restores the session (the same behaviour Stage 1 has today with `useMounted`).

**Optional, no flash:** read the wagmi cookie on the server.

```tsx
import { headers } from "next/headers";
import { getRetryInitialState } from "@retry/web3/config";
import { makeRetryWeb3Config } from "@/config/web3";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialState = getRetryInitialState(
    makeRetryWeb3Config(),
    (await headers()).get("cookie"),
  );
  return (
    <html lang="en">
      <body>
        <Providers initialState={initialState}>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
```

The header is then server-rendered with the connected address, but reading headers makes **every route dynamic** (verified on `0d156f0`: the build lists all routes as `ƒ`), and it cannot be used with the static GitHub Pages export (`output: "export"` has no request headers). Both variants passed the hydration tests; the patch uses the static one.

## 6. Header

`src/components/layout/header.tsx`: replace the network button and `WalletButton`, and remove `<WalletMenu />`:

```tsx
import { ConnectWalletButton, NetworkIndicator } from "@retry/web3";

<NetworkIndicator className="network-button" />
<ConnectWalletButton className="wallet-button" />
```

The `useApp`, `useConnection`, `useMounted` and `ChevronDown` imports become unused. The header's `backdrop-filter` is fine: on screens up to 480px the account menu is portaled to `<body>` as a bottom sheet.

## 7. Pages

- **Portfolio** (`src/components/portfolio/portfolio.tsx`): `const wallet = useRetryWallet()` replaces `useConnection`, `useWalletBalance` and `useMounted`. Use `ConnectWalletButton align="start"` for the empty state, `wallet.networkName` and `SwitchNetworkButton` when `wallet.network.isWrongNetwork`, `wallet.balance.display` for the balance (states: `loading`, `success`, `wrong-network`, `error`), `wallet.network.notice?.message` for the strip, and `balance.refetch()` for retry.
- **Trade panel** (`src/components/trade/trade-panel.tsx`): `useRetryBalance()`; label `Balance: ${balance.display}` when `status === "success"`. This also removes the `Number(formatEther(…)).toFixed(4)` float conversion.
- **Create Token**: no change in this stage. When launching is implemented, wrap the final action in `<NetworkGuard requireTarget>` so it only renders on the target network.
- Prefer `<NetworkGuard>` around any future section that needs the wallet on Base.

## 8. Delete

`src/components/wallet/wallet-button.tsx`, `src/hooks/use-wallet-balance.ts`, `src/config/wagmi.ts` and `src/hooks/use-mounted.ts` (no remaining users). Keep `src/config/networks.ts`: the Stage 1 tests import it. Its `financialActionsEnabled` and `isSupportedChain` can later re-export `RETRY_FINANCIAL_OPERATIONS_ENABLED` and `isSupportedChainId` from `@retry/web3/config`.

## 9. Theme

The module reads `--rw3-*` CSS variables declared with zero specificity, so the app can map them to its tokens in `globals.css`:

```css
:root {
  --rw3-font: inherit;
  --rw3-surface: var(--panel);
  --rw3-surface-raised: var(--panel-hover);
  --rw3-border: var(--border);
  --rw3-text: var(--color-foreground);
  --rw3-muted: var(--muted);
  --rw3-accent: var(--blue);
  --rw3-success: var(--green);
  --rw3-danger: var(--red);
  --rw3-radius: var(--radius);
  --rw3-shadow: var(--shadow);
}
```

Every component also accepts `className` (and `panelClassName` for the modal and menu) for local overrides.

## 10. One copy of wagmi in the bundle

pnpm installs the module's own dev copies of `wagmi` and `viem` under `packages/retry-web3/node_modules`, and the built module resolves them from there. React and TanStack Query resolve to a single copy (verified with `pnpm why`), which is what matters for contexts. To keep it that way:

- Import wallet state, network and balances from `@retry/web3`, not from `wagmi` hooks. A wagmi hook imported by the app could resolve to the root copy and fail with `WagmiProviderNotFoundError`. Optionally enforce it with ESLint `no-restricted-imports` for `wagmi` in `src/`.
- When bumping `@tanstack/react-query`, `@coinbase/wallet-sdk`, `wagmi` or `viem`, bump the module's `devDependencies` to the same versions, then check `pnpm why @tanstack/react-query` still reports one version.
- `viem` utilities and types (`Address`, `formatUnits`) are stateless and safe to import directly.

## 11. CI

The root `RETRY quality checks` workflow keeps working: `pnpm typecheck` and `pnpm build` now build the module first. The module's own checks (typecheck, Biome, Vitest, build) and the playground's Playwright tests run in `.github/workflows/retry-web3.yml`, only when `packages/retry-web3/**`, `examples/web3-playground/**` or that workflow change.

The shared `Publish RETRY test preview` workflow publishes the playground at <https://arthurbudagmatsuda.github.io/launchpadlendaria/web3/>. On the stage branches it still builds it from `feat/etapa-2-web3` and passes `VITE_DEFAULT_CHAIN`, a name the playground ignores (the value is the default anyway). On `main`, after the integration (PR #2), the workflow builds the app and the playground from `main` and passes `VITE_DEFAULT_NETWORK`.

Note that Stage 1 requires Node 24 (`engines`) and its CI uses Node 24; the module supports Node 22.12 and later.
