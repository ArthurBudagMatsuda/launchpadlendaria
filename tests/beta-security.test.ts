import { expect, it } from "vitest";
// @ts-expect-error Plain Node release gate, exercised as installed rather than mocked.
import { checkBetaSecurity } from "../scripts/check-beta-security.mjs";

it("never loads the vulnerable native converter, even when a binding is available, and preserves 64/128/256-bit encodings", () => {
  expect(checkBetaSecurity()).toEqual({
    nativeConverter: "disabled-by-patch",
    conversionChecks: 36,
    auditSuppressed: false,
  });
});
