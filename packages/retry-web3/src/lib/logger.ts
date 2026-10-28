/**
 * Development-only diagnostics. Logs go to the browser console when debug is
 * enabled, with RPC URLs reduced to their origin (API keys usually live in the
 * path or query string). Nothing is persisted.
 */

function defaultDebug(): boolean {
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
  } catch {
    return false
  }
}

let debugEnabled = defaultDebug()

export function setRetryWeb3Debug(enabled: boolean): void {
  debugEnabled = enabled
}

export function isRetryWeb3DebugEnabled(): boolean {
  return debugEnabled
}

/** `https://base-sepolia.g.alchemy.com/v2/KEY` → `https://base-sepolia.g.alchemy.com` */
export function redactUrl(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return '[invalid url]'
  }
}

const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>)]+/g

export function redactUrlsInText(text: string): string {
  return text.replace(URL_PATTERN, (match) => {
    const origin = redactUrl(match)
    return origin === match.replace(/\/$/, '') ? origin : `${origin}/[redacted]`
  })
}

interface ErrorLike {
  name?: unknown
  code?: unknown
  status?: unknown
  shortMessage?: unknown
  message?: unknown
}

export function sanitizeForLog(detail: unknown): unknown {
  if (typeof detail === 'string') return redactUrlsInText(detail)
  if (detail && typeof detail === 'object' && ('message' in detail || 'shortMessage' in detail)) {
    const error = detail as ErrorLike
    const message = typeof error.shortMessage === 'string' ? error.shortMessage : error.message
    return {
      name: typeof error.name === 'string' ? error.name : 'Error',
      ...(typeof error.code === 'number' ? { code: error.code } : {}),
      ...(typeof error.status === 'number' ? { status: error.status } : {}),
      message: typeof message === 'string' ? redactUrlsInText(message) : undefined,
    }
  }
  return detail
}

export function logWeb3Diagnostic(scope: string, detail?: unknown): void {
  if (!debugEnabled) return
  // biome-ignore lint/suspicious/noConsole: opt-in development diagnostics
  console.warn(`[retry-web3] ${scope}`, sanitizeForLog(detail))
}
