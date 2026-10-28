import { defineConfig, devices } from "@playwright/test";
// Browser tests of the unified app as GitHub Pages serves it: the static
// export under /launchpadlendaria, a simulated EIP-1193 wallet and a mocked
// Base RPC (e2e/fixtures.ts). They prove the wiring, not that real wallet
// extensions work: see docs/web3/WALLET_INTEGRATION.md for the manual matrix.
const port = 4174;
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: "pnpm build:pages && node scripts/serve-pages.mjs",
    url: `http://127.0.0.1:${port}/launchpadlendaria/`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // Deterministic build: Base Sepolia target, public RPC (mocked), no WalletConnect.
    env: {
      PORT: String(port),
      NEXT_PUBLIC_BASE_PATH: "/launchpadlendaria",
      NEXT_PUBLIC_DEFAULT_NETWORK: "base-sepolia",
      NEXT_PUBLIC_BASE_RPC_URL: "",
      NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: "",
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "",
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
