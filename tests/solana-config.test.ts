import { describe, expect, it } from "vitest";
import { CLUSTERS, explorerUrl, parseSolanaConfig } from "@/config/solana";
import {
  disabledFeatures,
  executionPolicy,
  FEATURE_DEFAULTS,
  MAINNET_EXECUTION_ENABLED,
  RETRY_DBC_CONFIGS,
  RETRY_FEATURES,
} from "@/config/retry-protocol";
import {
  formatSol,
  matchingPublicKey,
  parseAddress,
} from "@/lib/solana/address";
import { TRACKED_ASSETS, FEATURED_ASSET } from "@/config/tracked-mints";
describe("Solana environments and units", () => {
  it("defaults to Devnet and explicitly supports Mainnet", () => {
    expect(parseSolanaConfig({}).cluster).toBe("devnet");
    expect(parseSolanaConfig({ cluster: "mainnet-beta" }).rpcUrl).toBe(
      CLUSTERS["mainnet-beta"].rpc + "/",
    );
  });
  it.each(["base", "8453", "84532", "testnet", "invalid"])(
    "rejects unsupported cluster %s",
    (cluster) => expect(() => parseSolanaConfig({ cluster })).toThrow(),
  );
  it.each([
    "http://public.example",
    "ftp://example.com",
    "https://user:password@example.com",
  ])("rejects unsafe endpoint %s", (rpc) =>
    expect(() => parseSolanaConfig({ rpc })).toThrow(),
  );
  it("allows a local read-only validator endpoint", () =>
    expect(parseSolanaConfig({ rpc: "http://127.0.0.1:8899" }).rpcUrl).toBe(
      "http://127.0.0.1:8899/",
    ));
  it("cannot enable financial functionality by changing environment flags", () => {
    expect(() => parseSolanaConfig({ trading: "true" })).toThrow();
    expect(() => parseSolanaConfig({ launch: "true" })).toThrow();
  });
  it("keeps Mainnet execution locked in code, with no Mainnet config", () => {
    expect(MAINNET_EXECUTION_ENABLED).toBe(false);
    expect(RETRY_DBC_CONFIGS["mainnet-beta"]).toBeNull();
    expect(executionPolicy("mainnet-beta")).toMatchObject({
      enabled: false,
      reason: "mainnet-locked",
    });
    // Even a Mainnet config would stay locked while the flag is false.
    const config = {
      address: "11111111111111111111111111111111",
      feeClaimer: "11111111111111111111111111111111",
      createdBy: "x",
      createdAt: "2026-10-28",
      feeClaimerKind: "treasury" as const,
    };
    expect(
      executionPolicy("mainnet-beta", undefined, {
        configs: { devnet: null, "mainnet-beta": config },
      }),
    ).toMatchObject({ enabled: false, reason: "mainnet-locked" });
    expect(
      executionPolicy("devnet", undefined, {
        configs: { devnet: config, "mainnet-beta": null },
      }),
    ).toMatchObject({ enabled: true });
    expect(
      executionPolicy("devnet", undefined, {
        configs: { devnet: null, "mainnet-beta": null },
      }),
    ).toMatchObject({ enabled: false, reason: "config-missing" });
  });
  it("switches each signing capability separately, Mainnet off for all", () => {
    const config = {
      address: "11111111111111111111111111111111",
      feeClaimer: "11111111111111111111111111111111",
      createdBy: "x",
      createdAt: "2026-10-29",
      feeClaimerKind: "ephemeral-test-key" as const,
    };
    const configs = { devnet: config, "mainnet-beta": config };
    for (const feature of RETRY_FEATURES) {
      expect(FEATURE_DEFAULTS["mainnet-beta"][feature]).toBe(false);
      expect(FEATURE_DEFAULTS.devnet[feature]).toBe(true);
      expect(
        executionPolicy("devnet", feature, { configs, disabled: new Set() }),
      ).toMatchObject({ enabled: true });
      // Defaults switched on for Mainnet still do nothing while it is locked.
      expect(
        executionPolicy("mainnet-beta", feature, {
          configs,
          defaults: {
            ...FEATURE_DEFAULTS,
            "mainnet-beta": FEATURE_DEFAULTS.devnet,
          },
        }),
      ).toMatchObject({ enabled: false, reason: "mainnet-locked" });
    }
    expect(
      executionPolicy("devnet", "trade-damm", {
        configs,
        disabled: disabledFeatures("trade-damm, create"),
      }),
    ).toMatchObject({ enabled: false, reason: "feature-off" });
    expect(
      executionPolicy("devnet", "trade-curve", {
        configs,
        disabled: disabledFeatures("trade-damm, create"),
      }),
    ).toMatchObject({ enabled: true });
    expect([...disabledFeatures("all")]).toEqual([...RETRY_FEATURES]);
    // Unset, empty or unknown names leave the reviewed defaults alone.
    for (const value of [undefined, "", "trading,launch", "TRADE-DAMM"])
      expect(disabledFeatures(value).size).toBe(0);
  });
  it("validates decoded 32-byte base58 addresses without Ethereum normalization", () => {
    expect(parseAddress("11111111111111111111111111111111")).toBeTruthy();
    expect(
      matchingPublicKey("11111111111111111111111111111111", new Uint8Array(32)),
    ).toBe(true);
    for (const value of [
      "0x1234",
      "00000000000000000000000000000000",
      "",
      null,
      "1".repeat(80),
    ])
      expect(parseAddress(value)).toBeNull();
  });
  it("keeps lamports exact for zero, dust, normal and uint64-size balances", () => {
    expect(formatSol(0n)).toBe("0");
    expect(formatSol(1n)).toBe("0.000000001");
    expect(formatSol(1_500_000_001n)).toBe("1.500000001");
    expect(formatSol(18446744073709551615n)).toBe("18446744073.709551615");
    expect(() => formatSol(-1n)).toThrow();
  });
  it("builds cluster-aware explorer URLs on one fixed origin", () => {
    expect(
      explorerUrl("devnet", "address", "11111111111111111111111111111111"),
    ).toContain("?cluster=devnet");
    expect(explorerUrl("mainnet-beta", "tx", "a/b")).toBe(
      "https://explorer.solana.com/tx/a%2Fb",
    );
  });
  it("does not configure an arbitrary replacement token", () => {
    expect(TRACKED_ASSETS).toEqual([]);
    expect(FEATURED_ASSET).toBeUndefined();
  });
});
