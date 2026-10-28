# Shared GitHub Pages preview

> The integrated app (Stage 1 + `@retry/web3`, branch `feat/retry-frontend-web3-integration`) is **not** published here yet. This page describes the current split preview; [docs/integration/GITHUB_PAGES.md](integration/GITHUB_PAGES.md) has the workflow to publish the integrated app once approved.

The preview contains two separate applications from this repository:

| URL                                                            | Source                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| `https://arthurbudagmatsuda.github.io/launchpadlendaria/`      | `feat/etapa-1-foundation` — RETRY interface                   |
| `https://arthurbudagmatsuda.github.io/launchpadlendaria/web3/` | `feat/etapa-2-web3` — independent read-only wallet playground |

The original source histories remain separate. The publishing workflow checks out both source branches into separate directories, builds and validates them, combines only the static outputs and deploys through GitHub Pages. No app code or package-manager lockfiles are merged across the branches.

## Updates

Push changes to the corresponding branch in **ArthurBudagMatsuda/launchpadlendaria**. The workflow is present on both development branches and `main`, so pushes rebuild the shared preview. Contributions that remain solely in CapotaVelha’s fork do not trigger this repository’s deployment. A maintainer can also open Actions → Publish RETRY test preview → Run workflow on `main` to republish current source heads.

The workflow runs application formatting, lint, types and tests, and the Web3 package’s check script, before publishing. A failing build does not replace the last working site. The Pages deployment job receives only Pages/OIDC permissions; it does not get a personal access token. Public `preview-version.txt` contains the two source commit hashes for identifying which revision is displayed.

The initial workflow registration commits on `main` and the Web3 branch use `[skip ci]` to avoid duplicate simultaneous initial deployments. The application publication commit runs the complete shared build. Later ordinary pushes trigger automatic updates.

## Static export

`pnpm build:pages` uses `RETRY_STATIC_EXPORT=1`, sets a build-time `NEXT_PUBLIC_BASE_PATH` (default `/launchpadlendaria`), emits directory-style routes and writes `out/.nojekyll`. Assets use the same base path. Search query strings are read in a client component behind Suspense, so no request-time Next.js server is required.

Pages for the tracked tokens are pre-generated; other Base addresses open at `/token/?address=0x…`. Market data is fetched in the visitor’s browser from the public GeckoTerminal and DEX Screener APIs. Browser drafts and wallet connectors run on the visitor’s device. There are no server APIs, contract deployments, financial signatures or swaps. The playground also remains read-only. GitHub Pages cannot apply the custom headers configured for the Node-hosted build.

## Checks performed before initial publication

- All **20 application tests** passed, including base-path regression tests.
- ESLint passed with zero warnings; formatting passed; static build compiled all 20 routes successfully with strict types.
- Browser QA on the actual exported files confirmed global search `?q=capy` returns one token, all displayed token images load from the repository prefix, Create navigation gets its active state, and directly reloading Create works without a server-side router.
- The Web3 package and playground checks are performed by the shared GitHub Actions build before deployment. A successful publication and the deployment URL should be verified separately from a successful local export.
