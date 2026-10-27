import { type Abi, type Address, erc20Abi } from 'viem'
import type { Config } from 'wagmi'
import { getBalance, readContract, readContracts } from 'wagmi/actions'
import { getRetryNetwork, type RetrySupportedChainId } from '../config/chains.js'
import { parseEvmAddress } from '../lib/address.js'
import { RetryWeb3Error, toRetryWeb3Error } from '../lib/errors.js'
import { getRetryContract } from './registry.js'
import type { RetryContractName, RetryContractRegistry } from './types.js'

/**
 * Read-only on-chain helpers. They run against the app's RPC transports (not
 * the wallet), validate chain IDs and addresses before any request, and map
 * failures to {@link RetryWeb3Error}. There are deliberately no write helpers.
 */

function requireChain(chainId: number | undefined): RetrySupportedChainId {
  const network = getRetryNetwork(chainId)
  if (!network) throw new RetryWeb3Error('UNSUPPORTED_CHAIN')
  return network.id
}

function requireAddress(value: unknown): Address {
  const address = parseEvmAddress(value)
  if (!address) throw new RetryWeb3Error('INVALID_ADDRESS')
  return address
}

export async function readNativeBalance(
  config: Config,
  parameters: { chainId: number | undefined; address: unknown },
): Promise<bigint> {
  const chainId = requireChain(parameters.chainId)
  const address = requireAddress(parameters.address)
  try {
    const result = await getBalance(config, { chainId, address })
    return result.value
  } catch (error) {
    throw toRetryWeb3Error(error, { context: 'balance' })
  }
}

export interface Erc20Metadata {
  address: Address
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
}

/** Reads name, symbol, decimals and total supply in a single multicall. */
export async function readErc20Metadata(
  config: Config,
  parameters: { chainId: number | undefined; token: unknown },
): Promise<Erc20Metadata> {
  const chainId = requireChain(parameters.chainId)
  const address = requireAddress(parameters.token)
  try {
    const [name, symbol, decimals, totalSupply] = await readContracts(config, {
      allowFailure: false,
      contracts: [
        { chainId, address, abi: erc20Abi, functionName: 'name' },
        { chainId, address, abi: erc20Abi, functionName: 'symbol' },
        { chainId, address, abi: erc20Abi, functionName: 'decimals' },
        { chainId, address, abi: erc20Abi, functionName: 'totalSupply' },
      ],
    })
    return { address, name, symbol, decimals, totalSupply }
  } catch (error) {
    throw toRetryWeb3Error(error, { context: 'read' })
  }
}

export async function readErc20Balance(
  config: Config,
  parameters: { chainId: number | undefined; token: unknown; owner: unknown },
): Promise<bigint> {
  const chainId = requireChain(parameters.chainId)
  const address = requireAddress(parameters.token)
  const owner = requireAddress(parameters.owner)
  try {
    return await readContract(config, {
      chainId,
      address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    })
  } catch (error) {
    throw toRetryWeb3Error(error, { context: 'read' })
  }
}

/**
 * Generic read against a registered RETRY contract. Throws
 * `CONTRACT_NOT_DEPLOYED` until the registry has a real deployment and
 * `UNKNOWN` when no ABI was registered. Once typed ABIs exist, prefer wagmi's
 * `readContract` with the `as const` ABI for full type inference.
 */
export async function readRetryContract(
  config: Config,
  parameters: {
    chainId: number | undefined
    contract: RetryContractName
    functionName: string
    args?: readonly unknown[]
    registry?: RetryContractRegistry
  },
): Promise<unknown> {
  const resolved = getRetryContract(parameters.chainId, parameters.contract, parameters.registry)
  if (!resolved.abi) {
    throw new RetryWeb3Error('UNKNOWN', {
      message: `No ABI is registered for the RETRY ${parameters.contract} contract.`,
    })
  }
  try {
    return await readContract(config, {
      chainId: resolved.chainId,
      address: resolved.address,
      abi: resolved.abi as Abi,
      functionName: parameters.functionName,
      args: parameters.args ?? [],
    })
  } catch (error) {
    throw toRetryWeb3Error(error, { context: 'read' })
  }
}
