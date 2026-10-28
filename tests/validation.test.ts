import { describe, expect, it } from "vitest";
import {
  emptyDraft,
  imageSignature,
  isSafeImage,
  restoreDraft,
  validateDraft,
  type TokenDraft,
} from "@/lib/validation";
const draft: TokenDraft = {
  ...emptyDraft,
  name: "Orbit Cat",
  symbol: "ORBIT",
  description: "One small paw for catkind.",
  image: "data:image/png;base64,iVBORw0KGgo=",
};
describe("token drafts", () => {
  it("accepts bounded metadata and optional https links", () => {
    expect(validateDraft(draft)).toEqual({});
    expect(
      validateDraft({
        ...draft,
        twitter: "https://x.com/orbit",
        telegram: "https://t.me/orbit",
      }),
    ).toEqual({});
  });
  it("requires all identity fields and an image", () => {
    expect(Object.keys(validateDraft(emptyDraft)).sort()).toEqual([
      "description",
      "image",
      "name",
      "symbol",
    ]);
  });
  it("rejects script URLs, invalid social domains and insecure links", () => {
    const errors = validateDraft({
      ...draft,
      website: "javascript:alert(1)",
      twitter: "https://x.com.evil.test/token",
      telegram: "http://t.me/token",
    });
    expect(Object.keys(errors).sort()).toEqual([
      "telegram",
      "twitter",
      "website",
    ]);
  });
  it("enforces metadata limits and ticker syntax", () => {
    const errors = validateDraft({
      ...draft,
      name: "a".repeat(33),
      symbol: "bad-$",
      description: "x".repeat(301),
    });
    expect(errors).toHaveProperty("name");
    expect(errors).toHaveProperty("symbol");
    expect(errors).toHaveProperty("description");
  });
  it("rejects SVG, remote uploads and oversized data URLs", () => {
    expect(isSafeImage("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isSafeImage("https://example.com/image.png")).toBe(false);
    expect(isSafeImage("data:image/png;base64," + "A".repeat(3_000_000))).toBe(
      false,
    );
  });
  it("checks image magic bytes", () => {
    expect(imageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(
      "image/png",
    );
    expect(imageSignature(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(
      "image/jpeg",
    );
    expect(imageSignature(new Uint8Array([60, 115, 118, 103]))).toBeUndefined();
  });
  it("restores only known safe properties from untrusted browser storage", () => {
    expect(restoreDraft(null)).toEqual(emptyDraft);
    const restored = restoreDraft({
      name: "a".repeat(100),
      image: "javascript:alert(1)",
      symbol: 4,
      malicious: "value",
    });
    expect(restored.name).toHaveLength(32);
    expect(restored.image).toBe("");
    expect(restored.symbol).toBe("");
    expect(restored).not.toHaveProperty("malicious");
  });
});
