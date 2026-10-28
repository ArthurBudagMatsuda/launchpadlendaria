import type { DataSourceId } from "./types";

export type MarketDataErrorCode =
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "NETWORK"
  | "INVALID_RESPONSE"
  | "UNSUPPORTED_CHAIN"
  | "INVALID_INPUT"
  | "NO_ELIGIBLE_POOL";

const MESSAGES: Record<MarketDataErrorCode, string> = {
  RATE_LIMITED: "The market data provider is rate limiting requests.",
  NOT_FOUND: "The provider has no data for this token or pool.",
  HTTP_ERROR: "The market data provider returned an error.",
  TIMEOUT: "The market data provider did not answer in time.",
  NETWORK: "The market data provider could not be reached.",
  INVALID_RESPONSE: "The provider's response failed validation.",
  UNSUPPORTED_CHAIN: "Market data is only supported on Base mainnet.",
  INVALID_INPUT: "Invalid token or pool identifier.",
  NO_ELIGIBLE_POOL:
    "No pool prices this token against ETH, WETH or USDC with enough liquidity.",
};

export class MarketDataError extends Error {
  readonly code: MarketDataErrorCode;
  readonly source?: DataSourceId;
  readonly status?: number;
  readonly retryAfterMs?: number;
  constructor(
    code: MarketDataErrorCode,
    options: {
      source?: DataSourceId;
      status?: number;
      retryAfterMs?: number;
      message?: string;
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? MESSAGES[code], { cause: options.cause });
    this.name = "MarketDataError";
    this.code = code;
    this.source = options.source;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
  /** Worth one more attempt: timeouts, network failures and 5xx answers. */
  get retryable() {
    return (
      this.code === "TIMEOUT" ||
      this.code === "NETWORK" ||
      (this.code === "HTTP_ERROR" && (this.status ?? 0) >= 500)
    );
  }
}

export function isMarketDataError(error: unknown): error is MarketDataError {
  return error instanceof MarketDataError;
}

/** Query retry policy: one more try for transient failures only. */
export function shouldRetryMarketQuery(failureCount: number, error: unknown) {
  return failureCount < 1 && isMarketDataError(error) && error.retryable;
}

/** Message for any thrown value, for the UI. */
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}
