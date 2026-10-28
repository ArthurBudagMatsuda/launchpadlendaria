import { MarketDataError } from "./errors";
import type { MarketSourceId } from "./types";

/**
 * The only hosts market data is fetched from. URLs are built from validated
 * addresses and pool IDs inside the provider adapters; nothing a user types
 * or a provider returns ever becomes a request target.
 */
export const MARKET_DATA_HOSTS: Record<MarketSourceId, string> = {
  geckoterminal: "api.geckoterminal.com",
  dexscreener: "api.dexscreener.com",
};

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface MarketFetchOptions {
  fetch?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export const MARKET_FETCH_TIMEOUT_MS = 10_000;

function retryAfterMs(header: string | null) {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** GET a JSON document from an allowlisted provider, with a timeout. */
export async function getProviderJson(
  source: MarketSourceId,
  path: string,
  headers: Record<string, string>,
  options: MarketFetchOptions = {},
): Promise<unknown> {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new MarketDataError("INVALID_INPUT", { source });
  const url = new URL(path, `https://${MARKET_DATA_HOSTS[source]}`);
  if (url.hostname !== MARKET_DATA_HOSTS[source] || url.protocol !== "https:")
    throw new MarketDataError("INVALID_INPUT", { source });
  const timeout = AbortSignal.timeout(
    options.timeoutMs ?? MARKET_FETCH_TIMEOUT_MS,
  );
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  const doFetch: FetchLike =
    options.fetch ?? ((input, init) => fetch(input, init));
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await doFetch(url.toString(), { headers, signal });
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    throw new MarketDataError(timeout.aborted ? "TIMEOUT" : "NETWORK", {
      source,
      cause,
    });
  }
  if (response.status === 429)
    throw new MarketDataError("RATE_LIMITED", {
      source,
      status: 429,
      retryAfterMs: retryAfterMs(response.headers.get("retry-after")),
    });
  if (response.status === 404)
    throw new MarketDataError("NOT_FOUND", { source, status: 404 });
  if (!response.ok)
    throw new MarketDataError("HTTP_ERROR", {
      source,
      status: response.status,
    });
  let text: string;
  try {
    text = await response.text();
  } catch (cause) {
    throw new MarketDataError(timeout.aborted ? "TIMEOUT" : "NETWORK", {
      source,
      cause,
    });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new MarketDataError("INVALID_RESPONSE", {
      source,
      message: "The provider returned malformed JSON.",
      cause,
    });
  }
}
