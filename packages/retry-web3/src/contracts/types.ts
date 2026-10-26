import type { Abi, Address } from 'viem'
import type { RetrySupportedChainId } from '../config/chains.js'

/**
 * Protocol contracts planned for the next stages. ERC-20 tokens created by the
 * factory are dynamic and are addressed per token, not through this registry.
 */
export const RETRY_CONTRACT_NAMES = [
  'tokenFactory',
  'bondingCurve',
  'feeManager',
  'liquidityMigrator',
] as const

export type RetryContractName = (typeof RETRY_CONTRACT_NAMES)[number]

export interface NotDeployedContract {
  status: 'not-deployed'
}

export interface DeployedContract {
  status: 'deployed'
  /** Must be the EIP-55 checksummed address from the deployment receipt. */
  address: Address
  /** Block of the deployment transaction; lets indexers skip earlier history. */
  deployedAtBlock?: bigint
  /** Transaction hash of the deployment, for audit trails and explorer links. */
  deploymentTx?: `0x${string}`
}

export type ContractDeployment = NotDeployedContract | DeployedContract

export type RetryContractRegistry = Readonly<
  Record<RetrySupportedChainId, Readonly<Record<RetryContractName, ContractDeployment>>>
>

export type RetryAbiRegistry = Partial<Record<RetryContractName, Abi>>

export interface ResolvedRetryContract<abi extends Abi | undefined = Abi | undefined> {
  name: RetryContractName
  chainId: RetrySupportedChainId
  address: Address
  abi: abi
}
