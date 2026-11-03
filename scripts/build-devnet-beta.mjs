import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFile, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
if (
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER &&
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER !== "devnet"
)
  throw new Error("The beta build refuses non-Devnet configuration.");
if (process.env.NEXT_PUBLIC_BASE_PATH)
  throw new Error(
    "The isolated Cloudflare beta must be built at the domain root.",
  );
const build = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build"],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      RETRY_STATIC_EXPORT: "1",
      NEXT_PUBLIC_BASE_PATH: "",
      NEXT_PUBLIC_RETRY_DEVNET_BETA: "1",
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_ENABLE_LIVE_TRADING: "false",
      NEXT_PUBLIC_ENABLE_TOKEN_LAUNCH: "false",
      NEXT_PUBLIC_RETRY_METADATA_URL: "/",
    },
  },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
await copyFile("infra/devnet-beta/pages-worker.js", "out/_worker.js");
await writeFile(
  "out/_routes.json",
  JSON.stringify({ version: 1, include: ["/v1/*"], exclude: [] }, null, 2),
);
await writeFile(
  "out/_headers",
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n",
);
const source = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  windowsHide: true,
});
await writeFile(
  "out/beta-version.json",
  JSON.stringify(
    {
      sourceCommit: source.status === 0 ? source.stdout.trim() : null,
      dirty:
        spawnSync("git", ["status", "--porcelain"], {
          encoding: "utf8",
          windowsHide: true,
        }).stdout?.trim().length > 0,
      cluster: "devnet",
      mainnetExecution: false,
      metadata: "same-origin /v1/metadata",
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log("Devnet-only beta export ready in out/. Nothing was deployed.");
