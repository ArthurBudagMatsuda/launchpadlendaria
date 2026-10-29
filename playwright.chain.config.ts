import { defineConfig, devices } from "@playwright/test";
// Browser test of RETRY on a real validator with Meteora's programs (see
// e2e/chain/). It needs `solana-test-validator` on 127.0.0.1:8899 holding
// the RETRY Devnet config, so it runs in the Meteora workflow, not in CI's
// mocked e2e job.
const port = 4175;
export default defineConfig({
  testDir: "./e2e/chain",
  timeout: 240_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build:pages && node scripts/serve-pages.mjs",
    url: `http://127.0.0.1:${port}/launchpadlendaria/`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      PORT: String(port),
      NEXT_PUBLIC_BASE_PATH: "/launchpadlendaria",
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_SOLANA_RPC_URL: "http://127.0.0.1:8899",
      NEXT_PUBLIC_RETRY_METADATA_URL: "https://metadata.retry.test",
    },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
