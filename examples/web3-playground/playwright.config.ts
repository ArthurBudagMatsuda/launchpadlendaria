import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests of the playground with a simulated EIP-1193 wallet and a
 * mocked Base JSON-RPC. They prove the UI wiring, not that real wallets work:
 * see docs/web3/WALLET_INTEGRATION.md for the manual checklist.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm run build && pnpm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Deterministic build: Base Sepolia target, no custom RPC, no WalletConnect.
    env: {
      VITE_DEFAULT_NETWORK: 'base-sepolia',
      VITE_BASE_SEPOLIA_RPC_URL: '',
      VITE_BASE_RPC_URL: '',
      VITE_WALLETCONNECT_PROJECT_ID: '',
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
