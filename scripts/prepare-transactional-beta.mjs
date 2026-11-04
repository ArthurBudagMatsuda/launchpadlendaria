// Public configuration only. Reuses the existing Worker, gateway and metadata KV.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateBetaSettings } from "../infra/devnet-beta/config.ts";
const root = fileURLToPath(new URL("..", import.meta.url));
const previous = validateBetaSettings(
  JSON.parse(
    await readFile(
      new URL("../infra/devnet-beta/public-settings.json", import.meta.url),
      "utf8",
    ),
  ),
  { readOnly: true },
);
const origins = process.argv.slice(2);
if (
  !origins.length ||
  origins.length > 4 ||
  origins.some((v) => {
    try {
      const u = new URL(v);
      return (
        u.origin !== v ||
        u.protocol !== "https:" ||
        !u.hostname.endsWith(".vercel.app")
      );
    } catch {
      return true;
    }
  })
)
  throw new Error(
    "Provide 1–4 verified HTTPS Vercel preview origins. Wildcards are not allowed.",
  );
const target = path.join(root, ".qa/stage-9/worker/wrangler.json");
await mkdir(path.dirname(target), { recursive: true });
await writeFile(
  target,
  JSON.stringify(
    {
      name: previous.workerName,
      account_id: previous.accountId,
      main: path.join(root, "infra/metadata-worker/src/index.ts"),
      compatibility_date: "2026-10-23",
      workers_dev: false,
      preview_urls: false,
      vars: {
        PUBLIC_URL: previous.publicOrigin,
        ALLOWED_ORIGINS: [previous.publicOrigin, ...origins].join(","),
        ACCESS_TEAM_DOMAIN: "",
        ACCESS_AUDIENCE: "",
        UPLOAD_AUTH_MODE: "wallet-devnet",
        WALLET_AUTH_TESTERS: "Z8WdA8JSjtbvNfGLF9aMTbb6DS94eHnMMEE4k55ZDZ7",
      },
      kv_namespaces: [{ binding: "METADATA", id: previous.kvNamespaceId }],
      ratelimits: [
        {
          name: "UPLOAD_RATE_LIMITER",
          namespace_id: previous.rateNamespaceId,
          simple: { limit: 10, period: 60 },
        },
      ],
      durable_objects: {
        bindings: [
          { name: "UPLOAD_NONCES", class_name: "UploadNonceCoordinator" },
        ],
      },
      migrations: [
        {
          tag: "stage9-wallet-nonces-v1",
          new_sqlite_classes: ["UploadNonceCoordinator"],
        },
      ],
    },
    null,
    2,
  ),
);
console.log(
  "Stage 9 config prepared under .qa/stage-9/worker/. Nothing was deployed. Only the owner's approved test wallet is enabled.",
);
