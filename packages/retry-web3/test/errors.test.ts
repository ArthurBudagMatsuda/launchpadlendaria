import {
  HttpRequestError,
  InternalRpcError,
  LimitExceededRpcError,
  ResourceUnavailableRpcError,
  SwitchChainError,
  TimeoutError,
  UserRejectedRequestError,
} from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProviderNotFoundError, SwitchChainNotSupportedError } from 'wagmi'
import { RetryWeb3Error, toRetryWeb3Error } from '../src/lib/errors.js'

const URL = 'https://base-sepolia.example.com/v2/secret-key'
const rejected = () => new UserRejectedRequestError(new Error('User rejected the request.'))

describe('error mapping', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps a rejected connection', () => {
    const error = toRetryWeb3Error(rejected(), { context: 'connect' })
    expect(error.code).toBe('CONNECTION_REJECTED')
    expect(error.message).toBe('Connection rejected. Please try again.')
    expect(error.retryable).toBe(false)
  })

  it('maps a rejected network switch with the target network name', () => {
    const error = toRetryWeb3Error(new SwitchChainError(rejected()), {
      context: 'switch-chain',
      targetNetworkName: 'Base Sepolia',
    })
    expect(error.code).toBe('SWITCH_REJECTED')
    expect(error.message).toBe('Network switch rejected. Please switch to Base Sepolia.')
  })

  it('maps raw EIP-1193 errors by code', () => {
    expect(toRetryWeb3Error({ code: 4001, message: 'denied' }, { context: 'connect' }).code).toBe(
      'CONNECTION_REJECTED',
    )
    expect(
      toRetryWeb3Error({ code: 4902, message: 'Unrecognized chain' }, { context: 'switch-chain' }).code,
    ).toBe('CHAIN_NOT_ADDED')
    expect(toRetryWeb3Error({ code: 4900, message: 'Disconnected' }).code).toBe('SESSION_DISCONNECTED')
  })

  it('maps a missing wallet', () => {
    expect(toRetryWeb3Error(new ProviderNotFoundError(), { context: 'connect' }).code).toBe(
      'WALLET_NOT_INSTALLED',
    )
  })

  it('maps a request already pending in the wallet', () => {
    const error = toRetryWeb3Error(new ResourceUnavailableRpcError(new Error('pending')), {
      context: 'connect',
    })
    expect(error.code).toBe('REQUEST_PENDING')
  })

  it('maps wallets that cannot switch networks', () => {
    expect(
      toRetryWeb3Error(new SwitchChainNotSupportedError({ connector: { name: 'X' } as never })).code,
    ).toBe('SWITCH_NOT_SUPPORTED')
  })

  it('maps a disconnected session', () => {
    const notConnected = Object.assign(new Error('Connector not connected.'), {
      name: 'ConnectorNotConnectedError',
    })
    expect(toRetryWeb3Error(notConnected).code).toBe('SESSION_DISCONNECTED')
  })

  it('maps RPC rate limiting (HTTP 429 and -32005) as not retryable', () => {
    const http = toRetryWeb3Error(new HttpRequestError({ url: URL, status: 429 }))
    expect(http.code).toBe('RPC_RATE_LIMITED')
    expect(http.retryable).toBe(false)
    expect(toRetryWeb3Error(new LimitExceededRpcError(new Error('limit'))).code).toBe('RPC_RATE_LIMITED')
  })

  it('maps RPC outages and timeouts as retryable', () => {
    const outage = toRetryWeb3Error(new HttpRequestError({ url: URL, status: 503 }))
    expect(outage.code).toBe('RPC_UNAVAILABLE')
    expect(outage.retryable).toBe(true)
    expect(toRetryWeb3Error(new InternalRpcError(new Error('boom'))).code).toBe('RPC_UNAVAILABLE')
    const timeout = toRetryWeb3Error(new TimeoutError({ body: {}, url: URL }))
    expect(timeout.code).toBe('RPC_TIMEOUT')
    expect(timeout.retryable).toBe(true)
  })

  it('maps malformed RPC responses', () => {
    const error = new HttpRequestError({
      url: URL,
      status: 200,
      cause: new SyntaxError('Unexpected token < in JSON'),
    })
    expect(toRetryWeb3Error(error).code).toBe('RPC_INVALID_RESPONSE')
  })

  it('maps offline network failures', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false })
    const error = new HttpRequestError({ url: URL, cause: new TypeError('Failed to fetch') })
    expect(toRetryWeb3Error(error).code).toBe('OFFLINE')
  })

  it('wraps balance failures as "Unable to fetch your balance." with the reason as hint', () => {
    const error = toRetryWeb3Error(new HttpRequestError({ url: URL, status: 429 }), { context: 'balance' })
    expect(error.code).toBe('BALANCE_UNAVAILABLE')
    expect(error.message).toBe('Unable to fetch your balance.')
    expect(error.hint).toMatch(/busy/)
  })

  it('never exposes technical details or RPC URLs in the message', () => {
    const error = toRetryWeb3Error(new HttpRequestError({ url: URL, status: 500, details: 'stack trace' }))
    expect(error.message).not.toContain('secret-key')
    expect(error.message).not.toContain('stack')
    expect(error.cause).toBeInstanceOf(HttpRequestError)
  })

  it('falls back to a generic message and keeps existing RETRY errors', () => {
    expect(toRetryWeb3Error(new Error('weird')).code).toBe('UNKNOWN')
    expect(toRetryWeb3Error('string').message).toBe('Something went wrong. Please try again.')
    const original = new RetryWeb3Error('CONTRACT_NOT_DEPLOYED')
    expect(toRetryWeb3Error(original)).toBe(original)
  })
})
