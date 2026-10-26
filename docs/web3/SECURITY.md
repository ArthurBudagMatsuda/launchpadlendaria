# Web3 security

Stage 2 connects wallets and reads public chain data. It cannot move funds. This page lists the rules the module follows, how they are enforced, and what to keep in mind when later stages add transactions.

## Rules for this stage

| Rule                                            | How it is enforced                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Never ask for a seed phrase or private key      | No input, prompt or API for them. The connect modal says so: "RETRY never asks for your seed phrase or private key." `privateKeyToAccount`, `mnemonicToAccount` and friends are banned by `test/security.test.ts`.                                                                                                                                                       |
| Never store wallet credentials                  | The module writes no storage itself (the test bans `localStorage.setItem`, `sessionStorage.setItem` and `document.cookie =` in `src`). wagmi stores public connection state only (see below).                                                                                                                                                                            |
| No transactions, signatures or approvals        | `RETRY_FINANCIAL_OPERATIONS_ENABLED = false`. The security test fails on `sendTransaction`, `sendCalls`, `writeContract`, `deployContract`, `simulateContract`, `signMessage`, `signTypedData`, `personal_sign`, `approve(`, `maxUint256` and their hooks. A Playwright test records every request the page sends to the wallet and asserts none of them signs or sends. |
| No unlimited token approvals                    | Nothing approves anything. When approvals arrive, request the exact amount, show it, and never default to `maxUint256`.                                                                                                                                                                                                                                                  |
| No unknown contract treated as trusted          | No contract address exists in the source (a test rejects any 40-hex literal outside the test helpers). `getRetryContract` throws `CONTRACT_NOT_DEPLOYED` until a reviewed deployment is registered, and the registry validator rejects malformed, zero and duplicated addresses.                                                                                         |
| The connected account can change at any time    | Hooks read address and chain from wagmi on every render; nothing caches them. Query keys include address and chain, so data from a previous account is never shown. `useRetryWalletEvents` lets pages reset per-account state.                                                                                                                                           |
| Validate chain and address before using data    | Balances are only read when the chain is 8453 or 84532 and the address is a valid checksummed EVM address. Explorer helpers return `undefined` for anything else. Contract helpers validate both.                                                                                                                                                                        |
| No automatic network switch                     | Switching is only triggered by a click on `Switch to …`. Connecting does not pass a chain ID.                                                                                                                                                                                                                                                                            |
| No secrets in public variables                  | The only inputs are `NEXT_PUBLIC_*` values, which are public by definition: network name, RPC URLs and the WalletConnect project ID. `.env.example` files say so.                                                                                                                                                                                                        |
| No sensitive data in logs                       | Diagnostics are off by default (`debug` prop / `setRetryWeb3Debug`). When on, URLs are reduced to their origin and config warnings never include values.                                                                                                                                                                                                                 |
| Estimates are not presented as confirmed values | The only number shown is the on-chain balance. On RPC failure it is removed, not estimated. The Stage 1 trade preview keeps its "fixture ratio" disclaimer.                                                                                                                                                                                                              |
| No real money movement                          | See the first three rows. Base Sepolia is the default network.                                                                                                                                                                                                                                                                                                           |

## What wagmi stores in the browser

With `storage: 'cookie'` (the Next.js setup) wagmi writes `retry.wagmi.*` cookies: the serialized connection state (connector id and name, chain id, and the connected **public** addresses) and the id of the last connector used. With `storage: 'local'` the same goes to `localStorage`. No key, seed, signature or session secret is stored by RETRY or wagmi. The cookie is readable by the server, which only uses it to render the header; it is not used for authentication and must never be treated as proof of address ownership (that would need a signed message, which is out of scope).

Wallet SDKs keep their own state outside RETRY's control: the MetaMask SDK and WalletConnect store relay session keys in `localStorage`, and the Coinbase SDK stores its popup session. Those follow each SDK's own lifecycle and are not read by RETRY.

## RPC endpoints

Custom RPC URLs often contain an API key. Because they are `NEXT_PUBLIC_`, anyone can read them from the bundle. Restrict the key to RETRY's domains and set usage limits in the provider dashboard. Only `https` URLs are accepted (plain `http` only for localhost), and URLs with embedded credentials (`user:pass@`) are rejected.

## Third-party content

Wallet names and icons come from the wallets themselves (EIP-6963). Icons are rendered only through `<img>` and only when they are `data:image/…` or `https://` URLs; names are rendered as text. No HTML from a wallet or RPC is ever injected (the security test bans `dangerouslySetInnerHTML` and `innerHTML =`).

## Content Security Policy

The Stage 1 app sets `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`. If a CSP is added later, allow at least:

- `connect-src`: the RPC origins in use (`https://sepolia.base.org`, `https://mainnet.base.org`, custom providers), `wss://relay.walletconnect.com`, `wss://relay.walletconnect.org`, `https://*.walletconnect.com`, `https://*.walletconnect.org`, `https://*.reown.com`, the MetaMask SDK relay used by `@metamask/connect-evm`, and `https://*.coinbase.com`.
- `frame-src`: `https://verify.walletconnect.com`, `https://verify.walletconnect.org` and `https://keys.coinbase.com` (Smart Wallet popup).
- `img-src`: `data:` for EIP-6963 icons.

Verify the exact hosts against each SDK's documentation when the CSP is written; they change between versions.

## Before enabling transactions (future stages)

- Simulate every write and show the decoded effect before the wallet prompt.
- Show amounts from the simulation, label any quote as an estimate, and confirm only from a mined receipt.
- Re-check `chainId` and the account right before asking for a signature, and abort if either changed.
- Request exact approvals, never unlimited.
- Use typed ABIs generated from the audited contracts and register addresses through the registry only.
- Add EIP-4361 (Sign-In with Ethereum) with a server nonce before any server-side action depends on an address.
- Update `test/security.test.ts` deliberately, in the same pull request that adds the capability, with a review.

## Reporting

If you find a security problem in RETRY's Web3 code, contact the repository owner privately instead of opening a public issue.
