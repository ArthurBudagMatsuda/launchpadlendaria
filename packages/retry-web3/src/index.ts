/**
 * @retry/web3: wallet connection, Base network handling and read-only chain
 * access for the RETRY launchpad.
 *
 * - `@retry/web3`            React provider, hooks, components and utilities (client).
 * - `@retry/web3/config`     Chains, env parsing, wagmi config (server-safe).
 * - `@retry/web3/contracts`  Contract registry and read-only helpers (server-safe).
 * - `@retry/web3/testing`    Mock EIP-1193 wallet for automated tests.
 * - `@retry/web3/styles.css` Default component styles (CSS variables).
 */

export * from './config/index.js'
export {
  type Address,
  isEvmAddress,
  isSameAddress,
  parseEvmAddress,
  type ShortenAddressOptions,
  shortenAddress,
  ZERO_ADDRESS,
} from './lib/address.js'
export {
  getRetryErrorMessage,
  RETRY_WEB3_ERROR_MESSAGES,
  type RetryErrorContext,
  RetryWeb3Error,
  type RetryWeb3ErrorCode,
  type ToRetryWeb3ErrorOptions,
  toRetryWeb3Error,
} from './lib/errors.js'
export {
  getExplorerAddressUrl,
  getExplorerBlockUrl,
  getExplorerContractUrl,
  getExplorerTokenUrl,
  getExplorerTxUrl,
  getExplorerUrl,
} from './lib/explorer.js'
export {
  type FormatTokenAmountOptions,
  formatEth,
  formatEthExact,
  formatTokenAmount,
} from './lib/format.js'
export { isRetryWeb3DebugEnabled, redactUrl, setRetryWeb3Debug } from './lib/logger.js'
export {
  ConnectWalletButton,
  type ConnectWalletButtonProps,
} from './react/components/ConnectWalletButton.js'
export {
  ConnectWalletModal,
  type ConnectWalletModalProps,
} from './react/components/ConnectWalletModal.js'
export { EthBalance, type EthBalanceProps } from './react/components/EthBalance.js'
export {
  NetworkGuard,
  type NetworkGuardProps,
  SwitchNetworkButton,
  type SwitchNetworkButtonProps,
  WrongNetworkNotice,
  type WrongNetworkNoticeProps,
} from './react/components/NetworkGuard.js'
export { NetworkIndicator, type NetworkIndicatorProps } from './react/components/NetworkIndicator.js'
export { WalletIcon, type WalletIconProps } from './react/components/WalletIcon.js'
export { WalletMenu, type WalletMenuProps } from './react/components/WalletMenu.js'
export { useRetryWeb3Config, useRetryWeb3Settings } from './react/context.js'
export { type Eip6963WalletInfo, useEip6963Wallets } from './react/eip6963.js'
export {
  type RetryBalanceState,
  type RetryBalanceStatus,
  type UseRetryBalanceOptions,
  useRetryBalance,
} from './react/hooks/useRetryBalance.js'
export {
  type RetryConnectionStatus,
  type RetryConnectionStatusState,
  useRetryConnectionStatus,
} from './react/hooks/useRetryConnectionStatus.js'
export {
  type RetryDiagnostics,
  type RpcHealth,
  useRetryDiagnostics,
} from './react/hooks/useRetryDiagnostics.js'
export {
  type RetryNetworkNotice,
  type RetryNetworkScenario,
  type RetryNetworkState,
  type RetrySwitchStatus,
  useRetryNetwork,
} from './react/hooks/useRetryNetwork.js'
export {
  type RetryConnectorInfo,
  type RetryWalletState,
  useRetryWallet,
} from './react/hooks/useRetryWallet.js'
export {
  type RetryActionStatus,
  type RetryWalletActions,
  useRetryWalletActions,
} from './react/hooks/useRetryWalletActions.js'
export { type RetryWalletEvent, useRetryWalletEvents } from './react/hooks/useRetryWalletEvents.js'
export {
  type RetryWalletAvailability,
  type RetryWalletKind,
  type RetryWalletOption,
  useRetryWalletOptions,
} from './react/hooks/useRetryWalletOptions.js'
export { RetryWeb3Provider, type RetryWeb3ProviderProps } from './react/provider.js'
