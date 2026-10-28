import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { isAddress } from "viem";
import { TRACKED_ASSETS } from "@/config/featured-assets";

// Guards Stage 4's rule: fictional market data lives only in tests/fixtures
// and never reaches a production code path, not even as a fallback.
const root = join(import.meta.dirname, "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? files(path)
      : /\.(ts|tsx)$/.test(name)
        ? [path]
        : [];
  });
}
const production = files(join(root, "src")).map((path) => ({
  path: relative(root, path),
  text: readFileSync(path, "utf8"),
}));

describe("no demo market data in production", () => {
  it("never imports test fixtures or the old demo modules", () => {
    const offenders = production.filter(({ text }) =>
      /from\s+["'](?:\.\.\/)*(?:tests|fixtures)\/|from\s+["'][^"']*(?:fixtures|demo-market|@\/data\/tokens|token-provider)["']/.test(
        text,
      ),
    );
    expect(offenders.map((o) => o.path)).toEqual([]);
  });

  it("has no random or generated prices in market code", () => {
    const market = production.filter(({ path }) =>
      /src\/(lib\/market|components\/market|hooks\/use-market|components\/discover|components\/tokens|components\/trade|components\/portfolio)/.test(
        path,
      ),
    );
    expect(market.length).toBeGreaterThan(5);
    for (const { path, text } of market) {
      expect(text, path).not.toMatch(
        /Math\.random|generateHistory|Math\.sin\(/,
      );
      expect(text, path).not.toMatch(
        /demo-wallet|DEMO-|isDemo|Orbit Cat|250000/,
      );
    }
  });

  it("keeps the demo catalogue's names out of every production file", () => {
    // Create's form may suggest an example name; it is not market data.
    for (const { path, text } of production.filter(
      (file) => !file.path.startsWith("src/components/create/"),
    ))
      expect(text, path).not.toMatch(
        /Orbit Cat|Based & Confused|Toast Protocol|Second Chance/,
      );
  });
});

describe("tracked asset config", () => {
  it("lists each token once, by chain and checksummed address", () => {
    const keys = TRACKED_ASSETS.map(
      (a) => `${a.chainId}:${a.address.toLowerCase()}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const asset of TRACKED_ASSETS) {
      expect(isAddress(asset.address, { strict: true })).toBe(true);
      expect(asset.slug).toBe(asset.address.toLowerCase());
      // External tokens are never presented as RETRY launches.
      expect(asset.relation).toBe("external-tracked");
      expect(asset.chainId).toBe(8453);
      expect(asset.primaryPool?.id).toMatch(/^0x([0-9a-f]{40}|[0-9a-f]{64})$/);
      expect(asset.verification.evidence).toMatch(
        /^https:\/\/github\.com\/ArthurBudagMatsuda\/launchpadlendaria\/actions\/runs\/\d+$/,
      );
    }
  });

  it("hardcodes the featured address in the config only", () => {
    for (const asset of TRACKED_ASSETS) {
      const holders = production.filter(({ text }) =>
        text.toLowerCase().includes(asset.address.toLowerCase().slice(2)),
      );
      expect(holders.map((h) => h.path)).toEqual([
        "src/config/featured-assets.ts",
      ]);
    }
  });
});
