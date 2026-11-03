/** Bounded, paced RPC queue. Never retry a send at the transport layer. */
export function publicRpcTransport(
  options: {
    fetcher?: typeof fetch;
    pause?: (ms: number) => Promise<void>;
    spacingMs?: number;
    maxQueue?: number;
    readRetries?: number;
    timeoutMs?: number;
  } = {},
): typeof fetch {
  const fetcher = options.fetcher ?? ((...args) => fetch(...args));
  const pause =
    options.pause ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const spacing = options.spacingMs ?? 700;
  let queue = Promise.resolve();
  let pending = 0;
  return async (input, init) => {
    if (pending >= (options.maxQueue ?? 24))
      throw new Error("RPC busy. Wait before refreshing.");
    pending++;
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    let method = "";
    try {
      method = JSON.parse(String(init?.body ?? "")).method ?? "";
    } catch {
      /* Unknown bodies are never retried. */
    }
    const readOnly = /^(get[A-Z]|isBlockhashValid$|simulateTransaction$)/.test(
      method,
    );
    try {
      for (let attempt = 0; ; attempt++) {
        let response: Response;
        try {
          const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000);
          const signal = init?.signal
            ? AbortSignal.any([init.signal, timeout])
            : timeout;
          if (signal.aborted) throw new Error("RPC request canceled.");
          let abort!: () => void;
          try {
            response = await Promise.race([
              fetcher(input, { ...init, signal }),
              new Promise<never>((_resolve, reject) => {
                abort = () =>
                  reject(new Error("RPC request canceled or timed out."));
                signal.addEventListener("abort", abort, { once: true });
              }),
            ]);
          } finally {
            signal.removeEventListener("abort", abort);
          }
        } catch (cause) {
          if (
            !readOnly ||
            init?.signal?.aborted ||
            attempt >= (options.readRetries ?? 2)
          )
            throw cause;
          await pause(1000 * (attempt + 1));
          continue;
        }
        if (
          response.status !== 429 ||
          !readOnly ||
          attempt >= (options.readRetries ?? 2)
        )
          return response;
        const retryAfter = response.headers.get("retry-after");
        const seconds = Number(retryAfter);
        const hintedDelay = retryAfter
          ? Number.isFinite(seconds)
            ? seconds * 1000
            : Date.parse(retryAfter) - Date.now()
          : 0;
        // Fail closed instead of retrying earlier than a long server limit.
        if (Number.isFinite(hintedDelay) && hintedDelay > 30_000)
          return response;
        await response.body?.cancel();
        await pause(
          Math.min(
            30_000,
            Math.max(
              1000 * (attempt + 1),
              Number.isFinite(hintedDelay) ? hintedDelay : 0,
            ),
          ),
        );
      }
    } finally {
      try {
        await pause(spacing);
      } finally {
        pending--;
        release();
      }
    }
  };
}
