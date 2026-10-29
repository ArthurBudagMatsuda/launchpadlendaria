/** Pace only public test RPCs. Never retry a send at the transport layer. */
export function publicRpcTransport(
  options: {
    fetcher?: typeof fetch;
    pause?: (ms: number) => Promise<void>;
    spacingMs?: number;
  } = {},
): typeof fetch {
  const fetcher = options.fetcher ?? fetch;
  const pause =
    options.pause ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const spacing = options.spacingMs ?? 700;
  let queue = Promise.resolve();
  return async (input, init) => {
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
          response = await fetcher(input, {
            ...init,
            signal: init?.signal ?? AbortSignal.timeout(20_000),
          });
        } catch (cause) {
          if (!readOnly || attempt >= 2) throw cause;
          await pause(1000 * (attempt + 1));
          continue;
        }
        if (response.status !== 429 || !readOnly || attempt >= 2)
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
      await pause(spacing);
      release();
    }
  };
}
