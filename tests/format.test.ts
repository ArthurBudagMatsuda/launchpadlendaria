import { describe, expect, it } from "vitest";
import { usd } from "@/lib/format";

describe("usd", () => {
  // The server (build-time Node) and the browser must print the same text.
  it("drops trailing zeros in compact notation on every runtime", () => {
    expect(usd(12_400)).toBe("$12.4K");
    expect(usd(1_000_000)).toBe("$1M");
    expect(usd(1_250_000)).toBe("$1.25M");
    expect(usd(0.5)).toBe("$0.5");
  });

  it("keeps cents in standard notation", () => {
    expect(usd(1_234.5, false)).toBe("$1,234.50");
    expect(usd(0.00042, false)).toBe("$0.00042");
  });
});
