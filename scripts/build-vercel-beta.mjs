import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { checkBetaSecurity } from "./check-beta-security.mjs";
import { vercelBetaEnvironment } from "../infra/devnet-beta/vercel-config.ts";
checkBetaSecurity();
const env = vercelBetaEnvironment(process.env);
const require = createRequire(import.meta.url);
const git = (...args) =>
  spawnSync("git", args, { encoding: "utf8", windowsHide: true });
const head = git("rev-parse", "HEAD");
const sourceCommit =
  env.VERCEL_GIT_COMMIT_SHA || (head.status === 0 ? head.stdout.trim() : "");
if (!/^[a-f0-9]{40}$/.test(sourceCommit))
  throw new Error("A verifiable source commit is required.");
if (head.status === 0 && head.stdout.trim() !== sourceCommit)
  throw new Error("Vercel source SHA differs from the checkout.");
const build = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build"],
  { stdio: "inherit", windowsHide: true, env },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const status = git("status", "--porcelain");
await writeFile(
  "out/beta-version.json",
  JSON.stringify(
    {
      name: "RETRY",
      version: require("../package.json").version,
      sourceCommit,
      branch:
        env.VERCEL_GIT_COMMIT_REF ||
        git("branch", "--show-current").stdout.trim(),
      dirty: status.status === 0 ? !!status.stdout.trim() : null,
      hosting: "vercel",
      environment: env.VERCEL_ENV || "local-validation",
      cluster: "devnet",
      mainnetExecution: false,
      metadata: env.NEXT_PUBLIC_RETRY_METADATA_URL,
      capabilities:
        env.NEXT_PUBLIC_RETRY_DISABLED_FEATURES === "all"
          ? "read-only"
          : "devnet-test-transactions",
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  "Vercel Devnet static export prepared. No deployment was performed.",
);
