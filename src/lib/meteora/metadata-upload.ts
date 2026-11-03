import type { TokenDraft } from "@/lib/validation";
import { MAX_IMAGE_SIZE } from "@/lib/validation";
import { MAX_URI, parseOffchainMetadata } from "./metadata";
import { metadataEndpoint, metadataOrigin } from "./metadata-endpoint";
export { metadataEndpoint, metadataSignInUrl } from "./metadata-endpoint";

export class MetadataUploadError extends Error {}
export interface MetadataReceipt {
  uri: string;
  image: string;
}
interface VerifyOptions {
  signal?: AbortSignal;
  /** Preserve the receipt across propagation delays; never retry the POST automatically. */
  onStored?: (receipt: MetadataReceipt) => void;
}
const PROPAGATION_DELAYS = [0, 1000, 2000, 4000, 8000, 15000, 30000];
const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new MetadataUploadError("Metadata check canceled."));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** One bounded fetch, including its streamed body. Never retries a POST. */
async function readBytes(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  max: number,
  signal?: AbortSignal,
) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, {
          ...init,
          signal: controller.signal,
          redirect: "error",
          referrerPolicy: "no-referrer",
        });
        if (!response.ok) {
          await response.body?.cancel();
          return {
            status: response.status,
            headers: response.headers,
            bytes: new ArrayBuffer(0),
          };
        }
        if (Number(response.headers.get("content-length")) > max)
          throw new MetadataUploadError(
            "The metadata service returned an oversized object.",
          );
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        if (reader) {
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.length;
              if (size > max)
                throw new MetadataUploadError(
                  "The metadata service returned an oversized object.",
                );
              chunks.push(value);
            }
          } finally {
            await reader.cancel().catch(() => {});
          }
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        return {
          status: response.status,
          headers: response.headers,
          bytes: bytes.buffer,
        };
      })(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(
            new MetadataUploadError(
              "The metadata service timed out. No launch was sent.",
            ),
          );
        }, 7000);
        controller.signal.addEventListener(
          "abort",
          () =>
            reject(
              new MetadataUploadError(
                "Metadata request canceled or timed out.",
              ),
            ),
          { once: true },
        );
        if (controller.signal.aborted)
          reject(new MetadataUploadError("Metadata request canceled."));
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

function receiptUrl(value: unknown, origin: string, kind: "m" | "i") {
  if (typeof value !== "string" || value.length > MAX_URI) return null;
  try {
    const url = new URL(value);
    const match = (
      kind === "m"
        ? /^\/v1\/m\/([a-f0-9]{64})\.json$/
        : /^\/v1\/i\/([a-f0-9]{64})$/
    ).exec(url.pathname);
    return url.origin === origin &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? (match?.[1] ?? null)
      : null;
  } catch {
    return null;
  }
}

/** Both public objects must be available and match their hashes before preparing a transaction. */
export async function verifyStoredMetadata(
  draft: TokenDraft,
  receipt: MetadataReceipt,
  endpoint = metadataEndpoint(),
  fetcher: typeof fetch = fetch,
  options: VerifyOptions = {},
) {
  const origin = metadataOrigin(endpoint);
  const hash = origin && receiptUrl(receipt.uri, origin, "m");
  const imageHash = origin && receiptUrl(receipt.image, origin, "i");
  if (!origin || !hash || !imageHash)
    throw new MetadataUploadError(
      "The metadata host returned an unexpected address.",
    );
  for (const delay of PROPAGATION_DELAYS) {
    await pause(delay, options.signal);
    const document = await readBytes(
      fetcher,
      receipt.uri,
      { credentials: "omit", cache: "no-store" },
      16384,
      options.signal,
    );
    if ([404, 429, 503].includes(document.status)) continue;
    if (
      document.status !== 200 ||
      document.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      throw new MetadataUploadError(
        "The stored metadata could not be read back.",
      );
    if ((await sha256Hex(document.bytes)) !== hash)
      throw new MetadataUploadError(
        "The stored metadata does not match its address.",
      );
    let parsed;
    try {
      parsed = parseOffchainMetadata(
        JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(document.bytes),
        ),
        { name: draft.name.trim(), symbol: draft.symbol },
        [new URL(origin).host],
      );
    } catch {
      throw new MetadataUploadError(
        "The metadata service returned invalid JSON.",
      );
    }
    if (
      !parsed ||
      parsed.image !== receipt.image ||
      parsed.description !== draft.description.trim() ||
      (["website", "twitter", "telegram"] as const).some(
        (key) => parsed[key] !== (draft[key] ? new URL(draft[key]).href : null),
      )
    )
      throw new MetadataUploadError(
        "The stored metadata does not match your draft.",
      );
    const image = await readBytes(
      fetcher,
      receipt.image,
      { credentials: "omit", cache: "no-store" },
      MAX_IMAGE_SIZE,
      options.signal,
    );
    if ([404, 429, 503].includes(image.status)) continue;
    const draftImage = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(
      draft.image,
    );
    if (
      !draftImage ||
      image.status !== 200 ||
      image.headers.get("content-type")?.split(";")[0] !== draftImage[1]
    )
      throw new MetadataUploadError("The stored image could not be verified.");
    const original = Uint8Array.from(atob(draftImage[2]), (char) =>
      char.charCodeAt(0),
    );
    if (
      (await sha256Hex(image.bytes)) !== imageHash ||
      (await sha256Hex(original.buffer)) !== imageHash
    )
      throw new MetadataUploadError(
        "The stored image does not match your draft or its address.",
      );
    return receipt;
  }
  throw new MetadataUploadError(
    "Your upload is stored but still propagating. Wait a minute, then review the launch again. No transaction was signed or sent.",
  );
}

export async function uploadMetadata(
  draft: TokenDraft,
  endpoint = metadataEndpoint(),
  fetcher: typeof fetch = fetch,
  options: VerifyOptions = {},
) {
  const origin = metadataOrigin(endpoint);
  if (!origin)
    throw new MetadataUploadError(
      "RETRY's metadata host is not configured for HTTPS.",
    );
  const response = await readBytes(
    fetcher,
    `${origin}/v1/metadata`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: draft.name.trim(),
        symbol: draft.symbol,
        description: draft.description.trim(),
        image: draft.image,
        website: draft.website || undefined,
        twitter: draft.twitter || undefined,
        telegram: draft.telegram || undefined,
      }),
    },
    16384,
    options.signal,
  ).catch((cause: unknown) => {
    if (cause instanceof MetadataUploadError) throw cause;
    throw new MetadataUploadError(
      "The upload service is unavailable or needs a tester session. Use Authorize uploads, then review again. No launch was sent.",
    );
  });
  if (response.status === 429)
    throw new MetadataUploadError(
      "Too many uploads. Wait a minute before trying again.",
    );
  if ([401, 403].includes(response.status))
    throw new MetadataUploadError(
      "Authorize uploads with your approved tester account, then return to RETRY.",
    );
  if (![201, 202].includes(response.status))
    throw new MetadataUploadError(
      "The metadata host refused this token or is unavailable.",
    );
  let receipt: MetadataReceipt;
  try {
    receipt = JSON.parse(new TextDecoder().decode(response.bytes));
  } catch {
    throw new MetadataUploadError(
      "Authorize uploads before preparing a launch. The service did not return a valid receipt.",
    );
  }
  if (
    !receipt ||
    !receiptUrl(receipt.uri, origin, "m") ||
    !receiptUrl(receipt.image, origin, "i")
  )
    throw new MetadataUploadError(
      "The metadata host returned an unexpected address.",
    );
  options.onStored?.({ uri: receipt.uri, image: receipt.image });
  return verifyStoredMetadata(draft, receipt, endpoint, fetcher, options);
}
