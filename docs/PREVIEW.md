# Shared GitHub Pages preview

> HISTÓRICO — publicação da prévia Base. A migração Solana não publica o site; veja [README](../README.md).

> Since PR #2 merged (2026-10-28), `.github/workflows/pages.yml` publishes the integrated app from `main`. [docs/integration/GITHUB_PAGES.md](integration/GITHUB_PAGES.md) describes the workflow and the split preview it replaced.

| URL                                                            | Source                                         |
| -------------------------------------------------------------- | ---------------------------------------------- |
| `https://arthurbudagmatsuda.github.io/launchpadlendaria/`      | `main`: the RETRY app                          |
| `https://arthurbudagmatsuda.github.io/launchpadlendaria/web3/` | `main`: the read-only Web3 test bench (a tool) |

## Updates

Every push to `main` in **ArthurBudagMatsuda/launchpadlendaria** rebuilds the site; pushes to other branches deploy nothing. The stage branches (`feat/etapa-1-foundation`, `feat/etapa-2-web3`) and the temporary `feat/retry-integrated-preview` still carry older copies of the workflow, so a push to any of them would publish over `main`'s site. Contributions that remain solely in CapotaVelha’s fork do not trigger this repository’s deployment. A maintainer can also open Actions → Publish RETRY test preview → Run workflow on `main`.

The workflow runs application formatting, lint, types and tests, and the Web3 package’s check script, before publishing. A failing build does not replace the last working site. The Pages deployment job receives only Pages/OIDC permissions; it does not get a personal access token. Public `preview-version.txt` contains the source commit of the displayed revision.

## Static export

`pnpm build:pages` uses `RETRY_STATIC_EXPORT=1`, sets a build-time `NEXT_PUBLIC_BASE_PATH` (default `/launchpadlendaria`), emits directory-style routes and writes `out/.nojekyll`. Assets use the same base path. Search query strings are read in a client component behind Suspense, so no request-time Next.js server is required.

Pages for the tracked tokens are pre-generated; other Base addresses open at `/token/?address=0x…`. Market data is fetched in the visitor’s browser from the public GeckoTerminal and DEX Screener APIs. Browser drafts and wallet connectors run on the visitor’s device. There are no server APIs, contract deployments, financial signatures or swaps. The playground also remains read-only. GitHub Pages cannot apply the custom headers configured for the Node-hosted build.

## Checks performed before the first (split) publication

- All **20 application tests** passed, including base-path regression tests.
- ESLint passed with zero warnings; formatting passed; static build compiled all 20 routes successfully with strict types.
- Browser QA on the actual exported files confirmed global search `?q=capy` returns one token, all displayed token images load from the repository prefix, Create navigation gets its active state, and directly reloading Create works without a server-side router.
- The Web3 package and playground checks are performed by the shared GitHub Actions build before deployment. A successful publication and the deployment URL should be verified separately from a successful local export.
