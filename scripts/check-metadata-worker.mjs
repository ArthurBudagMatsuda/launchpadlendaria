// Local packaging only. Fake binding IDs below are never sent to Cloudflare.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("..", import.meta.url));
const folder = path.join(root, ".qa", "metadata-worker-validation");
mkdirSync(folder, { recursive: true });
const config = path.join(folder, "wrangler.json");
writeFileSync(
  config,
  JSON.stringify(
    {
      name: "retry-metadata-local-validation",
      main: path.join(root, "infra/metadata-worker/src/index.ts"),
      compatibility_date: "2026-10-23",
      vars: {
        PUBLIC_URL: "https://metadata.retry.test",
        ALLOWED_ORIGINS: "http://127.0.0.1:3000",
        ACCESS_TEAM_DOMAIN: "https://retry-fixture.cloudflareaccess.com",
        ACCESS_AUDIENCE: "test-only",
      },
      kv_namespaces: [
        { binding: "METADATA", id: "00000000000000000000000000000000" },
      ],
      ratelimits: [
        {
          name: "UPLOAD_RATE_LIMITER",
          namespace_id: "1",
          simple: { limit: 10, period: 60 },
        },
      ],
    },
    null,
    2,
  ),
);
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/wrangler/bin/wrangler.js"),
    "deploy",
    "--dry-run",
    "--config",
    config,
    "--outdir",
    path.join(folder, "bundle"),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
