// OWNER ONLY: run this yourself in a trusted local terminal. Codex must not run it.
// Usage: node scripts/create-devnet-funder.mjs <absolute path outside the checkout>
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@solana/web3.js";

const target = process.argv[2];
if (!target || !path.isAbsolute(target))
  throw new Error("Provide an absolute keypair path outside the checkout.");
const root = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
const parent = path.dirname(target);
mkdirSync(parent, { recursive: true, mode: 0o700 });
const resolvedParent = realpathSync(parent);
const relative = path.relative(root, resolvedParent);
if (
  !relative ||
  (!relative.startsWith(".." + path.sep) &&
    relative !== ".." &&
    !path.isAbsolute(relative))
)
  throw new Error(
    "Keep the keypair outside the checkout (including symlink targets).",
  );
const key = Keypair.generate();
writeFileSync(
  path.join(resolvedParent, path.basename(target)),
  JSON.stringify([...key.secretKey]),
  { flag: "wx", mode: 0o600 },
);
console.log(
  JSON.stringify(
    {
      address: key.publicKey.toBase58(),
      cluster: "Devnet only by policy; a keypair has no inherent cluster",
      file: target,
      format: "JSON array of 64 integer bytes",
      warning:
        "Disposable CI key only. Never fund on Mainnet. Keep the file private; do not send it to Codex.",
    },
    null,
    2,
  ),
);
key.secretKey.fill(0);
