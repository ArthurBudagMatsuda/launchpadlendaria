import { describe, expect, it } from "vitest";
import { parseSolanaConfig } from "@/config/solana";
import { readSolBalance } from "@/lib/solana/rpc";
import { parseAddress, formatSol } from "@/lib/solana/address";
describe("REAL PUBLIC RPC — no wallet, signer, airdrop or transaction", () => {
  it.each(["devnet", "mainnet-beta"])(
    "verifies %s genesis and reads a public system account",
    async (cluster) => {
      const result = await readSolBalance(
        parseSolanaConfig({ cluster }),
        parseAddress("11111111111111111111111111111111")!,
      );
      expect(result.cluster).toBe(cluster);
      expect(result.lamports).toBeGreaterThanOrEqual(0n);
      expect(result.slot).toBeGreaterThan(0n);
      console.info(
        JSON.stringify({
          kind: "public-system-account-probe",
          cluster,
          slot: result.slot.toString(),
          lamports: result.lamports.toString(),
          sol: formatSol(result.lamports),
          checkedAt: new Date().toISOString(),
        }),
      );
    },
  );
});
