import { describe, expect, it } from 'vitest'
import {
  getContractDeployment,
  getRetryContract,
  isContractDeployed,
  NOT_DEPLOYED,
  RETRY_ABIS,
  RETRY_CONTRACT_NAMES,
  RETRY_CONTRACTS,
  type RetryContractRegistry,
  readRetryContract,
  validateContractRegistry,
} from '../src/contracts/index.js'
import { RetryWeb3Error } from '../src/lib/errors.js'
import { createTestSetup } from './utils.js'

const VALID = '0x84a2C0B2e6dc6e1F2C3A4B5D6e7f8091A2B33F91'

function registryWith(entry: unknown): RetryContractRegistry {
  return {
    ...RETRY_CONTRACTS,
    84532: { ...RETRY_CONTRACTS[84532], tokenFactory: entry as never },
  }
}

describe('contract registry', () => {
  it('marks every RETRY contract as not deployed on both networks', () => {
    for (const chainId of [8453, 84532] as const) {
      for (const name of RETRY_CONTRACT_NAMES) {
        expect(RETRY_CONTRACTS[chainId][name]).toEqual(NOT_DEPLOYED)
        expect(isContractDeployed(chainId, name)).toBe(false)
      }
    }
  })

  it('ships no ABIs yet', () => {
    expect(Object.keys(RETRY_ABIS)).toEqual([])
  })

  it('refuses to resolve contracts that are not deployed', () => {
    expect(() => getRetryContract(84532, 'tokenFactory')).toThrowError(RetryWeb3Error)
    try {
      getRetryContract(84532, 'bondingCurve')
    } catch (error) {
      expect((error as RetryWeb3Error).code).toBe('CONTRACT_NOT_DEPLOYED')
      expect((error as RetryWeb3Error).message).toBe(
        'The RETRY bondingCurve contract is not deployed on Base Sepolia yet.',
      )
    }
  })

  it('refuses unsupported chains', () => {
    expect(getContractDeployment(1, 'tokenFactory')).toEqual(NOT_DEPLOYED)
    expect(() => getRetryContract(1, 'tokenFactory')).toThrowError(/not supported/)
  })

  it('resolves a deployed entry from a custom registry', () => {
    const registry = registryWith({ status: 'deployed', address: VALID })
    expect(isContractDeployed(84532, 'tokenFactory', registry)).toBe(true)
    expect(getRetryContract(84532, 'tokenFactory', registry)).toMatchObject({
      chainId: 84532,
      address: VALID,
    })
  })

  it('validates the default registry', () => {
    expect(validateContractRegistry()).toEqual([])
  })

  it('flags invalid, zero and duplicated addresses', () => {
    expect(
      validateContractRegistry(registryWith({ status: 'deployed', address: '0xabc' }))[0]?.problem,
    ).toMatch(/valid/)
    expect(
      validateContractRegistry(
        registryWith({ status: 'deployed', address: '0x0000000000000000000000000000000000000000' }),
      )[0]?.problem,
    ).toMatch(/Zero address/)
    const duplicated: RetryContractRegistry = {
      ...RETRY_CONTRACTS,
      84532: {
        ...RETRY_CONTRACTS[84532],
        tokenFactory: { status: 'deployed', address: VALID },
        bondingCurve: { status: 'deployed', address: VALID },
      },
    }
    expect(validateContractRegistry(duplicated)[0]?.problem).toMatch(/Same address as tokenFactory/)
  })

  it('readRetryContract fails fast without touching the RPC while nothing is deployed', async () => {
    const { config, rpcCalls } = createTestSetup()
    await expect(
      readRetryContract(config.wagmiConfig, {
        chainId: 84532,
        contract: 'tokenFactory',
        functionName: 'owner',
      }),
    ).rejects.toMatchObject({ code: 'CONTRACT_NOT_DEPLOYED' })
    expect(rpcCalls).toHaveLength(0)
  })
})
