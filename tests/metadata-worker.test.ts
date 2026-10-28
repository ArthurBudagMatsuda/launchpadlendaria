import { describe, expect, it } from "vitest";
import worker, { type Env, type KV } from "../infra/metadata-worker/src/index";
import { uploadMetadata } from "@/lib/meteora/metadata-upload";
import { emptyDraft } from "@/lib/validation";

// Unit tests of the Worker's logic with an in-memory KV (a test double, not
// Cloudflare). Deployment itself is covered by infra/metadata-worker/README.md.
function memoryKv(): KV & { size: () => number } {
  const data = new Map<string, { value: ArrayBuffer; metadata: unknown }>();
  const toBuffer = (value: ArrayBuffer | string) =>
    typeof value === "string"
      ? (new TextEncoder().encode(value).buffer as ArrayBuffer)
      : value;
  return {
    async get(key) {
      return data.get(key)?.value ?? null;
    },
    async getWithMetadata<M>(key: string) {
      const entry = data.get(key);
      return {
        value: entry?.value ?? null,
        metadata: (entry?.metadata as M) ?? null,
      };
    },
    async put(key, value, options) {
      data.set(key, {
        value: toBuffer(value),
        metadata: options?.metadata ?? null,
      });
    },
    size: () => data.size,
  };
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const draft = {
  ...emptyDraft,
  name: "Orbit Cat",
  symbol: "ORBIT",
  description: "A cat that keeps trying to reach orbit.",
  image: `data:image/png;base64,${PNG.toString("base64")}`,
  twitter: "https://x.com/orbitcat",
};
const ORIGIN = "https://arthurbudagmatsuda.github.io";

function setup(limit = "10") {
  const env: Env = {
    METADATA: memoryKv(),
    PUBLIC_URL: "https://meta.retry.test",
    ALLOWED_ORIGINS: `${ORIGIN},http://127.0.0.1:3000`,
    UPLOADS_PER_HOUR: limit,
  };
  // Route the app's fetches straight into the Worker.
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const headers = new Headers(request.headers);
    headers.set("origin", ORIGIN);
    headers.set("cf-connecting-ip", "203.0.113.7");
    return worker.fetch(new Request(request, { headers }), env);
  }) as typeof fetch;
  return { env, fetcher };
}

const post = (env: Env, body: unknown, origin = ORIGIN) =>
  worker.fetch(
    new Request("https://meta.retry.test/v1/metadata", {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.9",
      },
      body: JSON.stringify(body),
    }),
    env,
  );

describe("metadata worker", () => {
  it("stores content-addressed JSON and image that the app verifies on read-back", async () => {
    const { fetcher } = setup();
    const result = await uploadMetadata(
      draft,
      "https://meta.retry.test",
      fetcher,
    );
    expect(result.uri).toMatch(
      /^https:\/\/meta\.retry\.test\/v1\/m\/[0-9a-f]{64}\.json$/,
    );
    expect(result.image).toMatch(
      /^https:\/\/meta\.retry\.test\/v1\/i\/[0-9a-f]{64}$/,
    );
    const image = await fetcher(result.image);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(image.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await image.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("returns the same URI for the same token (idempotent, no duplicates)", async () => {
    const { fetcher } = setup();
    const a = await uploadMetadata(draft, "https://meta.retry.test", fetcher);
    const b = await uploadMetadata(draft, "https://meta.retry.test", fetcher);
    expect(a.uri).toBe(b.uri);
  });

  it("rejects other origins, invalid fields and images whose bytes lie about their type", async () => {
    const { env } = setup();
    expect((await post(env, draft, "https://evil.example")).status).toBe(403);
    expect((await post(env, { ...draft, symbol: "lower" })).status).toBe(422);
    expect(
      (await post(env, { ...draft, twitter: "https://evil.example/x" })).status,
    ).toBe(422);
    const fake = `data:image/png;base64,${Buffer.from("GIF89a-not-a-png").toString("base64")}`;
    expect((await post(env, { ...draft, image: fake })).status).toBe(422);
  });

  it("limits uploads per IP per hour", async () => {
    const { env } = setup("2");
    expect((await post(env, draft)).status).toBe(201);
    expect((await post(env, draft)).status).toBe(201);
    expect((await post(env, draft)).status).toBe(429);
  });

  it("serves 404 for unknown or malformed paths", async () => {
    const { env } = setup();
    const get = (path: string) =>
      worker.fetch(new Request(`https://meta.retry.test${path}`), env);
    expect((await get(`/v1/m/${"0".repeat(64)}.json`)).status).toBe(404);
    expect((await get("/v1/m/../secret")).status).toBe(404);
    expect((await get("/")).status).toBe(404);
  });

  it("app refuses a host that returns content not matching its hash", async () => {
    const { fetcher } = setup();
    const tampered = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetcher(input, init);
      if (String(input).includes("/v1/m/"))
        return new Response(
          JSON.stringify({ name: "Orbit Cat", symbol: "ORBIT" }),
        );
      return response;
    }) as typeof fetch;
    await expect(
      uploadMetadata(draft, "https://meta.retry.test", tampered),
    ).rejects.toThrow(/does not match its address/);
  });
});
