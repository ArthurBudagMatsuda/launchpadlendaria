import type { TokenDraft } from "@/lib/validation";
import {
  isTrustedUrl,
  MAX_URI,
  parseOffchainMetadata,
  trustedMetadataHosts,
} from "./metadata";

/**
 * Client for RETRY's metadata host (infra/metadata-worker). It stores the
 * token JSON and image under their SHA-256, so a URI can never point to
 * different content later. GitHub Pages cannot run a server, so the host is
 * a separate free-tier Worker configured with NEXT_PUBLIC_RETRY_METADATA_URL.
 */
export function metadataEndpoint(
  value = process.env.NEXT_PUBLIC_RETRY_METADATA_URL,
) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export class MetadataUploadError extends Error {}

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Upload the draft, then read the stored JSON back and check that its hash
 * matches its address and its fields match the draft. Returns the URI that
 * goes on-chain.
 */
export async function uploadMetadata(
  draft: TokenDraft,
  endpoint = metadataEndpoint(),
  fetcher: typeof fetch = fetch,
) {
  if (!endpoint)
    throw new MetadataUploadError("RETRY's metadata host is not configured.");
  const response = await fetcher(`${endpoint}/v1/metadata`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    referrerPolicy: "no-referrer",
    body: JSON.stringify({
      name: draft.name.trim(),
      symbol: draft.symbol,
      description: draft.description.trim(),
      image: draft.image,
      website: draft.website || undefined,
      twitter: draft.twitter || undefined,
      telegram: draft.telegram || undefined,
    }),
  });
  if (response.status === 429)
    throw new MetadataUploadError(
      "Too many uploads from this connection. Try again later.",
    );
  if (response.status === 401 || response.status === 403)
    throw new MetadataUploadError(
      "Sign in to the authorized metadata test service before uploading.",
    );
  if (!response.ok)
    throw new MetadataUploadError("The metadata host refused this token.");
  const body = (await response.json()) as { uri?: unknown };
  const uri = body.uri;
  const hosts = trustedMetadataHosts({ metadata: endpoint });
  if (
    typeof uri !== "string" ||
    uri.length > MAX_URI ||
    !isTrustedUrl(uri, hosts)
  )
    throw new MetadataUploadError(
      "The metadata host returned an unexpected address.",
    );
  const hash = /\/v1\/m\/([0-9a-f]{64})\.json$/.exec(
    new URL(uri).pathname,
  )?.[1];
  const stored = await fetcher(uri, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!hash || !stored.ok)
    throw new MetadataUploadError(
      "The stored metadata could not be read back.",
    );
  const bytes = await stored.arrayBuffer();
  if ((await sha256Hex(bytes)) !== hash)
    throw new MetadataUploadError(
      "The stored metadata does not match its address.",
    );
  const parsed = parseOffchainMetadata(
    JSON.parse(new TextDecoder().decode(bytes)),
    { name: draft.name.trim(), symbol: draft.symbol },
    hosts,
  );
  if (!parsed?.image || parsed.description !== draft.description.trim())
    throw new MetadataUploadError(
      "The stored metadata does not match your draft.",
    );
  return { uri, image: parsed.image };
}
