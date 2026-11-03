// Writes local, public-only fixtures; verifies remote GETs. Never uploads or signs.
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateBetaSettings } from "../infra/devnet-beta/config.ts";
const settings = validateBetaSettings(
  JSON.parse(
    await readFile(
      new URL("../infra/devnet-beta/public-settings.json", import.meta.url),
      "utf8",
    ),
  ),
  { readOnly: true },
);
const directory = fileURLToPath(
  new URL("../.qa/stage-8/storage-probe/", import.meta.url),
);
await mkdir(directory, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const imageHash = hash(image);
const imageUrl = `${settings.publicOrigin}/v1/i/${imageHash}`;
const json = Buffer.from(
  JSON.stringify({
    name: "RETRY Storage Probe",
    symbol: "RKV8",
    description:
      "Public infrastructure probe only. No SPL token or pool was created from this document.",
    image: imageUrl,
    properties: { files: [{ uri: imageUrl, type: "image/png" }] },
    createdOn: "RETRY",
  }),
);
const metadataHash = hash(json);
const uri = `${settings.publicOrigin}/v1/m/${metadataHash}.json`;
const plan = {
  imageKey: `i:${imageHash}`,
  metadataKey: `m:${metadataHash}`,
  imageUrl,
  uri,
  imageSha256: imageHash,
  metadataSha256: metadataHash,
  tokenMinted: false,
};
await writeFile(`${directory}/image.png`, image);
await writeFile(`${directory}/metadata.json`, json);
await writeFile(`${directory}/plan.json`, JSON.stringify(plan, null, 2) + "\n");
if (process.argv[2] === "verify") {
  const attempts = [];
  let verified = false;
  for (const delay of [0, 2000, 5000, 10000, 20000, 30000, 30000]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const observed = [];
    for (const [url, expected, contentType] of [
      [imageUrl, imageHash, "image/png"],
      [uri, metadataHash, "application/json"],
    ]) {
      const response = await fetch(url, {
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const actualHash = hash(bytes);
      const headers = Object.fromEntries(
        [
          "content-type",
          "cache-control",
          "x-content-type-options",
          "access-control-allow-origin",
          "cf-ray",
        ].map((key) => [key, response.headers.get(key)]),
      );
      const pass =
        response.status === 200 &&
        actualHash === expected &&
        headers["content-type"]?.split(";")[0] === contentType &&
        headers["x-content-type-options"] === "nosniff";
      observed.push({
        url,
        status: response.status,
        sha256: actualHash,
        headers,
        pass,
      });
      if (response.ok && !pass)
        throw new Error(
          "Public storage integrity or content-type check failed.",
        );
    }
    attempts.push({ at: new Date().toISOString(), observed });
    if (observed.every((value) => value.pass)) {
      verified = true;
      break;
    }
  }
  const evidence = {
    evidence: "PUBLIC_CLOUDFLARE_KV_READ",
    at: new Date().toISOString(),
    provisioning:
      "administrator seeded two test objects with Wrangler; not a browser POST",
    uploadAuthentication: "BLOCKED; Access not activated",
    verified,
    availability: "one observed edge location only; not global consistency",
    ...plan,
    attempts,
  };
  await writeFile(
    `${directory}/public-verification.json`,
    JSON.stringify(evidence, null, 2) + "\n",
  );
  if (!verified)
    throw new Error(
      "KV propagation or deployment is still pending. No upload or transaction was repeated.",
    );
  console.log(JSON.stringify(evidence, null, 2));
} else if (process.argv[2] === "prepare") {
  console.log(JSON.stringify(plan, null, 2));
} else
  throw new Error(
    "Use prepare or verify. Remote writes require separate, explicit Wrangler commands.",
  );
