import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

/** Fail before a beta build if a fresh install lost the native-converter patch. */
export function checkBetaSecurity() {
  const require = createRequire(import.meta.url);
  const spl = createRequire(require.resolve("@solana/spl-token"));
  const layout = createRequire(spl.resolve("@solana/buffer-layout-utils"));
  const entry = layout.resolve("bigint-buffer");
  const source = readFileSync(entry, "utf8");
  let nativeLoads = 0;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    Buffer,
    console: { warn() {} },
    require() {
      nativeLoads++;
      // Supply a converter to detect regressions even on machines without a .node file.
      return () => ({
        toBigInt() {
          throw new Error("Native converter reached");
        },
      });
    },
  });
  if (nativeLoads || !source.includes("CVE-2025-3194"))
    throw new Error(
      "The required bigint-buffer native-disable patch is missing.",
    );
  const installed = layout("bigint-buffer");
  for (const api of [exports, installed]) {
    for (const width of [0, 8, 16, 32, 256]) {
      const bytes = Buffer.alloc(width, 0xff);
      const expected = width ? (1n << BigInt(width * 8)) - 1n : 0n;
      if (
        api.toBigIntLE(bytes) !== expected ||
        api.toBigIntBE(bytes) !== expected
      )
        throw new Error("BigInt decoding regression.");
      if (
        width &&
        (!api.toBufferLE(expected, width).equals(bytes) ||
          !api.toBufferBE(expected, width).equals(bytes))
      )
        throw new Error("BigInt encoding regression.");
    }
  }
  const policy = readFileSync(
    new URL("../pnpm-workspace.yaml", import.meta.url),
    "utf8",
  );
  if (
    !/bigint-buffer: false/.test(policy) ||
    !/bigint-buffer@1\.1\.5: patches\//.test(policy)
  )
    throw new Error(
      "Frozen native-build policy or dependency patch is missing.",
    );
  return {
    nativeConverter: "disabled-by-patch",
    conversionChecks: 36,
    auditSuppressed: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(checkBetaSecurity()));
