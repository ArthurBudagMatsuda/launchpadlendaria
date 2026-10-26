# RETRY

Base-native memecoin discovery and launchpad foundation. Product name: **RETRY** (`retry.`); repository: `launchpadlendaria`.

![RETRY Discover desktop preview](docs/images/retry-discover.jpg)

## Stage 1

A complete English-language application, rather than a marketing page:

- Discover: 15 original fictional tokens, three launch stages, search, category and minimum-progress filters, and recent/volume/market-cap sorting.
- `/token/[id]`: consistent market fixtures, deterministic chart histories, intervals, area/line views, tooltips, demo activity and interactive Buy/Sell previews.
- `/create`: validated details, local image preview, live token preview, three steps and a versioned browser-local draft.
- `/portfolio`: wallet prompt, connected account/network, native ETH reads and explicit unindexed states for positions and history.
- Wallet menu: injected EVM wallets, Coinbase Wallet, optional WalletConnect, copying, disconnect and switching between Base Sepolia and Base.
- Original SVG brand and token illustrations, keyboard-accessible Radix dialogs, responsive layouts and reduced-motion support.

**No contract, swap, approval, signature, launch, fee collection or transfer is implemented.** All token markets, activities, prices and curve progress are labeled **Demo Data**. Demo tokens have a reference, not a fabricated contract address or explorer link. Native wallet balances are real RPC reads and are separated from the demo catalog. The trading estimate uses a fixed **illustrative** ratio of 250,000 tokens/ETH; it is unrelated to any market quote or bonding curve. Economic terms remain undecided.

## Run locally

Use Node.js 24 LTS and pnpm 11.25.0 (declared in `packageManager`). With pnpm installed:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The initial network is **Base Sepolia**. No environment variables or wallet are required to browse, search or create a local draft.

If pnpm is missing, install the version above using the [official installation guide](https://pnpm.io/installation). On the Codex workstation used for implementation, the bundled executable is `C:\Users\Rachel\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd`; it can run the same scripts from PowerShell.

```sh
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

`pnpm format` formats source and documentation. `node scripts/generate-assets.mjs` regenerates the original local SVG assets.

## Optional configuration

Copy `.env.example` to `.env.local` and restart the server when changing public values.

| Variable                               | Default / purpose                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_DEFAULT_NETWORK`          | `base-sepolia`; use `base` to start on mainnet, still read-only                  |
| `NEXT_PUBLIC_BASE_RPC_URL`             | Official viem Base RPC (`https://mainnet.base.org`)                              |
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`     | Official viem Base Sepolia RPC (`https://sepolia.base.org`)                      |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional [Reown project ID](https://dashboard.reown.com/); enables WalletConnect |

Every `NEXT_PUBLIC_` value is intentionally browser-visible. Use only public RPC endpoints/keys, with origin restrictions and appropriate quotas; never put private provider secrets in these fields. WalletConnect must allow your development/production origin. No private key, seed phrase or server credential is needed.

Base Mainnet: chain **8453**, ETH. Base Sepolia: chain **84532**, test ETH. Definitions come from `wagmi/chains` (viem). See [official Base network parameters](https://docs.base.org/get-started/connect-to-base) and [Wagmi connector documentation](https://wagmi.sh/react/api/connectors).

## Layout

```text
src/app/                  Next.js App Router pages and global design tokens
src/components/           UI primitives, layout, Discover, Trade, Create, Portfolio, wallet
src/config/               Supported chains and Wagmi configuration
src/data/                 Stable fictional catalog
src/hooks/                Wallet balance, hydration and browser-local draft
src/lib/                  Formatting, validation and class utilities
src/services/             Typed replaceable token data provider
src/types/                Token, market, launch, curve, trade, portfolio types
public/brand/             Original RETRY vectors
public/tokens/            Original token illustrations
tests/                    Catalog, determinism, validation and chain guard tests
docs/                     PRD, architecture, roadmap, decisions and verification
.github/workflows/ci.yml   Formatting, lint, types, tests and production build
```

## Images and drafts

Uploads remain in the browser, never on a server. Only PNG, JPEG and WebP up to 2 MB and 4096 × 4096 are accepted; MIME type, file signature and image decoding are checked. SVG/HTML/remote uploads are rejected. Metadata lengths, symbols and HTTPS/social domains are validated. Text is rendered through React without raw HTML.

Drafts use `retry:token-draft:v1` in localStorage. Browser storage is untrusted and sanitized when restored. Reset draft clears the working draft. If storage is unavailable/full, the draft stays in memory with a warning. Do not enter sensitive information into public token metadata. Wallet account/chain events are handled by Wagmi; native balance failures display an unavailable state, never a fabricated amount.

## GitHub

### Shared test website

- [RETRY application preview](https://arthurbudagmatsuda.github.io/launchpadlendaria/)
- [Stage 2 Web3 test bench](https://arthurbudagmatsuda.github.io/launchpadlendaria/web3/)
- [Preview build and deployment checks](https://github.com/ArthurBudagMatsuda/launchpadlendaria/actions/workflows/pages.yml)

The GitHub Pages workflow builds the application from `feat/etapa-1-foundation` and the independent wallet test bench from `feat/etapa-2-web3`. It is installed on both source branches and `main`; pushes to those branches rebuild the shared website after the application and Web3 package checks pass. Changes made only in a fork must first reach the corresponding branch in this repository to appear here. This publishes previews without merging the two unrelated source histories. `preview-version.txt` on the website records both source commits.

Pages is static hosting. Search query strings are handled in the browser; token pages are generated from the finite demo catalog. Images, favicon and routes include the repository path. No server-side API, onchain write or payment is enabled. Custom HTTP headers configured for Next.js server mode cannot be applied by GitHub Pages.

`pnpm build:pages` generates `out/` for the default `/launchpadlendaria` base path. Set `NEXT_PUBLIC_BASE_PATH` at build time only when deploying under a different path. Normal `pnpm build`/`pnpm start` still produce a Node-hosted application.

Development branch: `feat/etapa-1-foundation`.

Remote: [ArthurBudagMatsuda/launchpadlendaria](https://github.com/ArthurBudagMatsuda/launchpadlendaria).

CI runs on pushes and pull requests with read-only repository permissions. If pushing reports missing credentials, authorize Git Credential Manager (HTTPS) or `gh auth login`, then run `git push -u origin feat/etapa-1-foundation`. Never paste an access token into source, chat, or a remote URL. Existing local commits remain available if authentication fails. Initial automated commits use the explicit local identity `RETRY Development <dev@retry.local>` when no Git identity is configured.

## Known boundaries and next stage

No indexer, persistent backend, deployed contracts, financial operations, DEX integrations or real positions exist. The demo clock is intentionally fixed at 2026-10-26 15:00 UTC. Market cap and volume are USD fixtures. Public RPC endpoints may throttle; production needs a suitable provider. A configured connector is not evidence of a tested extension/mobile-wallet session: see [verification](docs/VERIFICATION.md).

Stage 2 should exercise actual wallets on Base Sepolia, cover rejection/account/chain/RPC scenarios with a dedicated browser wallet harness, configure production RPC and WalletConnect origins, and establish the indexed data contract before implementing financial contracts.
