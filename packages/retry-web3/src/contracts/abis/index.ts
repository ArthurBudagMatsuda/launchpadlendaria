import type { RetryAbiRegistry } from '../types.js'

/**
 * Typed ABIs for RETRY protocol contracts.
 *
 * Intentionally empty in Stage 2: no RETRY contract has been written or
 * audited yet, and a placeholder ABI would look authoritative. When a contract
 * is compiled, generate its ABI (for example with `@wagmi/cli` and the Foundry
 * plugin) into this folder as a `const` export and register it here:
 *
 * ```ts
 * import { tokenFactoryAbi } from './tokenFactory.js'
 * export const RETRY_ABIS = { tokenFactory: tokenFactoryAbi } as const satisfies RetryAbiRegistry
 * ```
 *
 * Keeping the `as const` literal type is what gives `readContract` typed
 * function names, arguments and return values.
 */
export const RETRY_ABIS: RetryAbiRegistry = {}

/**
 * Standard, audited ABIs that are safe to use today. RETRY launch tokens are
 * expected to be plain ERC-20s, so reads such as name/symbol/decimals/balance
 * can use viem's canonical ERC-20 ABI.
 */
export { erc20Abi } from 'viem'
