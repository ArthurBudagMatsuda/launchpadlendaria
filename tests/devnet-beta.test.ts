import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSolanaConfig } from "@/config/solana";
import {
  featureBlock,
  MAINNET_EXECUTION_ENABLED,
  RETRY_DBC_CONFIGS,
} from "@/config/retry-protocol";
import {
  metadataEndpoint,
  metadataOrigin,
} from "@/lib/meteora/metadata-endpoint";
import gateway from "../infra/devnet-beta/pages-worker.js";
import { validateBetaSettings } from "../infra/devnet-beta/config";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("isolated Devnet beta", () => {
  it("rejects incomplete settings, wrong origins and accidental credentials before generating deployment files", () => {
    const fixture = {
      accountId: "1".repeat(32),
      kvNamespaceId: "2".repeat(32),
      rateNamespaceId: "1234",
      pagesProject: "retry-fixture-beta",
      workerName: "retry-metadata-fixture-beta",
      publicOrigin: "https://retry-fixture-beta.pages.dev",
      accessTeamDomain: "https://retry-fixture.cloudflareaccess.com",
      accessAudience: "3".repeat(64),
    };
    expect(validateBetaSettings(fixture)).toEqual(fixture);
    for (const change of [
      { kvNamespaceId: "REPLACE_ME" },
      { publicOrigin: "https://arthurbudagmatsuda.github.io" },
      { apiToken: "must-not-be-here" },
      { accessAudience: "" },
      { rateNamespaceId: "0" },
      { workerName: "retry-metadata" },
    ])
      expect(() => validateBetaSettings({ ...fixture, ...change })).toThrow();
  });
  it("refuses Mainnet config and even an overridden execution input in beta builds", () => {
    vi.stubEnv("NEXT_PUBLIC_RETRY_DEVNET_BETA", "1");
    expect(parseSolanaConfig({}).cluster).toBe("devnet");
    expect(() => parseSolanaConfig({ cluster: "mainnet-beta" })).toThrow(
      /Devnet/,
    );
    expect(
      featureBlock("mainnet-beta", "create", { mainnetEnabled: true }),
    ).toBe("mainnet-locked");
    expect(MAINNET_EXECUTION_ENABLED).toBe(false);
    expect(RETRY_DBC_CONFIGS["mainnet-beta"]).toBeNull();
  });
  it("resolves same-origin metadata only over HTTPS and refuses credential-bearing or relative endpoints", () => {
    expect(metadataEndpoint("/")).toBe("/");
    vi.stubGlobal("window", {
      location: new URL("https://retry-fixture.test/create/"),
    });
    expect(metadataOrigin("/")).toBe("https://retry-fixture.test");
    vi.stubGlobal("window", { location: new URL("http://127.0.0.1:3000") });
    expect(metadataOrigin("/")).toBeNull();
    for (const value of [
      "https://user:password@example.com",
      "//other.example",
      "/other",
      "https://example.com/?token=x",
      "https://example.com/#x",
    ])
      expect(metadataEndpoint(value)).toBeNull();
  });
  it("forwards metadata requests, including the signed Access assertion, to the existing Worker", async () => {
    const assets = vi.fn(async () => new Response("site"));
    const metadata = vi.fn(
      async (request: Request) =>
        new Response(request.headers.get("cf-access-jwt-assertion")),
    );
    const response = await gateway.fetch(
      new Request("https://beta.test/v1/metadata", {
        headers: { "cf-access-jwt-assertion": "test-assertion" },
      }),
      { ASSETS: { fetch: assets }, METADATA_SERVICE: { fetch: metadata } },
    );
    expect(await response.text()).toBe("test-assertion");
    expect(metadata).toHaveBeenCalledOnce();
    expect(assets).not.toHaveBeenCalled();
    expect(
      await (
        await gateway.fetch(new Request("https://beta.test/create/"), {
          ASSETS: { fetch: assets },
        })
      ).text(),
    ).toBe("site");
  });
  it("fails closed when the metadata binding is missing", async () => {
    const response = await gateway.fetch(
      new Request("https://beta.test/v1/metadata", { method: "POST" }),
      { ASSETS: { fetch: async () => new Response("site") } },
    );
    expect(response.status).toBe(503);
  });
});
