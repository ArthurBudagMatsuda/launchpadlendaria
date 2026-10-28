import { createRetryWeb3Config, parseRetryWeb3Env, readRetryWeb3EnvFromRecord } from '@retry/web3/config'

/** Same configuration the Next.js app will use, fed from VITE_* variables. */
export const env = parseRetryWeb3Env(readRetryWeb3EnvFromRecord(import.meta.env, 'VITE_'))

export const retryWeb3Config = createRetryWeb3Config({
  env,
  app: {
    name: 'RETRY Web3 Playground',
    description: 'Stage 2 wallet and Base network test bench',
  },
})
