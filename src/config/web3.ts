import { createRetryWeb3Config, parseRetryWeb3Env } from "@retry/web3/config";

// Next.js only inlines NEXT_PUBLIC_* variables read by their full literal name.
export const retryWeb3Env = parseRetryWeb3Env({
  defaultChain: process.env.NEXT_PUBLIC_DEFAULT_NETWORK,
  baseMainnetRpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  baseSepoliaRpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
});

/** Same config on the server (cookie → initial state) and in the browser. */
export function makeRetryWeb3Config() {
  return createRetryWeb3Config({
    env: retryWeb3Env,
    app: {
      name: "RETRY",
      description: "A new beginning on Base.",
    },
    ssr: true,
    storage: "cookie",
  });
}
