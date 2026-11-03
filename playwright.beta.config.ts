import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/beta",
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "https://retry-beta.test", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm build:beta && node scripts/serve-pages.mjs",
    url: "http://127.0.0.1:4175/",
    timeout: 300000,
    reuseExistingServer: false,
    env: {
      PORT: "4175",
      NEXT_PUBLIC_BASE_PATH: "",
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
