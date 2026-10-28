import { describe, expect, it } from "vitest";
import {
  DRAFT_KEY,
  LEGACY_DRAFT_KEY,
  migrateLegacyDraft,
} from "@/lib/draft-storage";
import { rawSupply, U64_MAX } from "@/lib/solana/token-model";
describe("metadata migration and SPL boundaries", () => {
  it("copies only compatible metadata and preserves unrelated records", () => {
    const original = JSON.stringify({
      name: "My draft",
      symbol: "DRAFT",
      description: "User metadata",
      chainId: 8453,
      contractAddress: "obsolete",
      image: "javascript:unsafe",
    });
    const records = new Map([
      [LEGACY_DRAFT_KEY, original],
      ["other-app", "keep"],
    ]);
    const storage = {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => {
        records.set(key, value);
      },
    };
    migrateLegacyDraft(storage);
    const draft = JSON.parse(records.get(DRAFT_KEY)!);
    expect(draft.name).toBe("My draft");
    expect(draft.image).toBe("");
    expect(draft.chainId).toBeUndefined();
    expect(draft.contractAddress).toBeUndefined();
    expect(records.get(LEGACY_DRAFT_KEY)).toBe(original);
    expect(records.get("other-app")).toBe("keep");
    storage.setItem(DRAFT_KEY, "existing");
    migrateLegacyDraft(storage);
    expect(records.get(DRAFT_KEY)).toBe("existing");
  });
  it("handles invalid or unavailable storage without deleting data", () => {
    expect(() =>
      migrateLegacyDraft({
        getItem: () => {
          throw new Error("disabled");
        },
        setItem: () => {
          throw new Error("disabled");
        },
      }),
    ).not.toThrow();
  });
  it("demonstrates why the previous 18-decimal supply cannot be ported", () => {
    expect(rawSupply(1_000_000_000n, 9)).toBe(1_000_000_000_000_000_000n);
    expect(() => rawSupply(1_000_000_000n, 18)).toThrow(/uint64/);
    expect(rawSupply(U64_MAX, 0)).toBe(U64_MAX);
  });
});
