import { defineConfig, devices } from "@playwright/test";
// Browser tests of the unified app as GitHub Pages serves it: the static
// export under /launchpadlendaria, Wallet Standard and a mocked Solana RPC.
// Real extension authorization remains a separate manual validation.
const port = 4174;
export default defineConfig({
  testDir: "./e2e",
  // e2e/chain needs a validator; it has its own config (playwright.chain.config.ts).
  testIgnore: ["chain/**"],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: "pnpm build:pages && node scripts/serve-pages.mjs",
    url: `http://127.0.0.1:${port}/launchpadlendaria/`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // Deterministic read-only Devnet build; RPC is intercepted in each test.
    env: {
      PORT: String(port),
      NEXT_PUBLIC_BASE_PATH: "/launchpadlendaria",
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_SOLANA_RPC_URL: "",
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
