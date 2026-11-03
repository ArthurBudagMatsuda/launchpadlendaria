// LOCAL WORKER RUNTIME ONLY. Fake Access issuer, real RSA signatures, disk KV.
// Does not access Cloudflare accounts or publish any object.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { accessFixture } from "../tests/fixtures/cloudflare-access.ts";
const require = createRequire(import.meta.url);
const { Miniflare, convertV4MiniflareOptions } = createRequire(
  require.resolve("wrangler/package.json"),
)("miniflare");
const directory = fileURLToPath(new URL("../.qa/stage-8/", import.meta.url));
await mkdir(directory, { recursive: true });
const access = await accessFixture();
const origin = "https://metadata.retry.test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const options = convertV4MiniflareOptions({
  name: "retry-stage8-local-metadata",
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
  resourcePersistencePath: `${directory}/kv-runtime`,
  kvNamespaces: { METADATA: "stage8-local-only" },
  ratelimits: {
    UPLOAD_RATE_LIMITER: {
      namespace_id: "8008",
      simple: { limit: 10, period: 60 },
    },
  },
  bindings: {
    PUBLIC_URL: origin,
    ALLOWED_ORIGINS: origin,
    ACCESS_TEAM_DOMAIN: access.issuer,
    ACCESS_AUDIENCE: access.audience,
  },
  outboundService: async (request) => access.fetcher(request.url),
});
let runtime;
const post = (assertion = access.token) =>
  runtime.dispatchFetch(`${origin}/v1/metadata`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      ...(assertion ? { "cf-access-jwt-assertion": assertion } : {}),
    },
    body: JSON.stringify({
      name: "RETRY Runtime Test",
      symbol: "RTKV",
      description: "Local persistent KV validation only.",
      image: `data:image/png;base64,${png.toString("base64")}`,
    }),
  });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function readBack(receipt) {
  const document = await runtime.dispatchFetch(receipt.uri);
  const image = await runtime.dispatchFetch(receipt.image);
  assert.equal(document.status, 200);
  assert.equal(image.status, 200);
  assert.equal(document.headers.get("content-type"), "application/json");
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(image.headers.get("x-content-type-options"), "nosniff");
  assert.match(document.headers.get("cache-control"), /immutable/);
  const json = Buffer.from(await document.arrayBuffer());
  const bytes = Buffer.from(await image.arrayBuffer());
  assert.equal(hash(json), receipt.id);
  assert.equal(hash(bytes), receipt.image.split("/").at(-1));
  assert.deepEqual(bytes, png);
  assert.equal(JSON.parse(json).image, receipt.image);
  return { metadataSha256: hash(json), imageSha256: hash(bytes) };
}
try {
  runtime = new Miniflare(options);
  await runtime.ready;
  assert.equal((await post(null)).status, 401);
  assert.equal((await post("invalid")).status, 401);
  const uploaded = await post();
  assert.equal(uploaded.status, 201);
  const receipt = await uploaded.json();
  const integrity = await readBack(receipt);
  await runtime.dispose();
  runtime = new Miniflare(options);
  await runtime.ready;
  assert.deepEqual(await readBack(receipt), integrity);
  let limited = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await post();
    if (response.status === 429) {
      limited = true;
      break;
    }
    assert.equal(response.status, 201);
  }
  assert.equal(limited, true);
  const evidence = {
    evidence: "LOCAL_WORKER_RUNTIME",
    at: new Date().toISOString(),
    runtime: "Miniflare/workerd",
    cloudflareDeployed: false,
    access: "simulated issuer; genuine RSA verification",
    kv: "local disk; survived runtime restart",
    anonymous: 401,
    invalidJwt: 401,
    authenticated: 201,
    publicReads: 200,
    nativeRateLimiter: 429,
    ...integrity,
  };
  await writeFile(
    `${directory}/metadata-runtime.json`,
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
} finally {
  await runtime?.dispose();
}
