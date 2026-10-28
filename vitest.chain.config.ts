import { defineConfig } from "vitest/config";
import path from "node:path";
// On-chain tests: a local validator with Meteora's programs, or Devnet.
// They send real transactions, so they never run with `pnpm test`.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/chain/**/*.chain.ts"],
    testTimeout: 180_000,
    hookTimeout: 600_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
