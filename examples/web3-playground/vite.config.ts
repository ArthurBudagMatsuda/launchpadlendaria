import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The playground consumes @retry/web3 straight from source, so changes in
// packages/retry-web3 show up with hot reload. `dedupe` makes the package use
// this app's single copy of React, wagmi and TanStack Query.
const web3Src = fileURLToPath(new URL('../../packages/retry-web3/src', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@retry\/web3\/styles\.css$/, replacement: `${web3Src}/react/styles.css` },
      { find: /^@retry\/web3\/(config|contracts|testing)$/, replacement: `${web3Src}/$1/index.ts` },
      { find: /^@retry\/web3$/, replacement: `${web3Src}/index.ts` },
    ],
    dedupe: ['react', 'react-dom', 'wagmi', 'viem', '@tanstack/react-query'],
  },
  envPrefix: 'VITE_',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { sourcemap: true },
})
