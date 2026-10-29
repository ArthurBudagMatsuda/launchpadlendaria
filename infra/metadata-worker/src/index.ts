import {
  imageSignature,
  MAX_IMAGE_SIZE,
  validateDraft,
  type TokenDraft,
} from "../../../src/lib/validation";
import { accessConfigured, accessVerifier, type AccessConfig } from "./access";

/**
 * RETRY metadata host: a Cloudflare Worker with one KV namespace.
 *
 *   POST /v1/metadata       store a token's image and Metaplex JSON
 *   GET  /v1/m/<sha>.json   content-addressed JSON
 *   GET  /v1/i/<sha>        content-addressed image
 *
 * SHA-256 makes changes detectable; KV administrators can still replace or
 * delete objects. Storage is persistent, not an immutability guarantee.
 * Uploads require an Access test-operator session; reads remain public.
 * The Cloudflare rate binding is approximate and is not a spending cap.
 */

/** The subset of Cloudflare's KV binding this Worker uses. */
export interface KV {
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  getWithMetadata<M>(
    key: string,
    type: "arrayBuffer",
  ): Promise<{ value: ArrayBuffer | null; metadata: M | null }>;
  put(
    key: string,
    value: ArrayBuffer | string,
    options?: { expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
}

export interface Env extends AccessConfig {
  METADATA: KV;
  /** Public origin of this Worker, e.g. https://retry-metadata.example.workers.dev */
  PUBLIC_URL: string;
  /** Origins allowed to upload (comma separated). Reads are open to all. */
  ALLOWED_ORIGINS: string;
  /** Cloudflare's approximate, per-location rate limiter; not a billing cap. */
  UPLOAD_RATE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}

const MAX_BODY = 3_000_000;
const IMMUTABLE = "public, max-age=31536000, immutable";

async function sha256(bytes: ArrayBuffer | Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
      ...headers,
    },
  });
}

function cors(origin: string | null, env: Env) {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim());
  return origin && allowed.includes(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
        vary: "origin",
      }
    : null;
}

function decodeImage(dataUrl: string) {
  try {
    const match =
      /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/]+=*)$/i.exec(dataUrl);
    if (!match) return null;
    const binary = atob(match[2]);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if (bytes.length > MAX_IMAGE_SIZE) return null;
    if (
      match[1].toLowerCase() === "image/png" &&
      ![137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)
    )
      return null;
    if (imageSignature(bytes.subarray(0, 12)) !== match[1].toLowerCase())
      return null;
    return { bytes, type: match[1].toLowerCase() };
  } catch {
    return null;
  }
}

async function boundedBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY)
    return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function upload(
  request: Request,
  env: Env,
  authorize: ReturnType<typeof accessVerifier>,
) {
  const headers = cors(request.headers.get("origin"), env);
  if (!headers) return json(403, { error: "origin not allowed" });
  if (!accessConfigured(env) || !env.UPLOAD_RATE_LIMITER)
    return json(
      503,
      { error: "upload authorization is not configured" },
      headers,
    );
  const subject = await authorize(request, env);
  if (!subject)
    return json(
      401,
      { error: "authorized test operator session required" },
      headers,
    );
  const rate = await env.UPLOAD_RATE_LIMITER.limit({
    key: await sha256(new TextEncoder().encode(subject)),
  });
  if (!rate.success) return json(429, { error: "rate limited" }, headers);
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return json(415, { error: "application/json required" }, headers);
  let body: Record<string, unknown>;
  try {
    const raw = await boundedBody(request);
    if (raw === null) return json(413, { error: "too large" }, headers);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json(400, { error: "JSON object required" }, headers);
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid json" }, headers);
  }
  const text = (key: string) =>
    typeof body[key] === "string" ? (body[key] as string) : "";
  const draft: TokenDraft = {
    name: text("name").trim(),
    symbol: text("symbol"),
    description: text("description").trim(),
    image: text("image"),
    website: text("website"),
    twitter: text("twitter"),
    telegram: text("telegram"),
  };
  const errors = validateDraft(draft);
  for (const key of ["website", "twitter", "telegram"] as const) {
    if (draft[key].length > 2048) errors[key] = "too long";
    if (draft[key]) {
      try {
        const url = new URL(draft[key]);
        if (url.username || url.password)
          errors[key] = "credentials are not allowed";
      } catch {
        errors[key] = "invalid URL";
      }
    }
  }
  if (new TextEncoder().encode(draft.name).length > 32)
    errors.name = "too long";
  const image = decodeImage(draft.image);
  if (!image) errors.image = "invalid image";
  if (Object.keys(errors).length || !image)
    return json(
      422,
      { error: "invalid token", fields: Object.keys(errors) },
      headers,
    );
  const base = env.PUBLIC_URL.replace(/\/+$/, "");
  const publicUrl = new URL(base);
  if (
    publicUrl.protocol !== "https:" ||
    publicUrl.origin !== base ||
    publicUrl.username ||
    publicUrl.password
  )
    return json(503, { error: "invalid public metadata origin" }, headers);
  const imageHash = await sha256(image.bytes);
  if (!(await env.METADATA.get(`i:${imageHash}`, "arrayBuffer")))
    await env.METADATA.put(
      `i:${imageHash}`,
      image.bytes.buffer as ArrayBuffer,
      {
        metadata: { type: image.type },
      },
    );
  const extensions: Record<string, string> = {};
  for (const key of ["website", "twitter", "telegram"] as const)
    if (draft[key]) extensions[key] = draft[key];
  const document = new TextEncoder().encode(
    JSON.stringify({
      name: draft.name,
      symbol: draft.symbol,
      description: draft.description,
      image: `${base}/v1/i/${imageHash}`,
      extensions,
      properties: {
        files: [{ uri: `${base}/v1/i/${imageHash}`, type: image.type }],
      },
      createdOn: "RETRY",
    }),
  );
  const hash = await sha256(document);
  if (!(await env.METADATA.get(`m:${hash}`, "arrayBuffer")))
    await env.METADATA.put(`m:${hash}`, document.buffer as ArrayBuffer, {
      metadata: { type: "application/json" },
    });
  return json(
    201,
    {
      uri: `${base}/v1/m/${hash}.json`,
      image: `${base}/v1/i/${imageHash}`,
      id: hash,
      mediaType: image.type,
      storage: "persistent-kv",
    },
    headers,
  );
}

async function serve(key: string, env: Env) {
  const { value, metadata } = await env.METADATA.getWithMetadata<{
    type: string;
  }>(key, "arrayBuffer");
  if (!value || !metadata) return json(404, { error: "not found" });
  return new Response(value, {
    headers: {
      "content-type": metadata.type,
      "cache-control": IMMUTABLE,
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}

export function createMetadataWorker(accessFetch: typeof fetch = fetch) {
  const authorize = accessVerifier(accessFetch);
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") {
        const headers = cors(request.headers.get("origin"), env);
        return new Response(null, {
          status: headers ? 204 : 403,
          headers: {
            ...headers,
            "access-control-allow-methods": "POST",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "86400",
          },
        });
      }
      if (request.method === "POST" && url.pathname === "/v1/metadata") {
        try {
          return await upload(request, env, authorize);
        } catch {
          return json(
            503,
            { error: "metadata storage temporarily unavailable" },
            cors(request.headers.get("origin"), env) ?? {},
          );
        }
      }
      if (request.method === "GET") {
        const document = /^\/v1\/m\/([0-9a-f]{64})\.json$/.exec(url.pathname);
        if (document) {
          try {
            return await serve(`m:${document[1]}`, env);
          } catch {
            return json(
              503,
              { error: "metadata storage temporarily unavailable" },
              { "access-control-allow-origin": "*" },
            );
          }
        }
        const image = /^\/v1\/i\/([0-9a-f]{64})$/.exec(url.pathname);
        if (image) {
          try {
            return await serve(`i:${image[1]}`, env);
          } catch {
            return json(
              503,
              { error: "metadata storage temporarily unavailable" },
              { "access-control-allow-origin": "*" },
            );
          }
        }
      }
      return json(404, { error: "not found" });
    },
  };
}

export default createMetadataWorker();
