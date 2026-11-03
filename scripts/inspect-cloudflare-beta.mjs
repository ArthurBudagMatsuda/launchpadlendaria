// Read-only inventory. Uses official Wrangler auth in memory; never prints credentials.
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const account = process.argv[2];
const output = process.argv[3];
if (!/^[a-f0-9]{32}$/.test(account ?? ""))
  throw new Error("Provide the selected public account ID.");
const wrangler = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);
const raw = execFileSync(
  process.execPath,
  [wrangler, "auth", "token", "--json"],
  {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let token;
try {
  token = JSON.parse(raw).token;
} catch {
  throw new Error("Wrangler authentication unavailable.");
}
if (!/^\S{20,}$/.test(token))
  throw new Error("Wrangler authentication unavailable.");
const queries = [
  [
    "workers",
    "workers/scripts",
    (r) => r.map((v) => ({ name: v.id, modified: v.modified_on })),
  ],
  [
    "kv",
    "storage/kv/namespaces",
    (r) => r.map((v) => ({ id: v.id, title: v.title })),
  ],
  [
    "pages",
    "pages/projects",
    (r) =>
      r.map((v) => ({
        name: v.name,
        subdomain: v.subdomain,
        productionBranch: v.production_branch,
        sourceType: v.source?.type ?? "direct-upload",
        latestDeployment: v.latest_deployment?.id ?? null,
      })),
  ],
  [
    "workerAccountSettings",
    "workers/account-settings",
    (r) => ({ defaultUsageModel: r.default_usage_model }),
  ],
  [
    "accessOrganization",
    "access/organizations",
    (r) => ({ authDomain: r.auth_domain }),
  ],
  [
    "metadataWorkerSettings",
    "workers/scripts/retry-metadata-devnet-beta/settings",
    (r) => ({
      bindings: r.bindings?.map((v) => ({
        name: v.name,
        type: v.type,
        service: v.service,
        namespaceId: v.namespace_id,
      })),
    }),
  ],
  [
    "metadataWorkerPublicRoutes",
    "workers/scripts/retry-metadata-devnet-beta/subdomain",
    (r) => ({ enabled: r.enabled, previewsEnabled: r.previews_enabled }),
  ],
  [
    "betaDeployment",
    "pages/projects/retry-solana-devnet-beta",
    (r) => ({
      name: r.name,
      subdomain: r.subdomain,
      productionBranch: r.production_branch,
      sourceType: r.source?.type ?? "direct-upload",
      deployment: {
        id: (r.canonical_deployment ?? r.latest_deployment)?.id,
        url: (r.canonical_deployment ?? r.latest_deployment)?.url,
        environment: (r.canonical_deployment ?? r.latest_deployment)
          ?.environment,
        commit: (r.canonical_deployment ?? r.latest_deployment)
          ?.deployment_trigger?.metadata?.commit_hash,
        status: (r.canonical_deployment ?? r.latest_deployment)?.latest_stage
          ?.status,
      },
      serviceBindings: Object.keys(
        r.deployment_configs?.production?.services ?? {},
      ),
    }),
  ],
];
const evidence = {
  at: new Date().toISOString(),
  mode: "READ_ONLY",
  accountId: account,
  resources: {},
};
for (const [key, endpoint, select] of queries) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/${endpoint}`,
    {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = await response.json();
  evidence.resources[key] = data.success
    ? { status: response.status, value: select(data.result) }
    : { status: response.status, errorCodes: data.errors?.map((e) => e.code) };
}
if (output) await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
