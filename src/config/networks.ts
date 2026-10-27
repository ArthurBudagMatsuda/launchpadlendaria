import { base, baseSepolia } from "wagmi/chains";
export const supportedChains = [baseSepolia, base] as const;
export const defaultChain =
  process.env.NEXT_PUBLIC_DEFAULT_NETWORK === "base" ? base : baseSepolia;
export const financialActionsEnabled = false;
export function isSupportedChain(id?: number) {
  return supportedChains.some((chain) => chain.id === id);
}
