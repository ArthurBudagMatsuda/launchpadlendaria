import { afterEach, describe, expect, it, vi } from "vitest";
import { assetPath } from "@/lib/asset-path";
afterEach(() => vi.unstubAllEnvs());
describe("static hosting asset paths", () => {
  it("keeps local development at the root", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    expect(assetPath("/tokens/orbit.svg")).toBe("/tokens/orbit.svg");
  });
  it("prefixes public images and favicon for project Pages", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/launchpadlendaria");
    expect(assetPath("/tokens/orbit.svg")).toBe(
      "/launchpadlendaria/tokens/orbit.svg",
    );
    expect(assetPath("/brand/retry-symbol.svg")).toBe(
      "/launchpadlendaria/brand/retry-symbol.svg",
    );
  });
  it("does not rewrite raster previews or remote URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/launchpadlendaria");
    expect(assetPath("data:image/png;base64,AA==")).toBe(
      "data:image/png;base64,AA==",
    );
    expect(assetPath("https://example.com/image.png")).toBe(
      "https://example.com/image.png",
    );
  });
});
