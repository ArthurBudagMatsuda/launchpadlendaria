import { describe, expect, it } from "vitest";
import {
  createMetadataWorker,
  type Env,
  type KV,
} from "../infra/metadata-worker/src/index";
import { accessFixture, rateLimitFixture } from "./fixtures/cloudflare-access";
import { uploadMetadata } from "@/lib/meteora/metadata-upload";
import { emptyDraft } from "@/lib/validation";
const access = await accessFixture();
const worker = createMetadataWorker(access.fetcher);

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
    ACCESS_TEAM_DOMAIN: access.issuer,
    ACCESS_AUDIENCE: access.audience,
    UPLOAD_RATE_LIMITER: rateLimitFixture(Number(limit)),
  };
  // Route the app's fetches straight into the Worker.
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const headers = new Headers(request.headers);
    headers.set("origin", ORIGIN);
    headers.set("cf-connecting-ip", "203.0.113.7");
    headers.set("cf-access-jwt-assertion", access.token);
    return worker.fetch(new Request(request, { headers }), env);
  }) as typeof fetch;
  return { env, fetcher };
}

const post = (
  env: Env,
  body: unknown,
  origin = ORIGIN,
  assertion: string | null = access.token,
) =>
  worker.fetch(
    new Request("https://meta.retry.test/v1/metadata", {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.9",
        ...(assertion ? { "cf-access-jwt-assertion": assertion } : {}),
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

  it("limits authorized uploads through the binding", async () => {
    const { env } = setup("2");
    expect((await post(env, draft)).status).toBe(201);
    expect((await post(env, draft)).status).toBe(201);
    expect((await post(env, draft)).status).toBe(429);
  });

  it("fails closed without Access configuration or the rate binding", async () => {
    const { env } = setup();
    expect(
      (await post({ ...env, ACCESS_AUDIENCE: undefined }, draft)).status,
    ).toBe(503);
    expect(
      (await post({ ...env, UPLOAD_RATE_LIMITER: undefined }, draft)).status,
    ).toBe(503);
  });

  it("does not treat an allowed or forged Origin as authentication", async () => {
    const { env } = setup();
    expect((await post(env, draft, ORIGIN, null)).status).toBe(401);
    expect((await post(env, draft, ORIGIN, "fake.jwt.value")).status).toBe(401);
    expect((env.METADATA as ReturnType<typeof memoryKv>).size()).toBe(0);
  });

  it("rejects expired tokens, another issuer and another audience", async () => {
    const { env } = setup();
    for (const token of [
      await access.issue({ expiration: 1 }),
      await access.issue({ issuer: "https://attacker.example" }),
      await access.issue({ audience: "other-app" }),
    ])
      expect((await post(env, draft, ORIGIN, token)).status).toBe(401);
  });

  it("rejects an invalid cryptographic signature", async () => {
    const { env } = setup();
    const parts = access.token.split(".");
    parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
    expect((await post(env, draft, ORIGIN, parts.join("."))).status).toBe(401);
  });

  it("uses credentialed CORS only for the explicit origin, including preflight", async () => {
    const { env } = setup();
    const request = (origin: string) =>
      worker.fetch(
        new Request("https://meta.retry.test/v1/metadata", {
          method: "OPTIONS",
          headers: { origin, "access-control-request-method": "POST" },
        }),
        env,
      );
    const allowed = await request(ORIGIN);
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(allowed.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect((await request("https://evil.example")).status).toBe(403);
  });

  it("returns controlled errors for malformed JSON, null and malformed base64", async () => {
    const { env } = setup();
    expect((await post(env, null)).status).toBe(400);
    expect((await post(env, [])).status).toBe(400);
    expect(
      (await post(env, { ...draft, image: "data:image/png;base64,A" })).status,
    ).toBe(422);
    const response = await worker.fetch(
      new Request("https://meta.retry.test/v1/metadata", {
        method: "POST",
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "cf-access-jwt-assertion": access.token,
        },
        body: "{",
      }),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("bounds a streamed body in bytes without trusting content-length", async () => {
    const { env } = setup();
    const response = await worker.fetch(
      new Request("https://meta.retry.test/v1/metadata", {
        method: "POST",
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "cf-access-jwt-assertion": access.token,
        },
        body: "x".repeat(3_000_001),
      }),
      env,
    );
    expect(response.status).toBe(413);
    expect((env.METADATA as ReturnType<typeof memoryKv>).size()).toBe(0);
  });

  it("rejects executable types, short PNG signatures and credentials in links", async () => {
    const { env } = setup();
    for (const changed of [
      { image: "data:image/svg+xml;base64,PHN2Zy8+" },
      {
        image: `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 0, 0, 0, 0]).toString("base64")}`,
      },
      { website: "https://user:password@example.com" },
      { website: "javascript:alert(1)" },
    ])
      expect((await post(env, { ...draft, ...changed })).status).toBe(422);
  });

  it("returns controlled storage failures without exposing the cause", async () => {
    const { env } = setup();
    env.METADATA.put = async () => {
      throw new Error("PRIVATE_STORAGE_DETAIL");
    };
    const response = await post(env, draft);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_STORAGE_DETAIL");
  });

  it("does not claim an upload worked when the network fails", async () => {
    await expect(
      uploadMetadata(draft, "https://meta.retry.test", async () => {
        throw new Error("network unavailable");
      }),
    ).rejects.toThrow(/network unavailable/);
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
