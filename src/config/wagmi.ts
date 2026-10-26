import { createConfig, http } from "wagmi";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { base, baseSepolia } from "wagmi/chains";
import { supportedChains } from "./networks";
export function makeWagmiConfig() {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  return createConfig({
    chains: supportedChains,
    ssr: true,
    connectors: [
      injected(),
      coinbaseWallet({ appName: "RETRY", preference: { options: "all" } }),
      ...(projectId ? [walletConnect({ projectId, showQrModal: true })] : []),
    ],
    transports: {
      [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined, {
        retryCount: 1,
        timeout: 10_000,
      }),
      [baseSepolia.id]: http(
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || undefined,
        { retryCount: 1, timeout: 10_000 },
      ),
    },
  });
}
