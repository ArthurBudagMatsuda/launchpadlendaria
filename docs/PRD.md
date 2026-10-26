# RETRY — Product requirements

## Vision and audience

RETRY helps EVM communities discover and eventually launch and trade memecoins exclusively on Base. Its identity combines cycles, persistence and new beginnings, without promising financial outcomes. Initial users are community creators, explorers and experienced Base users. The interface is English; all writing distinguishes demonstration from execution.

## Stage 1 scope

1. Discover → search/filter/sort → token details. View simultaneous launch stages on desktop; on mobile use category controls or swipe explicitly contained columns.
2. Token details → chart interval/view → Buy/Sell amount/slippage controls. Output remains an illustration; action explains that execution is unavailable.
3. Create → validated token details and local image → preview → summary. Draft persists locally. Final launch is unavailable and no economic terms are asserted.
4. Wallet → connector → account and supported chain → real native ETH read. Copy/disconnect/switch are available. No signatures are requested.
5. Portfolio → connection prompt or connected overview → unindexed positions, created tokens and history. Missing integrations never imply a zero actual portfolio.

## Acceptance criteria

- Stable IDs and shared data between discovery/detail views; deterministic prices and no fabricated contract addresses.
- Search by name/ticker, combined category and curve-progress filters; three sorting modes and empty states.
- Responsive, keyboard-accessible interface with mobile navigation, visible focus and reduced-motion handling.
- Required metadata and uploads validated; HTTPS optional socials; backward/forward step navigation; live preview and browser-local drafts.
- Wallet failures and unavailable balances are visible; Base Mainnet/Sepolia are the only supported networks.
- TypeScript strict, formatting, ESLint, essential tests and production build pass; GitHub Actions runs the same checks.
- No transaction-writing code or financial contracts in the foundation.

## Future product areas

Indexed chain data, price history, factory launches, formally specified bonding curves, buy/sell execution, graduation/migration, actual portfolios and eventually advanced trading/community tools. Each area requires explicit source provenance and unavailable/error states. Blockchain state is authoritative for balances, executions, reserves and liquidity.

## Success measures

In Stage 1 evaluate task completion (find a token, adjust a chart, prepare a draft), error clarity, mobile usability and correctness of data provenance. Define production analytics/retention measures later, after data integration and privacy decisions. No fabricated growth or trading metrics.

## Non-goals

Financial execution, custody, passwords, backend complexity, platform revenue, extensive social systems and any mainnet deployment. Simulated token metrics are examples rather than product/economic commitments.
