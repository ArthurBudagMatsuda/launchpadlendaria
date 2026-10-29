import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  FEATURE_DEFAULTS,
  MAINNET_APPROVAL,
  MAINNET_EXECUTION_ENABLED,
  RETRY_DBC_CONFIGS,
} from "@/config/retry-protocol";
import {
  approvalMatches,
  mainnetApprovalParameters,
  mainnetApprovalSheet,
  type MainnetApprovalParameters,
} from "@/lib/meteora/mainnet-approval";

const hash = (parameters: MainnetApprovalParameters) =>
  createHash("sha256").update(JSON.stringify(parameters)).digest("hex");
const parameters = mainnetApprovalParameters();
const sha256 = hash(parameters);

describe("Mainnet approval sheet", () => {
  it("is what the code would launch with (docs/meteora-mvp/MAINNET_APPROVAL.md)", async () => {
    // After a reviewed parameter change: pnpm vitest run tests/mainnet-approval.test.ts -u
    await expect(
      mainnetApprovalSheet(parameters, sha256, MAINNET_APPROVAL),
    ).toMatchFileSnapshot("../docs/meteora-mvp/MAINNET_APPROVAL.md");
  });

  it("adds up: the supply splits exactly and every fee is the reviewed 1%", () => {
    const { supply, token, graduation, curve, initialBuy } = parameters;
    expect(
      BigInt(supply.soldOnCurve) +
        BigInt(supply.depositedAtGraduation) +
        BigInt(supply.leftover),
    ).toBe(BigInt(token.totalSupply));
    expect(supply.leftover).toBe("0");
    expect(
      BigInt(graduation.solToDammV2) +
        BigInt(graduation.meteoraMigrationFeeLamports),
    ).toBe(BigInt(graduation.migrationQuoteThreshold));
    // The curve ends where the DAMM v2 pool opens.
    expect(curve.migrationSqrtPrice).toBe(curve.points.at(-1)!.sqrtPrice);
    for (const quote of initialBuy.quotes)
      expect(BigInt(quote.feeLamports)).toBe(BigInt(quote.lamports) / 100n);
  });

  it("keeps Mainnet locked unless the owner approved exactly these parameters", () => {
    const enabled =
      MAINNET_EXECUTION_ENABLED ||
      Object.values(FEATURE_DEFAULTS["mainnet-beta"]).some(Boolean);
    if (!enabled) return expect(MAINNET_EXECUTION_ENABLED).toBe(false);
    expect(approvalMatches(MAINNET_APPROVAL, sha256)).toBe(true);
    expect(RETRY_DBC_CONFIGS["mainnet-beta"]?.feeClaimerKind).toBe("treasury");
  });

  it("stops matching as soon as one parameter changes after an approval", () => {
    const approval = {
      parametersSha256: sha256,
      approvedBy: "Owner",
      approvedAt: "2026-11-01",
      reference: "review link",
    };
    expect(approvalMatches(approval, sha256)).toBe(true);
    expect(mainnetApprovalSheet(parameters, sha256, approval)).toContain(
      "**Aprovado** por Owner em 2026-11-01",
    );
    const changed = structuredClone(parameters);
    changed.tradingFee.creatorTradingFeePercentage = 60;
    expect(approvalMatches(approval, hash(changed))).toBe(false);
    expect(mainnetApprovalSheet(changed, hash(changed), approval)).toContain(
      "Aprovação desatualizada",
    );
    expect(approvalMatches(null, sha256)).toBe(false);
  });
});
