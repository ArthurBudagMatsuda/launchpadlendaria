import {
  base,
  baseSepolia,
  isSupportedChainId,
  RETRY_FINANCIAL_OPERATIONS_ENABLED,
} from "@retry/web3/config";
// Chain definitions and the financial-operations switch live in @retry/web3,
// the app's single Web3 configuration. These names stay for existing imports.
export const supportedChains = [baseSepolia, base] as const;
export const financialActionsEnabled = RETRY_FINANCIAL_OPERATIONS_ENABLED;
export function isSupportedChain(id?: number) {
  return isSupportedChainId(id);
}
