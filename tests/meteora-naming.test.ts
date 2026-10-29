import { describe, expect, it } from "vitest";
import {
  MAX_LAUNCHES_PER_NAME,
  MAX_LAUNCHES_PER_TICKER,
  namingCheck,
  namingFlags,
} from "@/lib/meteora/naming";

const launch = (
  address: string,
  creator: string,
  activated: number,
  name: string,
  symbol: string,
) => ({
  pool: { address, creator, activationPoint: BigInt(activated) },
  metadata: { name, symbol },
});

describe("RETRY naming rules (platform rules, not on-chain)", () => {
  const launches = [
    launch("p1", "alice", 100, "Retry Cat", "RCAT"),
    launch("p2", "bob", 200, "retry  cat", "KITTY"),
    launch("p3", "carol", 300, "Doge Two", "RCAT"),
    // Made around the launch screen, straight through the DBC program.
    launch("p4", "dave", 400, "Retry Cat", "RCAT"),
    {
      pool: { address: "p5", creator: "erin", activationPoint: 500n },
      metadata: null,
    },
  ];

  it("allows two launches per name and per ticker, and no repeat by the same creator", () => {
    expect(MAX_LAUNCHES_PER_NAME).toBe(2);
    expect(MAX_LAUNCHES_PER_TICKER).toBe(2);
    expect(namingCheck({ name: "Fresh", symbol: "FRSH" }, "zed", [])).toEqual({
      sameName: 0,
      sameTicker: 0,
      block: null,
    });
    // Names match case-insensitively with spacing collapsed.
    expect(
      namingCheck(
        { name: "RETRY CAT", symbol: "NEW" },
        "zed",
        launches.slice(0, 2),
      ),
    ).toEqual({ sameName: 2, sameTicker: 0, block: "name-limit" });
    expect(
      namingCheck(
        { name: "Other", symbol: "rcat" },
        "zed",
        launches.slice(0, 3),
      ),
    ).toEqual({ sameName: 0, sameTicker: 2, block: "ticker-limit" });
    expect(
      namingCheck(
        { name: "Retry Cat", symbol: "RCAT" },
        "alice",
        launches.slice(0, 1),
      ).block,
    ).toBe("creator-repeat");
    // One earlier launch with the ticker is allowed, and reported.
    expect(
      namingCheck(
        { name: "Third", symbol: "RCAT" },
        "zed",
        launches.slice(0, 1),
      ),
    ).toEqual({ sameName: 0, sameTicker: 1, block: null });
  });

  it("marks on-chain launches past the limit, oldest first, and counts shared tickers", () => {
    const flags = namingFlags(launches.toReversed());
    expect(flags.get("p1")).toEqual({ overLimit: false, sameTicker: 3 });
    expect(flags.get("p2")).toEqual({ overLimit: false, sameTicker: 1 });
    expect(flags.get("p3")).toEqual({ overLimit: false, sameTicker: 3 });
    // Third "Retry Cat" and third RCAT: listed, but marked.
    expect(flags.get("p4")).toEqual({ overLimit: true, sameTicker: 3 });
    expect(flags.has("p5")).toBe(false);
    // A creator repeating its own pair is marked even under the limits.
    const repeat = namingFlags([
      launch("a", "alice", 1, "Solo", "SOLO"),
      launch("b", "alice", 2, "Solo", "SOLO"),
    ]);
    expect(repeat.get("b")?.overLimit).toBe(true);
  });
});
