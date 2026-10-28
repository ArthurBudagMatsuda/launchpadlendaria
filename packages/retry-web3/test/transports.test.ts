import { createPublicClient } from 'viem'
import { baseSepolia } from 'viem/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRetryTransports } from '../src/config/transports.js'
import { toRetryWeb3Error } from '../src/lib/errors.js'

type FetchArgs = [input: string | URL | Request, init?: RequestInit]

function jsonRpcResult(init: RequestInit | undefined, result: unknown): Response {
  const { id } = JSON.parse(String(init?.body)) as { id: number }
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    headers: { 'content-type': 'application/json' },
  })
}

function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn((...[input, init]: FetchArgs) => handler(String(input), init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const urls = (mock: ReturnType<typeof stubFetch>) =>
  mock.mock.calls.map(([input]) => new URL(input instanceof Request ? input.url : String(input)).href)

function sepoliaClient(options: Parameters<typeof createRetryTransports>[1], customUrl?: string) {
  const transports = createRetryTransports(customUrl ? { 84532: customUrl } : {}, options)
  return createPublicClient({ chain: baseSepolia, transport: transports[84532], cacheTime: 0 })
}

describe('RPC transports', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the custom RPC first and falls back to the public Base endpoint', async () => {
    const fetchMock = stubFetch(async (url, init) =>
      url.startsWith('https://custom.example.com')
        ? new Response('down', { status: 503 })
        : jsonRpcResult(init, '0x10'),
    )
    const client = sepoliaClient({ retryCount: 0 }, 'https://custom.example.com/key')
    await expect(client.getBlockNumber()).resolves.toBe(16n)
    expect(urls(fetchMock)).toEqual(['https://custom.example.com/key', 'https://sepolia.base.org/'])
  })

  it('bounds retries: (retryCount + 1) attempts over every endpoint, then a friendly error', async () => {
    const fetchMock = stubFetch(async () => new Response('unavailable', { status: 503 }))
    const client = sepoliaClient({ retryCount: 1, retryDelayMs: 1 }, 'https://custom.example.com/key')
    const error = await client.getBlockNumber().catch((caught: unknown) => caught)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(toRetryWeb3Error(error).code).toBe('RPC_UNAVAILABLE')
  })

  it('times out slow endpoints', async () => {
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const client = sepoliaClient({ retryCount: 0, timeoutMs: 50 })
    const error = await client.getBlockNumber().catch((caught: unknown) => caught)
    expect(toRetryWeb3Error(error).code).toBe('RPC_TIMEOUT')
  })

  it('reports provider rate limiting', async () => {
    stubFetch(async () => new Response('Too Many Requests', { status: 429 }))
    const client = sepoliaClient({ retryCount: 0 })
    const error = await client.getBlockNumber().catch((caught: unknown) => caught)
    expect(toRetryWeb3Error(error).code).toBe('RPC_RATE_LIMITED')
  })

  it('reports invalid RPC responses', async () => {
    stubFetch(
      async () =>
        new Response('<html>gateway</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    )
    const client = sepoliaClient({ retryCount: 0 })
    const error = await client.getBlockNumber().catch((caught: unknown) => caught)
    expect(toRetryWeb3Error(error).code).toBe('RPC_INVALID_RESPONSE')
  })
})
