import {
  imageSignature,
  MAX_IMAGE_SIZE,
  validateDraft,
  type TokenDraft,
} from "../../../src/lib/validation";
import { accessConfigured, accessVerifier, type AccessConfig } from "./access";
import { validImageContainer } from "./image";
import {
  approvedWallets,
  nonceRequest,
  walletAuthConfigured,
  type WalletAuthConfig,
} from "./wallet-auth";
import { uploadBodyHash } from "../../../src/lib/meteora/upload-challenge";
export { UploadNonceCoordinator } from "./wallet-auth";

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

export interface Env extends AccessConfig, WalletAuthConfig {
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
class ContentConflict extends Error {}
class BodyTimeout extends Error {}

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
    const type = match[1].toLowerCase();
    return validImageContainer(bytes, type) ? { bytes, type } : null;
  } catch {
    return null;
  }
}

async function boundedBody(request: Request, max = MAX_BODY) {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new BodyTimeout());
      void reader.cancel();
    }, 5000);
  });
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      length += value.byteLength;
      if (length > max) {
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
  } finally {
    clearTimeout(timer);
  }
}

/** Never replace mismatching content. Concurrent identical writes are not an atomic lock. */
async function storeContent(
  env: Env,
  key: string,
  bytes: ArrayBuffer,
  type: string,
) {
  const expected = key.slice(2);
  const check = async () => {
    const stored = await env.METADATA.getWithMetadata<{ type: string }>(
      key,
      "arrayBuffer",
    );
    if (
      stored.value &&
      ((await sha256(stored.value)) !== expected ||
        stored.metadata?.type !== type)
    )
      throw new ContentConflict();
    return !!stored.value;
  };
  if (await check()) return true;
  await env.METADATA.put(key, bytes, { metadata: { type } });
  return check();
}

async function upload(
  request: Request,
  env: Env,
  authorize: ReturnType<typeof accessVerifier>,
) {
  const headers = cors(request.headers.get("origin"), env);
  if (!headers) return json(403, { error: "origin not allowed" });
  const walletMode = env.UPLOAD_AUTH_MODE === "wallet-devnet";
  if (
    !(walletMode
      ? walletAuthConfigured(env)
      : (!env.UPLOAD_AUTH_MODE || env.UPLOAD_AUTH_MODE === "access") &&
        accessConfigured(env)) ||
    !env.UPLOAD_RATE_LIMITER
  )
    return json(
      503,
      { error: "upload authorization is not configured" },
      headers,
    );
  const wallet = request.headers.get("x-retry-wallet") ?? "";
  const subject = walletMode
    ? approvedWallets(env).includes(wallet)
      ? wallet
      : null
    : await authorize(request, env);
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
  let rawBody = "";
  try {
    const raw = await boundedBody(request);
    if (raw === null) return json(413, { error: "too large" }, headers);
    rawBody = raw;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json(400, { error: "JSON object required" }, headers);
    body = parsed as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof BodyTimeout)
      return json(408, { error: "upload body timed out" }, headers);
    return json(400, { error: "invalid json" }, headers);
  }
  if (
    Object.keys(body).some(
      (key) =>
        ![
          "name",
          "symbol",
          "description",
          "image",
          "website",
          "twitter",
          "telegram",
        ].includes(key),
    )
  )
    return json(422, { error: "unsupported token fields" }, headers);
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
  for (const key of ["name", "description"] as const)
    if (/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(draft[key]))
      errors[key] = "unsafe text";
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
  if (walletMode) {
    const authorized = await nonceRequest(env, wallet, "consume", {
      wallet,
      origin: request.headers.get("origin"),
      uploadUri: `${base}/v1/metadata`,
      nonce: request.headers.get("x-retry-nonce"),
      signature: request.headers.get("x-retry-signature"),
      bodySha256: await uploadBodyHash(rawBody),
    });
    if (authorized.status !== 200)
      return json(authorized.status, await authorized.json(), headers);
  }
  const imageHash = await sha256(image.bytes);
  const imageReady = await storeContent(
    env,
    `i:${imageHash}`,
    image.bytes.buffer as ArrayBuffer,
    image.type,
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
  const documentReady = await storeContent(
    env,
    `m:${hash}`,
    document.buffer as ArrayBuffer,
    "application/json",
  );
  return json(
    imageReady && documentReady ? 201 : 202,
    {
      uri: `${base}/v1/m/${hash}.json`,
      image: `${base}/v1/i/${imageHash}`,
      id: hash,
      mediaType: image.type,
      storage: "persistent-kv",
      availability:
        imageReady && documentReady
          ? "verified-at-upload-location"
          : "propagating",
    },
    headers,
  );
}

async function serve(key: string, env: Env) {
  const { value, metadata } = await env.METADATA.getWithMetadata<{
    type: string;
  }>(key, "arrayBuffer");
  if (!value || !metadata) return json(404, { error: "not found" });
  if (
    (await sha256(value)) !== key.slice(2) ||
    !(key.startsWith("m:")
      ? metadata.type === "application/json"
      : ["image/png", "image/jpeg", "image/webp"].includes(metadata.type))
  )
    return json(
      503,
      { error: "stored content failed verification" },
      { "access-control-allow-origin": "*" },
    );
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
      if (request.method === "POST" && url.pathname === "/v1/auth/challenge") {
        const headers = cors(request.headers.get("origin"), env);
        if (!headers) return json(403, { error: "origin not allowed" });
        if (!walletAuthConfigured(env) || !env.UPLOAD_RATE_LIMITER)
          return json(
            503,
            { error: "wallet upload authorization is not configured" },
            headers,
          );
        try {
          const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
          const rate = await env.UPLOAD_RATE_LIMITER.limit({
            key: `challenge:${await sha256(new TextEncoder().encode(ip))}`,
          });
          if (!rate.success)
            return json(429, { error: "rate limited" }, headers);
          if (
            request.headers
              .get("content-type")
              ?.split(";")[0]
              .trim()
              .toLowerCase() !== "application/json"
          )
            return json(415, { error: "application/json required" }, headers);
          const raw = await boundedBody(request, 1024);
          if (raw === null)
            return json(413, { error: "challenge too large" }, headers);
          const body = JSON.parse(raw);
          if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body) ||
            Object.keys(body).some(
              (key) => !["wallet", "bodySha256"].includes(key),
            ) ||
            typeof body.wallet !== "string" ||
            !approvedWallets(env).includes(body.wallet)
          )
            return json(
              401,
              { error: "approved Devnet test wallet required" },
              headers,
            );
          if (
            typeof body.bodySha256 !== "string" ||
            !/^[a-f0-9]{64}$/.test(body.bodySha256)
          )
            return json(400, { error: "invalid content hash" }, headers);
          const publicUrl = new URL(env.PUBLIC_URL);
          if (
            publicUrl.protocol !== "https:" ||
            publicUrl.origin !== env.PUBLIC_URL
          )
            return json(503, { error: "invalid upload URI" }, headers);
          const response = await nonceRequest(env, body.wallet, "issue", {
            ...body,
            origin: request.headers.get("origin"),
            uploadUri: `${publicUrl.origin}/v1/metadata`,
          });
          return json(response.status, await response.json(), headers);
        } catch (cause) {
          if (cause instanceof SyntaxError)
            return json(400, { error: "invalid JSON" }, headers);
          return json(
            503,
            { error: "wallet authorization temporarily unavailable" },
            headers,
          );
        }
      }
      if (request.method === "GET" && url.pathname === "/v1/metadata") {
        try {
          const authorized =
            accessConfigured(env) && (await authorize(request, env));
          return json(authorized ? 200 : 401, {
            authorized: !!authorized,
            message: authorized
              ? "Upload access ready. Return to RETRY and review your launch."
              : "An approved tester session is required.",
          });
        } catch {
          return json(503, { error: "authorization unavailable" });
        }
      }
      if (request.method === "OPTIONS") {
        if (!["/v1/metadata", "/v1/auth/challenge"].includes(url.pathname))
          return json(404, { error: "not found" });
        const headers = cors(request.headers.get("origin"), env);
        return new Response(null, {
          status: headers ? 204 : 403,
          headers: {
            ...headers,
            "access-control-allow-methods": "POST",
            "access-control-allow-headers":
              "content-type, x-retry-wallet, x-retry-nonce, x-retry-signature",
            "access-control-max-age": "86400",
          },
        });
      }
      if (request.method === "POST" && url.pathname === "/v1/metadata") {
        try {
          return await upload(request, env, authorize);
        } catch (cause) {
          if (cause instanceof ContentConflict)
            return json(
              409,
              {
                error:
                  "stored content does not match its address; refusing replacement",
              },
              cors(request.headers.get("origin"), env) ?? {},
            );
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
