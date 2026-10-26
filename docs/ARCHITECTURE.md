# RETRY — Architecture

## Runtime and composition

Next.js App Router with React, strict TypeScript and Tailwind 4. Server pages resolve the token provider and pass serializable fixtures to narrowly interactive client views. Radix Dialog supplies focus trapping, keyboard dismissal and accessible modal semantics. A small shadcn-style button primitive uses `clsx`/`tailwind-merge`; there is no large component framework. CSS transitions provide lightweight animation, with reduced-motion overrides. Recharts is loaded only on token detail views through a dynamic import.

Design tokens are in `src/app/globals.css`: charcoal background, dark surfaces, discreet borders, electric blue brand, occasional lime, independent positive/negative colors. The original cycling mark is supplied as SVG for full/compact contexts and favicon. Token illustrations are local original SVGs and do not require external image services or tracking. The system font stack keeps the build independent of external font downloads.

## Data flow

```mermaid
flowchart LR
  Page[App Router server page] --> Provider[TokenDataProvider interface]
  Provider --> Demo[Deterministic mock adapter]
  Page --> UI[Interactive React views]
  UI --> Query[TanStack Query]
  Query --> Provider
  Wallet[Wallet user action] --> Wagmi[Wagmi connectors]
  Wagmi --> RPC[Base RPC: native balance reads]
  Browser[Create form] --> Draft[Versioned browser-local draft]
  Indexer[Future Base indexer] -. replacement adapter .-> Provider
```

`TokenDataProvider` defines list/get/history/trades. All fixtures are typed and shared. IDs and fixture timestamps are fixed; relative ages use the same snapshot clock on client and server, avoiding hydration drift. Query keys include token ID/interval and identify the demo catalog. Adapter replacement must add provenance, chain identity, pagination and error handling before publishing real data.

The finite demo token pages are generated at build time with `generateStaticParams` and `dynamicParams = false`, giving unknown IDs a real HTTP 404 before streaming begins. When replacing the catalog with a live registry, revisit static generation and choose a network-aware caching/404 strategy instead of retaining this finite-list constraint.

Entities: Token, TokenMetadata, TokenMarketData, TokenLaunch, BondingCurveState, PricePoint, Trade and UserPortfolio. Demo references are intentionally not EVM addresses. A real explorer link is only rendered for a non-demo deployed address. A production provider should retain explicit network identity per token before multi-environment indexed data is added.

## Wallet boundaries

Wagmi 3, viem and TanStack Query support EIP-6963/injected discovery, Coinbase Wallet and optional WalletConnect. Wagmi configuration and QueryClient are created per provider instance, avoiding server request-shared cache/state. SSR mode and a hydration subscription keep connection-dependent UI stable on initial render. Base Sepolia is the default; chain definitions come from viem via `wagmi/chains`. Read transports are bounded with timeouts/retries; errors never substitute fixture balances.

The wallet menu supports connection, copying, disconnection and supported network switching. Accounts and chains follow connector events. No `sendTransaction`, `writeContract`, signing, allowance or swap execution is imported. `financialActionsEnabled` remains false; UI actions never reach a financial adapter.

The trade illustration uses a static fixture ratio, independent from demo USD prices. Slippage is UI configuration only. Fees, supply and graduation terms are unresolved. No formula in this code represents the future curve.

## Browser state and validation

Drafts use a versioned localStorage key with sanitized restoration and an in-memory fallback. Cross-tab storage notifications update subscribers; functional updates prevent late image uploads from overwriting newer text edits. Image uploads check size, MIME, signature, decoding and dimensions. Only raster data URLs produced from accepted files are previewed. A later upload API must repeat validation server-side, strip metadata, re-encode and serve through a constrained media origin. Current metadata is never uploaded or published.

## Future contracts and infrastructure

Future factory/ERC-20 contracts, curve reserves and trading execution must be specified and audited separately. Indexed events improve discovery but cannot authorize execution. Onchain balances, reserves and verified simulations must be reread before signing. Graduation should be an idempotent contract transition with a reviewed DEX adapter and explicit liquidity ownership/locking policy. No contracts or deployment keys are present now.

## Delivery and tradeoffs

ESLint 10 is used with Next.js 16.4, whose bundled official ESLint guide explicitly supports it. Some inherited React/accessibility/import plugins still declare legacy peer ranges, so pnpm reports peer warnings despite successful lint execution. TypeScript is pinned to 5.9 because the installed typescript-eslint stack does not support TypeScript 7. Revisit these version boundaries when upstream dependencies update.

GitHub Actions validates frozen-lockfile installation, formatting, lint, type generation/checking, unit tests and production build. No deployment platform is coupled to the repository. The site can run on any supported Next.js host; deployment was not part of this stage. No database or server mutations are needed for browser-local drafts and demo browsing. Wallet providers necessarily introduce optional third-party transport/UI dependencies; their licenses and runtime behavior need review before production. Only required build scripts are allowed by the pnpm workspace policy.
