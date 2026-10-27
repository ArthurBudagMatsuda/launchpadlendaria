import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  getRetryNetwork,
  isSupportedChainId,
} from '../config/chains.js'
import { isEvmAddress, ZERO_ADDRESS } from '../lib/address.js'
import { RetryWeb3Error } from '../lib/errors.js'
import { RETRY_ABIS } from './abis/index.js'
import {
  type ContractDeployment,
  type DeployedContract,
  RETRY_CONTRACT_NAMES,
  type ResolvedRetryContract,
  type RetryContractName,
  type RetryContractRegistry,
} from './types.js'

/** Explicit marker for a contract that has not been deployed on a network. */
export const NOT_DEPLOYED = Object.freeze({ status: 'not-deployed' }) satisfies ContractDeployment

/**
 * Where RETRY protocol contracts live, per network.
 *
 * Nothing is deployed in Stage 2. When a contract ships, replace its
 * `NOT_DEPLOYED` entry with the real deployment, e.g.:
 *
 * ```ts
 * tokenFactory: {
 *   status: 'deployed',
 *   address: '0x…', // checksummed, copied from the deployment receipt
 *   deployedAtBlock: 12345678n,
 *   deploymentTx: '0x…',
 * },
 * ```
 *
 * `validateContractRegistry` (covered by tests) rejects malformed entries.
 */
export const RETRY_CONTRACTS: RetryContractRegistry = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    tokenFactory: NOT_DEPLOYED,
    bondingCurve: NOT_DEPLOYED,
    feeManager: NOT_DEPLOYED,
    liquidityMigrator: NOT_DEPLOYED,
  },
  [BASE_MAINNET_CHAIN_ID]: {
    tokenFactory: NOT_DEPLOYED,
    bondingCurve: NOT_DEPLOYED,
    feeManager: NOT_DEPLOYED,
    liquidityMigrator: NOT_DEPLOYED,
  },
}

export function getContractDeployment(
  chainId: number | undefined,
  name: RetryContractName,
  registry: RetryContractRegistry = RETRY_CONTRACTS,
): ContractDeployment {
  if (!isSupportedChainId(chainId)) return NOT_DEPLOYED
  return registry[chainId][name]
}

export function isContractDeployed(
  chainId: number | undefined,
  name: RetryContractName,
  registry: RetryContractRegistry = RETRY_CONTRACTS,
): boolean {
  return getContractDeployment(chainId, name, registry).status === 'deployed'
}

/**
 * Resolves a contract's address and ABI, or throws a `CONTRACT_NOT_DEPLOYED`
 * error. Callers must handle that error instead of falling back to a
 * guessed address.
 */
export function getRetryContract(
  chainId: number | undefined,
  name: RetryContractName,
  registry: RetryContractRegistry = RETRY_CONTRACTS,
): ResolvedRetryContract {
  const network = getRetryNetwork(chainId)
  if (!network) {
    throw new RetryWeb3Error('UNSUPPORTED_CHAIN')
  }
  const deployment = registry[network.id][name]
  if (deployment.status !== 'deployed') {
    throw new RetryWeb3Error('CONTRACT_NOT_DEPLOYED', {
      message: `The RETRY ${name} contract is not deployed on ${network.name} yet.`,
    })
  }
  return { name, chainId: network.id, address: deployment.address, abi: RETRY_ABIS[name] }
}

export interface RegistryProblem {
  chainId: number
  name: string
  problem: string
}

/** Structural checks for the registry. Returns an empty list when valid. */
export function validateContractRegistry(
  registry: RetryContractRegistry = RETRY_CONTRACTS,
): RegistryProblem[] {
  const problems: RegistryProblem[] = []
  const seen = new Map<string, string>()
  for (const [chainKey, contracts] of Object.entries(registry)) {
    const chainId = Number(chainKey)
    if (!isSupportedChainId(chainId)) {
      problems.push({ chainId, name: '*', problem: 'Unsupported chain in registry' })
      continue
    }
    for (const name of RETRY_CONTRACT_NAMES) {
      const entry = contracts[name] as ContractDeployment | undefined
      if (!entry) {
        problems.push({ chainId, name, problem: 'Missing entry (use NOT_DEPLOYED)' })
        continue
      }
      if (entry.status === 'not-deployed') continue
      const deployed = entry as DeployedContract
      if (!isEvmAddress(deployed.address)) {
        problems.push({ chainId, name, problem: 'Address is not a valid checksummed EVM address' })
        continue
      }
      if (deployed.address === ZERO_ADDRESS) {
        problems.push({ chainId, name, problem: 'Zero address is not a deployment' })
      }
      const key = `${chainId}:${deployed.address.toLowerCase()}`
      const previous = seen.get(key)
      if (previous) problems.push({ chainId, name, problem: `Same address as ${previous}` })
      seen.set(key, name)
    }
  }
  return problems
}
