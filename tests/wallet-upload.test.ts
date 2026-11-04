import { afterEach, describe, expect, it, vi } from "vitest";
import { getAddressDecoder } from "@solana/kit";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import {
  createMetadataWorker,
  type Env,
  type KV,
} from "../infra/metadata-worker/src/index";
import {
  UploadNonceCoordinator,
  type NonceStorage,
} from "../infra/metadata-worker/src/wallet-auth";
import { authorizeMetadataUpload } from "@/lib/meteora/metadata-authorization";
import { uploadMetadata } from "@/lib/meteora/metadata-upload";
import {
  uploadBodyHash,
  type UploadChallenge,
} from "@/lib/meteora/upload-challenge";
import { emptyDraft } from "@/lib/validation";
import {
  vercelBetaEnvironment,
  BETA_BRANCH,
  METADATA_URL,
} from "../infra/devnet-beta/vercel-config";

const ORIGIN = "https://retry-stage9-preview.vercel.app";
const OTHER = "https://retry-stage9-second.vercel.app";
const HOST = "https://retry-solana-devnet-beta.pages.dev";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const draft = {
  ...emptyDraft,
  name: "RETRY Auth Test",
  symbol: "RAUTH",
  description: "Test-only metadata upload.",
  image: `data:image/png;base64,${PNG}`,
};
const body = JSON.stringify({
  name: draft.name,
  symbol: draft.symbol,
  description: draft.description,
  image: draft.image,
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

class SerialStorage implements NonceStorage {
  values = new Map<string, unknown>();
  tail = Promise.resolve();
  async get<T>(key: string) {
    return structuredClone(this.values.get(key)) as T | undefined;
  }
  async put(key: string, value: unknown) {
    this.values.set(key, structuredClone(value));
  }
  async transaction<T>(
    operation: (txn: NonceStorage) => Promise<T>,
  ): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((r) => {
      release = r;
    });
    await previous;
    try {
      return await operation(this);
    } finally {
      release();
    }
  }
}
async function setup() {
  const keys = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]);
  const pub = new Uint8Array(
    await crypto.subtle.exportKey("raw", keys.publicKey),
  );
  const walletAddress = getAddressDecoder().decode(pub);
  const data = new Map<string, { value: ArrayBuffer; metadata: unknown }>();
  const kv: KV = {
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
        value:
          typeof value === "string"
            ? new TextEncoder().encode(value).buffer
            : value,
        metadata: options?.metadata,
      });
    },
  };
  const storage = new SerialStorage();
  let coordinator = new UploadNonceCoordinator({ storage });
  const env: Env = {
    METADATA: kv,
    PUBLIC_URL: HOST,
    ALLOWED_ORIGINS: `${ORIGIN},${OTHER}`,
    UPLOAD_AUTH_MODE: "wallet-devnet",
    WALLET_AUTH_TESTERS: walletAddress,
    UPLOAD_NONCES: {
      idFromName: (name) => name,
      get: () => ({ fetch: (r) => coordinator.fetch(r) }),
    },
    UPLOAD_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const worker = createMetadataWorker();
  const request = (
    path: string,
    payload: string,
    headers: Record<string, string> = {},
    origin = ORIGIN,
  ) =>
    worker.fetch(
      new Request(`${HOST}${path}`, {
        method: "POST",
        headers: { origin, "content-type": "application/json", ...headers },
        body: payload,
      }),
      env,
    );
  const challenge = async (payload = body, origin = ORIGIN) => {
    const response = await request(
      "/v1/auth/challenge",
      JSON.stringify({
        wallet: walletAddress,
        bodySha256: await uploadBodyHash(payload),
      }),
      {},
      origin,
    );
    return {
      response,
      c: (await response.json()) as UploadChallenge & { message: string },
    };
  };
  const sign = async (c: UploadChallenge & { message: string }) => {
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        "Ed25519",
        keys.privateKey,
        new TextEncoder().encode(c.message),
      ),
    );
    return {
      "x-retry-wallet": walletAddress,
      "x-retry-nonce": c.nonce,
      "x-retry-signature": [...signature]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join(""),
    };
  };
  return {
    env,
    worker,
    request,
    challenge,
    sign,
    storage,
    data,
    pub,
    keys,
    walletAddress,
    restart: () => {
      coordinator = new UploadNonceCoordinator({ storage });
    },
  };
}

describe("approved Devnet wallet uploads", () => {
  it("stores verified content once, rejects replay after coordinator restart, and keeps public reads open", async () => {
    const s = await setup();
    const { c, response } = await s.challenge();
    expect(response.status).toBe(200);
    const headers = await s.sign(c);
    const uploaded = await s.request("/v1/metadata", body, headers);
    expect(uploaded.status).toBe(201);
    const receipt = await uploaded.json();
    expect((await s.worker.fetch(new Request(receipt.uri), s.env)).status).toBe(
      200,
    );
    expect(s.data.size).toBe(2);
    s.restart();
    expect((await s.request("/v1/metadata", body, headers)).status).toBe(409);
    expect(s.data.size).toBe(2);
  });
  it("accepts only one of concurrent submissions of the same signed nonce", async () => {
    const s = await setup();
    const { c } = await s.challenge();
    const headers = await s.sign(c);
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => s.request("/v1/metadata", body, headers)),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([
      201, 409, 409, 409, 409, 409,
    ]);
  });
  it("binds signatures to exact content and to the approved origin", async () => {
    const s = await setup();
    const { c } = await s.challenge();
    const headers = await s.sign(c);
    expect((await s.request("/v1/metadata", body + " ", headers)).status).toBe(
      401,
    );
    expect((await s.request("/v1/metadata", body, headers, OTHER)).status).toBe(
      401,
    );
    expect(
      (await s.request("/v1/metadata", body, headers, "https://evil.test"))
        .status,
    ).toBe(403);
    expect(s.data.size).toBe(0);
    expect((await s.request("/v1/metadata", body, headers)).status).toBe(201);
  });
  it("rejects missing and altered signatures, unknown wallets and absent nonce state", async () => {
    const s = await setup();
    const { c } = await s.challenge();
    const headers = await s.sign(c);
    expect((await s.request("/v1/metadata", body)).status).toBe(401);
    expect(
      (
        await s.request("/v1/metadata", body, {
          ...headers,
          "x-retry-signature": "00".repeat(64),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await s.request("/v1/metadata", body, {
          ...headers,
          "x-retry-nonce": "00".repeat(32),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await s.request(
          "/v1/auth/challenge",
          JSON.stringify({
            wallet: "11111111111111111111111111111111",
            bodySha256: await uploadBodyHash(body),
          }),
        )
      ).status,
    ).toBe(401);
    expect(s.data.size).toBe(0);
  });
  it("expires challenges and fails closed if the nonce binding or authorization config is missing", async () => {
    const s = await setup();
    const { c } = await s.challenge();
    const headers = await s.sign(c);
    vi.useFakeTimers();
    vi.setSystemTime(c.expiresAt + 1);
    expect((await s.request("/v1/metadata", body, headers)).status).toBe(401);
    vi.useRealTimers();
    s.env.UPLOAD_NONCES = undefined;
    expect((await s.request("/v1/metadata", body, headers)).status).toBe(503);
    s.env.UPLOAD_AUTH_MODE = "unexpected";
    expect((await s.request("/v1/metadata", body, headers)).status).toBe(503);
  });
  it("does not allow an Access assertion to bypass a wallet-only deployment", async () => {
    const s = await setup();
    s.env.ACCESS_TEAM_DOMAIN = "https://test.cloudflareaccess.com";
    s.env.ACCESS_AUDIENCE = "fixture";
    expect(
      (
        await s.request("/v1/metadata", body, {
          "cf-access-jwt-assertion": "untrusted",
        })
      ).status,
    ).toBe(401);
  });
  it("enforces a durable daily upload budget, including across restarts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    const s = await setup();
    for (let i = 0; i < 10; i++) {
      // Expire previous nonce tombstones without changing the UTC day.
      const { c } = await s.challenge(body + " ".repeat(i));
      if (i === 8) {
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 121_000);
        const next = await s.challenge(body + " ".repeat(i));
        expect(
          (
            await s.request(
              "/v1/metadata",
              body + " ".repeat(i),
              await s.sign(next.c),
            )
          ).status,
        ).toBe(201);
      } else
        expect(
          (
            await s.request(
              "/v1/metadata",
              body + " ".repeat(i),
              await s.sign(c),
            )
          ).status,
        ).toBe(201);
    }
    s.restart();
    expect((await s.challenge()).response.status).toBe(429);
  });
  it("bounds pending state and refuses content errors before consuming an authorization", async () => {
    const s = await setup();
    const { c } = await s.challenge();
    const headers = await s.sign(c);
    expect(
      (
        await s.request(
          "/v1/metadata",
          JSON.stringify({ ...draft, image: "invalid" }),
          headers,
        )
      ).status,
    ).toBe(422);
    expect((await s.request("/v1/metadata", body, headers)).status).toBe(201);
    for (let i = 0; i < 7; i++)
      expect(
        (await s.challenge(body + " ".repeat(i + 1))).response.status,
      ).toBe(200);
    expect((await s.challenge(body + " ".repeat(9))).response.status).toBe(429);
  });
  it("has bounded challenge bodies and exact CORS preflights", async () => {
    const s = await setup();
    expect(
      (await s.request("/v1/auth/challenge", "x".repeat(1025))).status,
    ).toBe(413);
    const preflight = await s.worker.fetch(
      new Request(`${HOST}/v1/auth/challenge`, {
        method: "OPTIONS",
        headers: { origin: ORIGIN },
      }),
      s.env,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(preflight.headers.get("access-control-allow-headers")).toContain(
      "x-retry-signature",
    );
  });
  it("client signs and uploads the exact body, then verifies the public content hashes", async () => {
    const s = await setup();
    vi.stubGlobal("window", { location: new URL(`${ORIGIN}/create/`) });
    const account: WalletAccount = {
      address: s.walletAddress,
      publicKey: s.pub,
      chains: ["solana:devnet"],
      features: ["solana:signMessage"],
    };
    const signMessage = vi.fn(async ({ message }: { message: Uint8Array }) => [
      {
        signedMessage: message,
        signature: new Uint8Array(
          await crypto.subtle.sign(
            "Ed25519",
            s.keys.privateKey,
            message as BufferSource,
          ),
        ),
      },
    ]);
    const wallet = {
      features: { "solana:signMessage": { signMessage } },
    } as unknown as Wallet;
    const fetcher: typeof fetch = async (input, init) => {
      const r = new Request(input, init);
      const h = new Headers(r.headers);
      h.set("origin", ORIGIN);
      return s.worker.fetch(new Request(r, { headers: h }), s.env);
    };
    const receipt = await uploadMetadata(draft, HOST, fetcher, {
      authorize: (b, signal) =>
        authorizeMetadataUpload(wallet, account, b, HOST, fetcher, signal),
    });
    expect(receipt.uri).toMatch(/\/v1\/m\/[a-f0-9]{64}\.json$/);
    expect(signMessage).toHaveBeenCalledTimes(1);
  });
});

describe("Vercel Devnet build gate", () => {
  const valid = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: BETA_BRANCH,
  };
  it("sets the existing Cloudflare endpoint and refuses Mainnet, production and old branches", () => {
    expect(vercelBetaEnvironment(valid).NEXT_PUBLIC_RETRY_METADATA_URL).toBe(
      METADATA_URL,
    );
    for (const override of [
      { NEXT_PUBLIC_SOLANA_CLUSTER: "mainnet-beta" },
      { VERCEL_ENV: "production" },
      { VERCEL_GIT_COMMIT_REF: "main" },
      { NEXT_PUBLIC_BASE_PATH: "/launchpadlendaria" },
      { NEXT_PUBLIC_RETRY_METADATA_URL: "https://evil.test" },
    ])
      expect(() => vercelBetaEnvironment({ ...valid, ...override })).toThrow();
  });
});
