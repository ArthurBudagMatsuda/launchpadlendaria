// Authorized disposable Devnet setup only. Never handles a personal wallet.
// plan: read-only; provision: protected environment + encrypted secret;
// run-smoke: decrypt locally into the test process after public Devnet checks.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { Keypair, PublicKey } from "@solana/web3.js";
import sodium from "libsodium-wrappers";

const repository = "ArthurBudagMatsuda/launchpadlendaria";
const environment = "retry-devnet";
const branch = "feat/retry-meteora-dbc-mvp";
const secretName = "RETRY_DEVNET_FUNDER";
const genesis = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const rpc = "https://api.devnet.solana.com";
const root = fileURLToPath(new URL("..", import.meta.url));
const local = path.join(
  homedir(),
  "retry-devnet-private",
  "launchpadlendaria-ci",
);
const backup = path.join(local, "keypair.dpapi");
const manifest = path.join(local, "public.json");
const action = process.argv[2] ?? "plan";
class SafeSetupError extends Error {}
const fail = (message) => {
  throw new SafeSetupError(message);
};

async function publicRpc(method, params = []) {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    fail(`Devnet public read failed (HTTP ${response.status}).`);
  const result = await response.json();
  if (result.error)
    fail("Devnet public RPC refused the read; no signing attempted.");
  return result.result;
}

function dpapi(bytes, decrypt = false) {
  if (process.platform !== "win32")
    fail(
      "This backup uses Windows CurrentUser DPAPI; use the owner's manual procedure on another OS.",
    );
  const script = decrypt
    ? "try { Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($p)); [Array]::Clear($p,0,$p.Length) } catch { [Console]::Error.Write('DPAPI operation failed'); exit 1 }"
    : "try { Add-Type -AssemblyName System.Security; $b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); $p=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($p)); [Array]::Clear($b,0,$b.Length) } catch { [Console]::Error.Write('DPAPI operation failed'); exit 1 }";
  try {
    const result = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        input: bytes,
        encoding: "utf8",
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 20_000,
      },
    );
    return decrypt ? Buffer.from(result.trim(), "base64") : result.trim();
  } catch {
    fail("The Windows private backup operation failed; no secret was printed.");
  }
}

async function main() {
  if (!["plan", "provision", "status", "run-smoke"].includes(action))
    fail("Use plan, provision, status or run-smoke.");
  if ((await publicRpc("getGenesisHash")) !== genesis)
    fail("Wrong cluster; funder operations refused.");
  if (action === "run-smoke") {
    if (!existsSync(backup) || !existsSync(manifest))
      fail("No protected disposable key exists in this checkout.");
    const publicData = JSON.parse(readFileSync(manifest, "utf8"));
    const balance = await publicRpc("getBalance", [
      new PublicKey(publicData.address).toBase58(),
      { commitment: "confirmed" },
    ]);
    if (balance.value < 1_400_020_000)
      fail(
        "Funder has less than 1.40002 Devnet SOL; no key decrypted or transaction sent.",
      );
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    if (dirty.trim())
      fail("Commit/review the checkout before running the funded test.");
    const secret = dpapi(readFileSync(backup), true);
    try {
      const key = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(secret.toString("utf8"))),
      );
      if (key.publicKey.toBase58() !== publicData.address)
        fail("Protected backup does not match the public funder.");
      const result = spawnSync("cmd.exe", ["/d", "/c", "pnpm test:chain"], {
        cwd: root,
        windowsHide: true,
        stdio: "inherit",
        env: {
          ...process.env,
          RETRY_CHAIN_MODE: "devnet",
          RETRY_CHAIN_RPC: rpc,
          RETRY_CHAIN_USE_APP_CONFIG: "1",
          RETRY_CHAIN_EVIDENCE: "evidence-devnet.json",
          RETRY_DEVNET_MAX_SPEND_SOL: "2",
          RETRY_CHAIN_GRADUATION: "0",
          RETRY_DEVNET_FUNDER: secret.toString("utf8"),
        },
      });
      if (result.error || result.status !== 0)
        fail(
          "The public Devnet smoke test failed; inspect its public evidence.",
        );
    } finally {
      secret.fill(0);
    }
    return;
  }
  let credential;
  try {
    credential = execFileSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    fail("GitHub authentication unavailable; no setup performed.");
  }
  const token = credential
    .split(/\r?\n/)
    .find((line) => line.startsWith("password="))
    ?.slice(9);
  if (!token) fail("GitHub authentication unavailable.");
  async function api(method, endpoint, body, allowMissing = false) {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "RETRY-Devnet-Setup",
        "x-github-api-version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok)
      fail(
        `GitHub ${method} failed (HTTP ${response.status}); sensitive request/response omitted.`,
      );
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  const base = `/repos/${repository}`;
  const envPath = `${base}/environments/${environment}`;
  const repo = await api("GET", base);
  const env = await api("GET", envPath, undefined, true);
  const metadata = env
    ? await api("GET", `${envPath}/secrets/${secretName}`, undefined, true)
    : null;
  if (action === "plan") {
    console.log(
      JSON.stringify(
        {
          repository,
          environment,
          secretName,
          environmentExists: !!env,
          secretExists: !!metadata,
          plan: "Create only a missing isolated Devnet environment with owner review, no admin bypass, exact implementation branch; generate disposable key, Windows-protect local backup, seal for GitHub. No transactions or production changes.",
          selfReview:
            "Owner may manually approve their own run; the helper never approves deployments.",
        },
        null,
        2,
      ),
    );
    return;
  }
  if (action === "status") {
    const publicData = existsSync(manifest)
      ? JSON.parse(readFileSync(manifest, "utf8"))
      : null;
    const balance = publicData
      ? await publicRpc("getBalance", [
          publicData.address,
          { commitment: "confirmed" },
        ])
      : null;
    console.log(
      JSON.stringify(
        {
          repository,
          environment,
          secretName,
          secretExists: !!metadata,
          address: publicData?.address ?? null,
          rpc,
          genesis,
          balanceLamports: balance?.value ?? null,
          slot: balance?.context.slot ?? null,
          protectedLocalBackup: existsSync(backup),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (!repo.permissions?.admin)
    fail("Admin permission is required to protect this new environment.");
  if (metadata)
    fail(
      "The secret already exists; refusing to replace a possibly funded key.",
    );
  if (env)
    fail(
      "The environment already exists; review its protections before any key is generated.",
    );
  if (existsSync(backup) || existsSync(manifest))
    fail("A local setup record already exists; refusing to rotate its key.");
  // Verify protected storage with harmless text before generating a key.
  const check = "retry-dpapi-storage-check";
  if (dpapi(dpapi(check), true).toString("utf8") !== check)
    fail("Protected backup round-trip failed.");
  const created = await api("PUT", envPath, {
    wait_timer: 0,
    reviewers: [{ type: "User", id: repo.owner.id }],
    prevent_self_review: false,
    can_admins_bypass: false,
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true,
    },
  });
  await api("POST", `${envPath}/deployment-branch-policies`, {
    name: branch,
    type: "branch",
  });
  const verified = await api("GET", envPath);
  const policies = await api("GET", `${envPath}/deployment-branch-policies`);
  if (
    verified.can_admins_bypass !== false ||
    !verified.protection_rules.some(
      (rule) =>
        rule.type === "required_reviewers" &&
        rule.reviewers.some((entry) => entry.reviewer.id === repo.owner.id),
    ) ||
    policies.total_count !== 1 ||
    policies.branch_policies[0].name !== branch
  )
    fail("Protected environment could not be verified; no key generated.");
  const publicKey = await api("GET", `${envPath}/secrets/public-key`);
  await sodium.ready;
  const key = Keypair.generate();
  const privateBytes = Buffer.from(JSON.stringify([...key.secretKey]), "utf8");
  try {
    mkdirSync(local, { recursive: true, mode: 0o700 });
    writeFileSync(backup, dpapi(privateBytes), { flag: "wx", mode: 0o600 });
    const record = {
      address: key.publicKey.toBase58(),
      repository,
      environment,
      environmentId: created.id,
      secretName,
      genesis,
      rpc,
      createdAt: new Date().toISOString(),
      backup: "Windows DPAPI CurrentUser; ignored local file, not committed",
    };
    writeFileSync(manifest, JSON.stringify(record, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    const encrypted = sodium.crypto_box_seal(
      privateBytes,
      sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL),
    );
    await api("PUT", `${envPath}/secrets/${secretName}`, {
      key_id: publicKey.key_id,
      encrypted_value: sodium.to_base64(
        encrypted,
        sodium.base64_variants.ORIGINAL,
      ),
    });
    const confirmed = await api("GET", `${envPath}/secrets/${secretName}`);
    console.log(
      JSON.stringify(
        {
          ...record,
          secretExists: confirmed.name === secretName,
          requiredReviewer: repo.owner.login,
          adminsBypass: verified.can_admins_bypass,
          branchPolicy: policies.branch_policies[0].name,
          transactionsSent: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    privateBytes.fill(0);
  }
}

main().catch((error) => {
  console.error(
    error instanceof SafeSetupError
      ? error.message
      : "Setup failed safely; sensitive details and stack were suppressed. Review protected local state before retrying.",
  );
  process.exitCode = 1;
});
