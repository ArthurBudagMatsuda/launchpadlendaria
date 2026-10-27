import { logWeb3Diagnostic } from './logger.js'

export type RetryWeb3ErrorCode =
  | 'WALLET_NOT_INSTALLED'
  | 'CONNECTION_REJECTED'
  | 'REQUEST_REJECTED'
  | 'REQUEST_PENDING'
  | 'WALLET_NO_RESPONSE'
  | 'ALREADY_CONNECTED'
  | 'SWITCH_REJECTED'
  | 'SWITCH_NOT_SUPPORTED'
  | 'CHAIN_NOT_ADDED'
  | 'UNSUPPORTED_CHAIN'
  | 'WRONG_NETWORK'
  | 'SESSION_DISCONNECTED'
  | 'ACCOUNT_CHANGED'
  | 'NETWORK_CHANGED'
  | 'RPC_UNAVAILABLE'
  | 'RPC_TIMEOUT'
  | 'RPC_INVALID_RESPONSE'
  | 'RPC_RATE_LIMITED'
  | 'OFFLINE'
  | 'WALLETCONNECT_NOT_CONFIGURED'
  | 'BALANCE_UNAVAILABLE'
  | 'CONTRACT_NOT_DEPLOYED'
  | 'INVALID_ADDRESS'
  | 'UNKNOWN'

/** User-facing copy. Short, actionable, and free of technical details. */
export const RETRY_WEB3_ERROR_MESSAGES: Readonly<Record<RetryWeb3ErrorCode, string>> = {
  WALLET_NOT_INSTALLED: 'No compatible wallet found. Install MetaMask or another EVM wallet and try again.',
  CONNECTION_REJECTED: 'Connection rejected. Please try again.',
  REQUEST_REJECTED: 'Request rejected in your wallet.',
  REQUEST_PENDING: 'A request is already open in your wallet. Open your wallet to continue.',
  WALLET_NO_RESPONSE:
    "Your wallet didn't confirm the connection. Make sure it is unlocked with an Ethereum (EVM) account selected, then try again.",
  ALREADY_CONNECTED: 'This wallet is already connected.',
  SWITCH_REJECTED: 'Network switch rejected. Please switch to Base.',
  SWITCH_NOT_SUPPORTED: 'Your wallet cannot switch networks from here. Please switch to Base in your wallet.',
  CHAIN_NOT_ADDED: 'Base is not added to your wallet yet. Approve adding the network and try again.',
  UNSUPPORTED_CHAIN: 'This network is not supported by RETRY.',
  WRONG_NETWORK: 'Please switch to Base.',
  SESSION_DISCONNECTED: 'Your wallet session was disconnected. Please reconnect.',
  ACCOUNT_CHANGED: 'Your wallet account changed.',
  NETWORK_CHANGED: 'Your wallet network changed.',
  RPC_UNAVAILABLE: 'The Base network is unavailable right now. Please try again shortly.',
  RPC_TIMEOUT: 'The network took too long to respond. Please try again.',
  RPC_INVALID_RESPONSE: 'Received an invalid response from the network. Please try again.',
  RPC_RATE_LIMITED: 'The network is busy right now. Please wait a moment and try again.',
  OFFLINE: 'You appear to be offline. Check your internet connection.',
  WALLETCONNECT_NOT_CONFIGURED: 'WalletConnect is not configured yet.',
  BALANCE_UNAVAILABLE: 'Unable to fetch your balance.',
  CONTRACT_NOT_DEPLOYED: 'This RETRY contract is not deployed on this network yet.',
  INVALID_ADDRESS: 'This is not a valid EVM address.',
  UNKNOWN: 'Something went wrong. Please try again.',
}

/** Codes worth retrying automatically after a backoff. */
const RETRYABLE_CODES: ReadonlySet<RetryWeb3ErrorCode> = new Set([
  'RPC_UNAVAILABLE',
  'RPC_TIMEOUT',
  'RPC_INVALID_RESPONSE',
  'OFFLINE',
])

export class RetryWeb3Error extends Error {
  override readonly name = 'RetryWeb3Error'
  readonly code: RetryWeb3ErrorCode
  /** Optional secondary sentence, e.g. the underlying reason a balance failed. */
  readonly hint: string | undefined
  readonly retryable: boolean

  constructor(code: RetryWeb3ErrorCode, options: { message?: string; hint?: string; cause?: unknown } = {}) {
    super(options.message ?? RETRY_WEB3_ERROR_MESSAGES[code], { cause: options.cause })
    this.code = code
    this.hint = options.hint
    this.retryable = RETRYABLE_CODES.has(code)
  }
}

export type RetryErrorContext = 'connect' | 'switch-chain' | 'disconnect' | 'balance' | 'read' | 'generic'

export interface ToRetryWeb3ErrorOptions {
  context?: RetryErrorContext
  /** Used to personalise network messages, e.g. "Please switch to Base Sepolia." */
  targetNetworkName?: string
}

interface ErrorFacts {
  names: Set<string>
  codes: Set<number>
  statuses: Set<number>
  text: string
}

/** Collects names, numeric codes and HTTP statuses across the whole `cause` chain. */
function collectFacts(error: unknown): ErrorFacts {
  const facts: ErrorFacts = { names: new Set(), codes: new Set(), statuses: new Set(), text: '' }
  const seen = new Set<unknown>()
  let current: unknown = error
  for (let depth = 0; depth < 12 && current && typeof current === 'object' && !seen.has(current); depth++) {
    seen.add(current)
    const record = current as Record<string, unknown>
    if (typeof record.name === 'string') facts.names.add(record.name)
    if (typeof record.code === 'number') facts.codes.add(record.code)
    if (typeof record.status === 'number') facts.statuses.add(record.status)
    for (const key of ['shortMessage', 'details', 'message'] as const) {
      if (typeof record[key] === 'string') facts.text += ` ${record[key]}`
    }
    current = record.cause
  }
  facts.text = facts.text.toLowerCase()
  return facts
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function classify(facts: ErrorFacts, context: RetryErrorContext): RetryWeb3ErrorCode {
  const has = (name: string) => facts.names.has(name)
  const code = (value: number) => facts.codes.has(value)

  // The user said no in the wallet. 5000 is the CAIP-25 equivalent used by WalletConnect.
  if (code(4001) || code(5000) || has('UserRejectedRequestError')) {
    if (context === 'connect') return 'CONNECTION_REJECTED'
    if (context === 'switch-chain') return 'SWITCH_REJECTED'
    return 'REQUEST_REJECTED'
  }
  if (has('ProviderNotFoundError') || has('ConnectorNotFoundError')) return 'WALLET_NOT_INSTALLED'
  if (has('ConnectorAlreadyConnectedError')) return 'ALREADY_CONNECTED'
  if (code(-32002) || has('ResourceUnavailableRpcError')) return 'REQUEST_PENDING'
  if (code(4902)) return 'CHAIN_NOT_ADDED'
  if (has('SwitchChainNotSupportedError') || (context === 'switch-chain' && code(4200))) {
    return 'SWITCH_NOT_SUPPORTED'
  }
  if (has('ChainNotConfiguredError') || has('UnsupportedChainIdError')) return 'UNSUPPORTED_CHAIN'
  if (has('ConnectorAccountNotFoundError')) return 'ACCOUNT_CHANGED'
  if (has('ConnectorChainMismatchError')) return 'NETWORK_CHANGED'
  if (
    code(4900) ||
    code(4901) ||
    has('ProviderDisconnectedError') ||
    has('ChainDisconnectedError') ||
    has('ConnectorNotConnectedError') ||
    has('ConnectorUnavailableReconnectingError')
  ) {
    return 'SESSION_DISCONNECTED'
  }
  if (context === 'switch-chain' && has('SwitchChainError')) return 'SWITCH_NOT_SUPPORTED'

  // RPC / transport failures.
  if (
    facts.statuses.has(429) ||
    code(429) ||
    code(-32005) ||
    code(-32007) ||
    has('LimitExceededRpcError') ||
    facts.text.includes('rate limit') ||
    facts.text.includes('too many requests')
  ) {
    return 'RPC_RATE_LIMITED'
  }
  if (has('TimeoutError') || facts.text.includes('timed out') || facts.text.includes('took too long')) {
    return 'RPC_TIMEOUT'
  }
  if (
    code(-32700) ||
    has('ParseRpcError') ||
    has('SyntaxError') ||
    has('InvalidHexValueError') ||
    has('InvalidHexBooleanError') ||
    facts.text.includes('unexpected token') ||
    facts.text.includes('is not valid json')
  ) {
    return 'RPC_INVALID_RESPONSE'
  }
  if (has('HttpRequestError') || has('WebSocketRequestError') || has('RpcRequestError')) {
    return isOffline() ? 'OFFLINE' : 'RPC_UNAVAILABLE'
  }
  if (code(-32603) || code(-32000) || has('InternalRpcError') || has('InvalidInputRpcError')) {
    return 'RPC_UNAVAILABLE'
  }
  if (isOffline() || facts.text.includes('failed to fetch') || facts.text.includes('network error')) {
    return isOffline() ? 'OFFLINE' : 'RPC_UNAVAILABLE'
  }
  if (has('InvalidAddressError')) return 'INVALID_ADDRESS'
  return 'UNKNOWN'
}

function personalise(code: RetryWeb3ErrorCode, targetNetworkName: string | undefined): string {
  const message = RETRY_WEB3_ERROR_MESSAGES[code]
  if (!targetNetworkName) return message
  switch (code) {
    case 'SWITCH_REJECTED':
      return `Network switch rejected. Please switch to ${targetNetworkName}.`
    case 'SWITCH_NOT_SUPPORTED':
      return `Your wallet cannot switch networks from here. Please switch to ${targetNetworkName} in your wallet.`
    case 'CHAIN_NOT_ADDED':
      return `${targetNetworkName} is not added to your wallet yet. Approve adding the network and try again.`
    case 'WRONG_NETWORK':
      return `Please switch to ${targetNetworkName}.`
    default:
      return message
  }
}

/**
 * Maps anything thrown by wagmi, viem, a wallet SDK or fetch into a stable
 * RETRY error code plus friendly copy. The original error is kept as `cause`
 * for debugging but never shown in the UI.
 */
export function toRetryWeb3Error(error: unknown, options: ToRetryWeb3ErrorOptions = {}): RetryWeb3Error {
  if (error instanceof RetryWeb3Error) return error
  const context = options.context ?? 'generic'
  const code = classify(collectFacts(error), context)
  if (code === 'UNKNOWN') logWeb3Diagnostic(`unclassified ${context} error`, error)

  if (context === 'balance') {
    return new RetryWeb3Error('BALANCE_UNAVAILABLE', {
      hint: code === 'UNKNOWN' ? undefined : personalise(code, options.targetNetworkName),
      cause: error,
    })
  }
  return new RetryWeb3Error(code, { message: personalise(code, options.targetNetworkName), cause: error })
}

/** Convenience for components: the friendly text for any error, or `undefined`. */
export function getRetryErrorMessage(error: unknown, options?: ToRetryWeb3ErrorOptions): string | undefined {
  if (!error) return undefined
  return toRetryWeb3Error(error, options).message
}
