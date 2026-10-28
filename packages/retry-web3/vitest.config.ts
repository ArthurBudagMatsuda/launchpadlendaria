import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
    testTimeout: 15_000,
    server: {
      deps: {
        // Processed by Vite so vi.mock() can stub wallet SDKs they load lazily.
        inline: ['wagmi', '@wagmi/core', '@wagmi/connectors'],
      },
    },
  },
})
