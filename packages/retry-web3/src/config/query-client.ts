import { QueryClient } from '@tanstack/react-query'
import { toRetryWeb3Error } from '../lib/errors.js'

export const RETRY_QUERY_DEFAULTS = {
  /** Reads are considered fresh for 15s; Base produces a block every ~2s. */
  staleTimeMs: 15_000,
  gcTimeMs: 5 * 60_000,
  /** Query-level retries on top of viem's transport retries. */
  maxRetries: 1,
} as const

/**
 * Query client tuned for public RPC limits: no refetch storm on window focus,
 * bounded retries with exponential backoff, and no retry for errors that a
 * retry cannot fix (user rejection, rate limiting, invalid input).
 */
export function createRetryQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: RETRY_QUERY_DEFAULTS.staleTimeMs,
        gcTime: RETRY_QUERY_DEFAULTS.gcTimeMs,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          failureCount < RETRY_QUERY_DEFAULTS.maxRetries && toRetryWeb3Error(error).retryable,
        retryDelay: (attempt) => Math.min(2_000 * 2 ** attempt, 10_000),
      },
      mutations: {
        retry: false,
      },
    },
  })
}
