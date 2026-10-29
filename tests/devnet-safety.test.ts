import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { getBase58Decoder } from "@solana/kit";
import {
  DEVNET_GENESIS,
  devnetBudget,
  parseDevnetFunder,
  reserveDevnetFunding,
} from "./chain/devnet-safety";

describe("public Devnet safety", () => {
  it("accepts the existing JSON and base58 formats without touching a personal wallet", () => {
    const key = Keypair.generate();
    for (const value of [
      JSON.stringify([...key.secretKey]),
      getBase58Decoder().decode(key.secretKey),
    ])
      expect(
        parseDevnetFunder("devnet", DEVNET_GENESIS, value)?.publicKey.equals(
          key.publicKey,
        ),
      ).toBe(true);
  });
  it("does not parse or use a funder locally and refuses unknown modes", () => {
    expect(parseDevnetFunder("local", "local", "not a key")).toBeNull();
    expect(() =>
      parseDevnetFunder("mainnet", DEVNET_GENESIS, "not a key"),
    ).toThrow(/Only local and devnet/);
  });
  it("checks cluster identity before parsing any key", () => {
    expect(() =>
      parseDevnetFunder(
        "devnet",
        "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
        "malformed",
      ),
    ).toThrow(/only ever used on Devnet/);
  });
  it("fails closed when the funder is missing", () => {
    expect(() => parseDevnetFunder("devnet", DEVNET_GENESIS, null)).toThrow(
      /required/,
    );
  });
  it("rejects coercible JSON bytes and suppresses secret parser details", () => {
    const key = Keypair.generate();
    for (const byte of [-1, 256, 1.5, "1", null]) {
      const values: unknown[] = [...key.secretKey];
      values[0] = byte;
      expect(() =>
        parseDevnetFunder("devnet", DEVNET_GENESIS, JSON.stringify(values)),
      ).toThrow(/^Invalid RETRY_DEVNET_FUNDER:/);
    }
    const marker = "PRIVATE_INPUT_MUST_NOT_APPEAR";
    try {
      parseDevnetFunder("devnet", DEVNET_GENESIS, `[${marker}`);
    } catch (error) {
      expect(String(error)).not.toContain(marker);
    }
  });
  it("requires a valid full keypair, not a seed or arbitrary bytes", () => {
    for (const value of [
      JSON.stringify(Array(32).fill(0)),
      JSON.stringify(Array(64).fill(0)),
      "not-base58-0",
    ])
      expect(() => parseDevnetFunder("devnet", DEVNET_GENESIS, value)).toThrow(
        /Invalid RETRY_DEVNET_FUNDER/,
      );
  });
  it("bounds the budget and rejects values that can bypass numeric checks", () => {
    expect(devnetBudget()).toBe(2_000_000_000);
    for (const value of [
      "NaN",
      "Infinity",
      "0",
      "13",
      "1e2",
      "-2",
      "2.0000000001",
    ])
      expect(() => devnetBudget(value)).toThrow();
  });
  it("enforces cumulative gross transfers, even when a later refund is expected", () => {
    const used = reserveDevnetFunding(0, 400_000_000, devnetBudget());
    expect(reserveDevnetFunding(used, 1_000_000_000, devnetBudget())).toBe(
      1_400_000_000,
    );
    expect(() =>
      reserveDevnetFunding(1_400_000_000, 10_000_000_000, devnetBudget()),
    ).toThrow(/budget exceeded/);
  });
});
