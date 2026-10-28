# RETRY — Verification record

## User story and boundaries

Discover → typed local token adapter → consistent token details/chart; Create → validation → local draft/preview/summary; Portfolio → wallet state → real native RPC balance or explicit unavailable state. This stage has no API mutations, database or financial contract layer.

## Automated checks

The repository provides `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`. The unit suite covers catalog identity, search/category combinations, sorting without mutation, detail consistency, deterministic price histories, missing-token behavior, Base-only definitions, disabled financial actions, metadata constraints, safe image data/signatures, HTTPS social URLs and untrusted draft restoration.

Final local execution: ESLint passed with zero warnings, route type generation and strict TypeScript passed, both test files passed (**17 tests**) and Next.js production build succeeded for all application routes. Formatting was applied and checked separately. The workflow is configured for GitHub Actions; its hosted run is distinct from these local results.

## Browser checks

Verified on October 26, 2026 through the in-app browser at desktop 1440 × 1000 and mobile 390 × 844:

| Boundary / flow                | Result and observed evidence                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Discover search                | `capy` returns one Capy Collective card                                                                                             |
| Combined filters / empty state | Graduated + `capy` returns zero cards and a helpful empty state                                                                     |
| Volume ordering                | Graduated order: Second Chance, Out of Office, Ghost Mode, Mushroom Internet, Good Morning                                          |
| Minimum curve progress         | 80% filter returns eight tokens; resetting restores the catalog                                                                     |
| Card → detail                  | Orbit Cat card opens the same token, market cap and description                                                                     |
| Chart interactions             | 4H selection and Area → Line update the displayed chart                                                                             |
| Buy / Sell controls            | 0.1 ETH shortcut shows 25K illustrative ORBIT; Sell 10K shows 0.040000 illustrative ETH; slippage changes to 3%                     |
| Disabled financial execution   | Trade action displays a coming-soon notice; launch summary’s final action is disabled                                               |
| Clipboard                      | Copying the token reference reads back exactly `DEMO-ORBIT-001` with a visible confirmation                                         |
| Required-field validation      | Empty form shows four field-specific errors                                                                                         |
| Image validation               | SVG rejected with raster-only message; original test PNG accepted and previewed                                                     |
| Creation steps                 | Details → Preview → Summary, then back twice, preserves the draft; economic terms remain unresolved                                 |
| Draft persistence              | Reload restores `Orbit QA`, normalized `ORBIT`, description and PNG preview                                                         |
| Portfolio without wallet       | Connection invitation shown; no fabricated positions                                                                                |
| Wallet selector                | Injected and Coinbase choices shown; WalletConnect identified as unconfigured                                                       |
| Missing wallet                 | Browser connector produces the expected no-wallet-installed notice                                                                  |
| Network selector               | Selecting Base changes its pressed state; Base Sepolia restored afterward                                                           |
| Mobile navigation              | Menu opens, navigates and closes; category selection shows five graduated tokens                                                    |
| Responsive width               | Document width never exceeds the 390px viewport on Discover, Trade, Create and Portfolio; boards/tables contain their own scrolling |

An initial SSR hydration warning exposed engine-level floating-point string differences in SVG sparklines. Coordinates were rounded to two decimals; subsequent reloads and navigation produced no new hydration warnings in the captured browser log. The original pre-fix log entry remains in that browser session’s historical buffer. Native RPC balances and real injected/Coinbase/WalletConnect sessions, approval rejection, account events and connected network switching were **not tested** because no wallet was available. They remain the Stage 2 integration matrix. No signature or financial request was attempted.

Additional responsive checks: the Trade document stayed within an 820px tablet viewport and a 360px phone viewport. On phones the trade panel appears immediately after the chart, before the activity table. The temporary QA creation draft was reset through the interface after persistence was verified.

Production HTTP smoke checks cover Discover, Create, Portfolio, two known token routes and missing routes, including the `nosniff` response header. A missing token initially streamed the not-found UI with HTTP 200; the finite demo routes now use static params and reject unknown IDs before streaming.

After the fix, the five known page paths returned **200** and `/token/missing` and `/missing` both returned **404**. Frozen-lockfile installation also completed successfully with pnpm 11.25.0. The final desktop capture is preserved in `docs/images/retry-discover.jpg`.

The browser fixture draft was created only for verification. It is not a launched or published token. This record describes the checks actually performed, not a claim of exhaustive accessibility, cross-browser, financial or security testing.
