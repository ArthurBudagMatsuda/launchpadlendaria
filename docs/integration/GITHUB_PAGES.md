# Publishing the integrated app on GitHub Pages

> HISTÓRICO — automação da versão Base. Esta migração gera artefatos de revisão e não publica; instruções atuais no [README](../../README.md).

**Status: applied in this branch (PR #2), on Iam's go-ahead to merge.** `.github/workflows/pages.yml` now builds the integrated app and the Web3 test bench from the commit being published and runs only on pushes to `main` (or by hand). Pushing `feat/retry-frontend-web3-integration` does not deploy anything; merging it into `main` publishes the integrated app.

Before this change the workflow built the Stage 1 app from `feat/etapa-1-foundation` and the playground from `feat/etapa-2-web3`, so merging the integration would have brought back the split preview. While the change was pending, the integrated app was published for real-wallet tests from the temporary branch `feat/retry-integrated-preview`, which has its own copy of this workflow.

## What changes

| Before (`pages.yml`)                                                       | Now                                                                        |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| App from `feat/etapa-1-foundation`, playground from `feat/etapa-2-web3`    | Both from the commit being published (`main` after the integration merges) |
| Two installs: pnpm for the app, `npm ci` for the module and the playground | One `pnpm install --frozen-lockfile` for the workspace                     |
| Playground built with `VITE_DEFAULT_CHAIN` (a name the playground ignores) | `VITE_DEFAULT_NETWORK`, the name the playground and the module read        |
| Runs on `main` and both stage branches                                     | Runs on `main` (and by hand)                                               |
| `preview-version.txt` lists two source commits                             | One source commit                                                          |

URLs stay the same: the app at `https://arthurbudagmatsuda.github.io/launchpadlendaria/` and the developer test bench at `/web3/`.

## Workflow

The `build` job's steps in `.github/workflows/pages.yml` are the ones below, and the trigger is narrowed to `main`. The `deploy` job, permissions and concurrency did not change.

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
# permissions and concurrency unchanged
jobs:
  build:
    if: github.repository == 'ArthurBudagMatsuda/launchpadlendaria'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      pages: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: pnpm/action-setup@f520eceda224fe1a4aed5a2a27a194379a409996 # v6
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version: 24
          cache: pnpm
      - name: Install workspace
        run: pnpm install --frozen-lockfile
      - name: Check application and Web3 module
        run: |
          pnpm format:check
          pnpm lint
          pnpm typecheck
          pnpm test
          pnpm --filter @retry/web3 check
      - name: Build RETRY for Pages
        run: pnpm build:pages
        env:
          NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}
          NEXT_PUBLIC_DEFAULT_NETWORK: base-sepolia
      - name: Build Web3 test bench (developer tool)
        run: pnpm --filter retry-web3-playground build --base=/${{ github.event.repository.name }}/web3/
        env:
          VITE_DEFAULT_NETWORK: base-sepolia
      - name: Combine and record the source commit
        run: |
          mkdir -p out/web3
          cp -R examples/web3-playground/dist/. out/web3/
          printf 'Application and Web3 test bench: %s\n' "$(git rev-parse HEAD)" > out/preview-version.txt
      - name: Configure Pages
        uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6
      - name: Upload Pages bundle
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5
        with:
          path: out
  # deploy: unchanged
```

The same steps have published the temporary preview from `feat/retry-integrated-preview` since 2026-10-27 (only the trigger and the `preview-version.txt` line differ), and real wallets were tested there. Locally, `pnpm build:pages` plus the playground build with `--base=/launchpadlendaria/web3/`, served under `/launchpadlendaria` with `pnpm preview:pages`, loaded both pages with no page errors.

## Order of operations

1. Merge PR #2 into `main` with "Create a merge commit". That push runs this workflow and publishes the integrated app.
2. Check `https://arthurbudagmatsuda.github.io/launchpadlendaria/preview-version.txt` shows the merge commit, then connect a wallet on `/` and on a token page.
3. If the deploy job waits, allow `main` under Settings → Environments → `github-pages`.
4. Delete `feat/retry-integrated-preview` once the site from `main` is confirmed; it carries a debug panel that is not part of `main`.
5. If something is wrong, revert the workflow commit on `main` to restore the split preview.

`feat/etapa-1-foundation` and `feat/etapa-2-web3` carry their own copy of `pages.yml`. A push to either still publishes the old split preview over the integrated one, so stop pushing to them after the merge (or remove the stage branches from their copies).

## Hosting limits that do not change

- Static export: no server, so the custom security headers in `next.config.ts` do not apply on Pages, and the wallet session cannot be read server-side (the header shows `Connect Wallet` until the browser restores the session).
- Token pages are generated at build time for the tracked tokens in `src/config/featured-assets.ts` (`generateStaticParams`, `dynamicParams = false`); adding a tracked token needs a rebuild. Any other Base address is inspected through the client-side route `/token/?address=0x…`, which reads the contract from Base RPC in the browser.
- Market data (GeckoTerminal, DEX Screener) is fetched by the visitor's browser from public, keyless APIs that allow cross-origin requests. Nothing secret is in the bundle, and the exported HTML holds no prices. If a provider changes its CORS policy or rate limits, the affected figures show "Unavailable"; a small server-side cache would then be needed.
- MetaMask flags the shared `*.github.io` domain (see `docs/web3/WALLET_INTEGRATION.md`). A public launch should use RETRY's own domain.
