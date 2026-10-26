# Wallet integration

How `@retry/web3` connects EVM wallets, what it has been tested against, and what still needs a person with a real wallet.

## Supported wallets

| Wallet                         | Connector (wagmi id)                                              | Desktop                                                                                  | Mobile                            |
| ------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------- |
| Browser wallets (EIP-6963)     | one per announced wallet (its `rdns`)                             | Rabby, Brave, Phantom, Trust, etc. appear by name with their own icon                    | In-app browsers of mobile wallets |
| MetaMask                       | `metaMaskSDK` (`@metamask/connect-evm`)                           | Uses the extension when installed, otherwise a QR code for MetaMask Mobile               | Deep link to the MetaMask app     |
| Coinbase Wallet / Smart Wallet | `coinbaseWalletSDK` (`@coinbase/wallet-sdk`, `preference: 'all'`) | Extension when installed, otherwise the Coinbase popup (Smart Wallet or mobile app)      | Coinbase Wallet app               |
| WalletConnect                  | `walletConnect` (only with a valid project ID)                    | QR code modal                                                                            | Wallet list / deep link           |
| Legacy injected                | `injected` (`shimDisconnect: true`)                               | Only shown when `window.ethereum` exists and no wallet announced itself through EIP-6963 | Same                              |

A wallet is never listed twice: wagmi skips an EIP-6963 announcement whose `rdns` belongs to a dedicated connector (MetaMask `io.metamask`, Coinbase `com.coinbase.wallet`), and the generic "Browser Wallet" entry is hidden as soon as any wallet announces itself. Without WalletConnect configuration the picker shows a disabled `WalletConnect · WalletConnect is not configured yet.` row and no relay connection is opened.

The picker labels each entry `Detected`/`Installed` (extension found), `Available` (SDK popup, QR or deep link) or `Unavailable` (not configured), and puts detected wallets first. When no browser wallet exists on desktop it links to metamask.io.

## Connection lifecycle

1. **Connect.** The user picks a wallet; the button shows `Connecting…` and the row a spinner. A rejection in the wallet shows `Connection rejected. Please try again.`; a missing extension `No compatible wallet found…`; an already open prompt `A request is already open in your wallet…`. The modal closes itself once wagmi reports `connected`. Connecting does not pass a chain ID, so it never triggers a network switch.
   - **A wallet that never answers.** Some wallets close their prompt without answering the request. Phantom does this when the selected account is Solana-only: it shows "unsupported account" and drops the request, and wagmi would stay in `connecting` forever. For browser-extension wallets (EIP-6963 or `window.ethereum`), when the page gets focus back from the wallet's window and the request is still open 1.5 s later, the module stops waiting and shows `Your wallet didn't confirm the connection. Make sure it is unlocked with an Ethereum (EVM) account selected, then try again.` `Cancel` and closing the picker also stop waiting (`cancelConnect()`). If the user approves in the wallet afterwards, the connection is still recorded. Wallets that run in their own popup or QR modal (Coinbase, MetaMask SDK, WalletConnect) report a closed window as a rejection themselves.
2. **Session.** wagmi keeps the connection in the `retry.wagmi.*` cookies (connector id, chain id and the public account list; nothing secret). On the next visit `reconnectOnMount` restores it silently. In Next.js the server can read the cookie to render the connected header immediately (see the integration guide).
3. **Changes made in the wallet.** `accountsChanged` and `chainChanged` update every hook on the next render: the address, the balance query (its key includes address and chain, so the old account's balance is never shown) and the network scenario. `useRetryWalletEvents` reports `account-changed` and `network-changed` so pages can drop per-account state such as a half-filled form.
4. **Disconnect.** From the menu, or from the wallet (revoking the site or locking it). Both clear the UI. For injected wallets wagmi also sends `wallet_revokePermissions` where the wallet supports it, so the wallet forgets the site.

The address is never cached outside wagmi: components read it on every render and must not assume it is the same account as a moment ago.

## Network scenarios

| Scenario          | When                                                       | UI                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `target`        | Wallet on the target network (Base Sepolia in development) | Address in the button, green dot, `Testnet` tag on Sepolia, balance shown                                                                           |
| B `supported`     | Wallet on the other Base network                           | Works read-only with a notice (Base Mainnet: "read-only, trading not enabled yet")                                                                  |
| C `wrong-network` | Any other chain                                            | Red `Wrong Network` button and pill, "Your wallet is on Ethereum. Please switch to Base Sepolia.", `Switch to Base Sepolia` button, no balance read |

Switching only happens when the user clicks the switch button. A rejected switch shows `Network switch rejected. Please switch to Base.` and leaves everything as it was. If the wallet does not know Base Sepolia, wagmi asks the wallet to add it. `NetworkGuard` wraps sections (for example the trade panel) and renders the connect or switch prompt instead of the children until the wallet is ready.

## Balance

`useRetryBalance` reads the native ETH balance of the connected address on the wallet's active Base network through the app's RPC transports: no wallet prompt, no signature. States: `disconnected`, `wrong-network`, `loading`, `success`, `error`. Values are `bigint` wei and are formatted with string arithmetic (truncated to 4 decimals, `<0.0001` for dust, full precision in `exact`). On error the value is cleared and `Unable to fetch your balance.` is shown with a refresh button; there is no fallback or estimated number. Polling is every 30 s while the tab is visible.

## WalletConnect setup

1. Sign in at <https://dashboard.reown.com> (WalletConnect Cloud is now Reown) and create a project of type AppKit / WalletKit for the web.
2. Copy the **Project ID** (32 hex characters) into `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. It is public by design.
3. In the project settings add the allowed domains: `localhost` for development, the preview domains and the production domain. Requests from other origins are refused by the relay.
4. Restart the dev server. The picker now shows `WalletConnect · Scan QR code with a mobile wallet`.

An invalid ID is ignored with a configuration warning (visible in the playground's diagnostics card) instead of breaking the app.

## Known trade-offs

- **SDKs load on page load.** wagmi's reconnect asks every configured connector whether it has a session, which loads the MetaMask and Coinbase SDKs (and WalletConnect when configured) on first render instead of on click. This costs bundle and startup time but is what makes silent session restore work for SDK wallets. If startup becomes a problem, the alternative is `reconnectOnMount={false}` plus a targeted `reconnect({ connectors: [lastUsed] })`; it was prototyped and left out because the provider then resets connections on re-render.
- **MetaMask SDK dependency.** `@metamask/connect-evm` pulls `protobufjs`, whose install script is not needed. In the pnpm workspace mark it `protobufjs: false` under `allowBuilds`.
- **Coinbase `preference: 'all'`** offers both Smart Wallet (passkey popup) and the Coinbase Wallet app/extension. Use `'eoaOnly'` if Smart Wallet should not be offered.
- **MetaMask flags the GitHub Pages preview domain.** On 2026-10-26 MetaMask showed "Malicious — flagged as unsafe" for `arthurbudagmatsuda.github.io` on its connect screen. The flag is on the domain, not on anything the app requests: the app only asks for the connection. For tests, continue with an account that only holds testnet ETH (and reject any signature or transaction prompt; the app never sends one), or run the playground on `localhost`. Before launch, serve RETRY from its own domain and ask MetaMask to review the domain if it is still flagged (dispute link on the warning, or an issue at github.com/MetaMask/eth-phishing-detect).
- **Mobile.** Inside a wallet's in-app browser the injected provider is used directly. In a normal mobile browser MetaMask and Coinbase use deep links, and WalletConnect its modal. These paths cannot be automated here.

## What has been verified

| Check                                                                                                                                   | How                                                                                                                                                                                                           | Status                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Connect, reject, disconnect, wrong network, switch, rejected switch, wallet-side account and chain changes, session end, reload restore | Vitest with a mock EIP-1193 provider; Playwright with an EIP-6963 mock wallet on desktop and Pixel 7                                                                                                          | Passing                                                              |
| Balance read, formatting, loading and error states, RPC failure and recovery                                                            | Mocked JSON-RPC (including Multicall3)                                                                                                                                                                        | Passing                                                              |
| No `eth_sign`, `personal_sign`, `eth_signTypedData*`, `eth_sendTransaction` calls                                                       | Playwright records every wallet request; a source scan test bans the APIs                                                                                                                                     | Passing                                                              |
| SSR and hydration in Next.js 16 App Router, with and without cookie initial state                                                       | The Stage 1 app integrated in a local copy, `next build` + Playwright                                                                                                                                         | Passing (local copy, not merged)                                     |
| Real Base Sepolia RPC                                                                                                                   | Balance read from the public `sepolia.base.org` in Iam's browser on the `/web3/` preview, 2026-10-26                                                                                                          | Passed                                                               |
| Real Base Mainnet RPC                                                                                                                   | Not reachable from the build environment                                                                                                                                                                      | **Pending**                                                          |
| Phantom extension on the `/web3/` playground preview, Solana-only account selected                                                      | Real wallet, by Iam on 2026-10-26                                                                                                                                                                             | Found the stuck `connecting` state, fixed since; **re-test pending** |
| Phantom extension with an EVM account on the `/web3/` playground preview                                                                | Real wallet, by Iam on 2026-10-26: listed through EIP-6963 (`app.phantom`), connected `0x107A…88A8`, Base Sepolia detected as the target network, disconnect and reconnect, ETH balance read from chain 84532 | Passed                                                               |
| Phantom extension with an EVM account on the Stage 1 preview (`/create/`)                                                               | Real wallet, by Iam on 2026-10-26: connected on Base Sepolia, ETH balance shown. Stage 1's own wallet code, not this module                                                                                   | Passed (Stage 1 app)                                                 |
| A wallet that never answers: stop waiting when focus returns, on Cancel and on closing the picker; a late approval still connects       | Vitest and Playwright with a mock wallet that holds the request                                                                                                                                               | Passing                                                              |
| MetaMask extension on the `/web3/` playground preview                                                                                   | Real wallet, by Iam on 2026-10-26: listed once, connect prompt opens, but MetaMask flags the `github.io` domain as malicious (see Known trade-offs)                                                           | **Pending** (connect not completed yet)                              |
| Real Coinbase Wallet, Rabby, WalletConnect                                                                                              | Needs a person with the wallets                                                                                                                                                                               | **Pending**                                                          |

## Manual checklist with real wallets

Run on the Next.js app (`pnpm dev`) or the playground (`examples/web3-playground`, `npm run dev`) with `NEXT_PUBLIC_DEFAULT_NETWORK=base-sepolia`, a wallet holding a little Base Sepolia ETH and the browser devtools open. Note the wallet, version, browser and OS for each run.

**MetaMask extension (Chrome or Firefox)**

- [ ] Picker shows MetaMask as `Installed` once, with its own icon.
- [ ] Connect → MetaMask prompt → header shows `0x1234...abcd` matching the account in MetaMask.
- [ ] Reject the prompt → `Connection rejected. Please try again.`, button back to `Connect Wallet`.
- [ ] Balance matches MetaMask and <https://sepolia.basescan.org> for the address.
- [ ] Switch MetaMask to Ethereum Mainnet → red `Wrong Network`; click `Switch to Base Sepolia` → prompt → back to normal. Reject once → error shown, nothing switched.
- [ ] Remove Base Sepolia from MetaMask, click switch → MetaMask offers to add it.
- [ ] Change account in MetaMask → address and balance update without reload, copied state resets.
- [ ] Reload → still connected, no `Connect Wallet` flash when the cookie variant is used.
- [ ] Disconnect from the menu → disconnected; reload → stays disconnected.
- [ ] Disconnect the site from MetaMask's connected sites → app shows disconnected.
- [ ] Network tab: no request asks for a signature or transaction; RPC calls go to the configured endpoints only.

**Coinbase Wallet extension and Smart Wallet popup**

- [ ] With the extension: connects, shows the right address and balance.
- [ ] Without the extension: popup opens; creating or using a Smart Wallet connects; closing the popup reports a rejection.

**Rabby, Phantom or another EIP-6963 wallet**

- [ ] Listed by its own name and icon, not as "Browser Wallet", and only once.
- [ ] Connect, switch and disconnect behave as above.
- [ ] Close the wallet's window without answering → within a couple of seconds the picker shows `Your wallet didn't confirm the connection…` and the wallet card is `disconnected`, not stuck on `Connecting…`.
- [ ] Phantom with a Solana-only account selected → same message; switch Phantom to an account with an Ethereum address and connect again.

**WalletConnect** (with a project ID and the domain allowed)

- [ ] QR modal opens; scanning with a mobile wallet connects; the session survives a reload.
- [ ] Disconnecting from the phone disconnects the app.
- [ ] Without a project ID the row is disabled and no request goes to `relay.walletconnect.*`.

**Mobile**

- [ ] MetaMask Mobile in-app browser: connects, switch works.
- [ ] Safari/Chrome on a phone: MetaMask deep link and Coinbase app link open the apps and return.
- [ ] The account menu opens as a bottom sheet fully on screen; no sideways scrolling.

**RPC**

- [ ] With a custom RPC URL, requests go there first; break the URL → reads fall back to the public RPC.
- [ ] Offline (devtools) → friendly error, refresh works once back online.

## Not implemented in this stage

Signatures (including Sign-In with Ethereum), transactions of any kind, token approvals, token creation, bonding curve trades, ERC-20 balance listing in the UI, ENS or Basenames, multi-account selection inside the app, and any contract deployment. The contract registry and read helpers are ready for when audited contracts exist.
