// CI only, read-only: confirm on each cluster that the Meteora programs RETRY
// pins are deployed, executable and owned by the upgradeable loader, record
// who can upgrade them, and dump the public accounts the graduation relies on
// (the DAMM v2 migration config and DBC's pool authority). Nothing is signed
// or sent. Usage: node tests/chain/verify-programs.mjs <rpc> <label> [--dump]
// --dump also prints the DAMM v2 config bytes (base64) so a validator without
// network access can load the same account.
import { appendFileSync } from "node:fs";
import { Connection, PublicKey } from "@solana/web3.js";

const [rpc, label = rpc, flag] = process.argv.slice(2);
const connection = new Connection(rpc, "confirmed");

const LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";
const PROGRAMS = {
  "Meteora DBC": "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
  "Meteora DAMM v2": "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
  "Meteora Locker": "LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn",
  "Metaplex Token Metadata": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
};
const DAMM_V2_CONFIG = "Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp";
const POOL_AUTHORITY = "FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM";

const lines = [];
const emit = (kind, data) => {
  const line = `${kind} ${label} ${JSON.stringify(data)}`;
  lines.push(line);
  console.log(line);
};

const genesis = await connection.getGenesisHash();
emit("CLUSTER", { genesis, slot: await connection.getSlot() });

let failed = false;
for (const [name, id] of Object.entries(PROGRAMS)) {
  const info = await connection.getAccountInfo(new PublicKey(id));
  if (!info) {
    emit("PROGRAM", { name, id, deployed: false });
    failed = true;
    continue;
  }
  // UpgradeableLoaderState::Program { programdata_address } (tag 2).
  const programData = new PublicKey(info.data.subarray(4, 36));
  const data = await connection.getAccountInfo(programData, {
    dataSlice: { offset: 0, length: 45 },
  });
  // UpgradeableLoaderState::ProgramData { slot, upgrade_authority } (tag 3).
  const slot = data ? Number(data.data.readBigUInt64LE(4)) : null;
  const authority =
    data && data.data[12] === 1
      ? new PublicKey(data.data.subarray(13, 45)).toBase58()
      : null;
  const ok =
    info.executable &&
    info.owner.toBase58() === LOADER &&
    info.data.readUInt32LE(0) === 2;
  if (!ok) failed = true;
  emit("PROGRAM", {
    name,
    id,
    deployed: true,
    executable: info.executable,
    owner: info.owner.toBase58(),
    programData: programData.toBase58(),
    lastDeploySlot: slot,
    // null means the program is immutable; a key means it can be upgraded.
    upgradeAuthority: authority,
  });
}

const config = await connection.getAccountInfo(new PublicKey(DAMM_V2_CONFIG));
if (!config) {
  emit("DAMM_V2_CONFIG", { address: DAMM_V2_CONFIG, exists: false });
  failed = true;
} else {
  // Config (bytemuck, after the 8-byte discriminator): vault_config_key (32),
  // pool_creator_authority (32), pool_fees (128, base fee first: its cliff
  // fee numerator is the first u64), activation_type, collect_fee_mode.
  const d = config.data;
  const creatorAuthority = new PublicKey(d.subarray(40, 72)).toBase58();
  emit("DAMM_V2_CONFIG", {
    address: DAMM_V2_CONFIG,
    exists: true,
    owner: config.owner.toBase58(),
    bytes: d.length,
    lamports: config.lamports,
    poolCreatorAuthority: creatorAuthority,
    // Only DBC's pool authority may create pools from this config.
    restrictedToDbc: creatorAuthority === POOL_AUTHORITY,
    cliffFeeNumerator: d.readBigUInt64LE(72).toString(),
    activationType: d[200],
    collectFeeMode: d[201],
  });
  if (flag === "--dump")
    console.log(
      `DAMM_V2_CONFIG_DATA ${label} ${JSON.stringify({
        owner: config.owner.toBase58(),
        lamports: config.lamports,
        data: d.toString("base64"),
      })}`,
    );
}
emit("DBC_POOL_AUTHORITY", {
  address: POOL_AUTHORITY,
  lamports: await connection.getBalance(new PublicKey(POOL_AUTHORITY)),
});

if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Programs on ${label}\n\n${lines.map((line) => `- \`${line}\``).join("\n")}\n`,
  );
for (const line of lines)
  console.log(`::notice title=Programs (${label})::${line}`);
if (failed) {
  console.log(
    `::error title=Programs (${label})::A pinned program or account is missing or not executable.`,
  );
  process.exit(1);
}
