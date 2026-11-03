import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBetaSettings } from "../infra/devnet-beta/config.ts";
const settingsPath = process.argv[2];
if (!settingsPath)
  throw new Error(
    "Usage: node scripts/prepare-devnet-beta.mjs <public-settings.json> [--check]. No deploy is performed.",
  );
const config = validateBetaSettings(
  JSON.parse(await readFile(settingsPath, "utf8")),
);
const root = fileURLToPath(new URL("..", import.meta.url));
const dir = path.join(root, ".qa/devnet-beta-config");
if (!process.argv.includes("--check")) {
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "wrangler.worker.json"),
    JSON.stringify(
      {
        name: config.workerName,
        account_id: config.accountId,
        main: path.join(root, "infra/metadata-worker/src/index.ts"),
        compatibility_date: "2026-10-23",
        vars: {
          PUBLIC_URL: config.publicOrigin,
          ALLOWED_ORIGINS: config.publicOrigin,
          ACCESS_TEAM_DOMAIN: config.accessTeamDomain,
          ACCESS_AUDIENCE: config.accessAudience,
        },
        kv_namespaces: [{ binding: "METADATA", id: config.kvNamespaceId }],
        ratelimits: [
          {
            name: "UPLOAD_RATE_LIMITER",
            namespace_id: config.rateNamespaceId,
            simple: { limit: 10, period: 60 },
          },
        ],
      },
      null,
      2,
    ),
  );
  const services = [
    { binding: "METADATA_SERVICE", service: config.workerName },
  ];
  await writeFile(
    path.join(dir, "wrangler.pages.json"),
    JSON.stringify(
      {
        name: config.pagesProject,
        account_id: config.accountId,
        pages_build_output_dir: path.join(root, "out"),
        compatibility_date: "2026-10-23",
        services,
        env: { preview: { services } },
      },
      null,
      2,
    ),
  );
}
console.log(
  process.argv.includes("--check")
    ? "Public settings validated. Nothing was deployed."
    : "Deployment configs written to .qa/devnet-beta-config/. Nothing was deployed. Verify the account, Access policy and resource names before publishing.",
);
