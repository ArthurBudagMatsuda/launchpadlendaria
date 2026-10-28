import { defineConfig } from "vitest/config";
import path from "node:path";
// Explicit opt-in probe. Public network availability must not gate offline CI.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/live/*.probe.ts"],
    testTimeout: 20_000,
    maxWorkers: 1,
  },
});
