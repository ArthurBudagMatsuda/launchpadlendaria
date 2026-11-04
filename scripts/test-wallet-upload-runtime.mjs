// Local workerd, real Ed25519, SQLite Durable Object and disk KV. No remote writes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getAddressDecoder } from "@solana/kit";
const require = createRequire(import.meta.url);
const { Miniflare, convertV4MiniflareOptions } = createRequire(
  require.resolve("wrangler/package.json"),
)("miniflare");
const directory = fileURLToPath(new URL("../.qa/stage-9/", import.meta.url));
await mkdir(directory, { recursive: true });
const keys = generateKeyPairSync("ed25519");
const wallet = getAddressDecoder().decode(
  Buffer.from(keys.publicKey.export({ format: "jwk" }).x, "base64url"),
);
const origin = "https://retry-local-runtime.vercel.app";
const host = "https://metadata.retry.test";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const options = convertV4MiniflareOptions({
  name: "retry-stage9-local-wallet-upload",
  host: "127.0.0.1",
  port: 0,
  modules: true,
  scriptPath: fileURLToPath(
    new URL(
      "../.qa/metadata-worker-validation/bundle/index.js",
      import.meta.url,
    ),
  ),
  compatibilityDate: "2026-10-23",
  resourcePersistencePath: `${directory}/wallet-runtime`,
  kvNamespaces: { METADATA: "stage9-local-only" },
  durableObjects: {
    UPLOAD_NONCES: { className: "UploadNonceCoordinator", useSQLite: true },
  },
  ratelimits: {
    UPLOAD_RATE_LIMITER: {
      namespace_id: "8008",
      simple: { limit: 10, period: 60 },
    },
  },
  bindings: {
    PUBLIC_URL: host,
    ALLOWED_ORIGINS: origin,
    UPLOAD_AUTH_MODE: "wallet-devnet",
    WALLET_AUTH_TESTERS: wallet,
  },
});
const body = JSON.stringify({
  name: "RETRY Runtime Auth",
  symbol: "RTAUTH",
  description: "Local runtime only. No SPL token.",
  image:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
});
let runtime;
const post = (path, payload, headers = {}, from = origin) =>
  runtime.dispatchFetch(`${host}${path}`, {
    method: "POST",
    headers: { origin: from, "content-type": "application/json", ...headers },
    body: payload,
  });
const challenge = async (payload) => {
  const response = await post(
    "/v1/auth/challenge",
    JSON.stringify({ wallet, bodySha256: hash(payload) }),
  );
  assert.equal(response.status, 200);
  const c = await response.json();
  return {
    "x-retry-wallet": wallet,
    "x-retry-nonce": c.nonce,
    "x-retry-signature": sign(
      null,
      Buffer.from(c.message),
      keys.privateKey,
    ).toString("hex"),
  };
};
try {
  runtime = new Miniflare(options);
  await runtime.ready;
  assert.equal((await post("/v1/metadata", body)).status, 401);
  const proof = await challenge(body);
  const uploaded = await post("/v1/metadata", body, proof);
  assert.equal(uploaded.status, 201);
  const receipt = await uploaded.json();
  const metadata = await runtime.dispatchFetch(receipt.uri);
  assert.equal(metadata.status, 200);
  assert.equal(hash(Buffer.from(await metadata.arrayBuffer())), receipt.id);
  const replay = await post("/v1/metadata", body, proof);
  assert.equal(replay.status, 409);
  const secondBody = body + " ";
  const second = await challenge(secondBody);
  const concurrent = await Promise.all(
    Array.from({ length: 6 }, () => post("/v1/metadata", secondBody, second)),
  );
  assert.deepEqual(
    concurrent.map((r) => r.status).sort(),
    [201, 409, 409, 409, 409, 409],
  );
  assert.equal(
    (
      await post("/v1/metadata", body, {
        ...proof,
        "x-retry-signature": "00".repeat(64),
      })
    ).status,
    401,
  );
  assert.equal(
    (await post("/v1/metadata", body, proof, "https://unapproved.test")).status,
    403,
  );
  await runtime.dispose();
  runtime = new Miniflare(options);
  await runtime.ready;
  assert.equal((await runtime.dispatchFetch(receipt.uri)).status, 200);
  assert.equal((await post("/v1/metadata", body, proof)).status, 409);
  const evidence = {
    evidence: "LOCAL_WORKER_RUNTIME",
    at: new Date().toISOString(),
    runtime: "Miniflare/workerd",
    authentication: "real Ed25519 with disposable in-memory local key",
    nonceStorage:
      "SQLite-backed Durable Object; replay refused after runtime restart",
    kv: "disk; survived restart",
    anonymous: 401,
    authenticated: 201,
    publicRead: 200,
    replay: 409,
    concurrentStatuses: concurrent.map((r) => r.status).sort(),
    invalidSignature: 401,
    unapprovedOrigin: 403,
    metadataSha256: receipt.id,
    publicDevnetTransactions: 0,
    realPhantom: false,
  };
  await writeFile(
    `${directory}/wallet-upload-runtime.json`,
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
} finally {
  await runtime?.dispose();
}
