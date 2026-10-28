// CI only: point a throwaway test build at the RETRY config that the chain
// tests just created on the local validator, so the browser flow can run
// before a real Devnet config exists. It edits the checkout of the CI runner,
// never a commit. Usage: node tests/chain/use-validator-config.mjs <evidence>
import { readFileSync, writeFileSync } from "node:fs";

const [evidencePath] = process.argv.slice(2);
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
for (const field of ["config", "partner", "configSignature"])
  if (!/^\w{32,88}$/.test(evidence[field] ?? ""))
    throw new Error(`Evidence has no valid ${field}; did the chain flow run?`);

const file = "src/config/retry-protocol.ts";
const source = readFileSync(file, "utf8");
const entry = `devnet: {
    address: "${evidence.config}",
    feeClaimer: "${evidence.partner}",
    createdBy: "${evidence.configSignature}",
    createdAt: "${evidence.at}",
    feeClaimerKind: "ephemeral-test-key",
  },`;
if (!source.includes("devnet: null,"))
  throw new Error("The app already has a Devnet config; nothing to point at.");
writeFileSync(file, source.replace("devnet: null,", entry));
console.log(`Test build uses the validator's RETRY config ${evidence.config}`);
