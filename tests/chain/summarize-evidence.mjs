// CI only: turn the chain flow's evidence file into run annotations and a
// job summary, so the signatures and measured costs are readable on the run
// page and through the API. Usage: node tests/chain/summarize-evidence.mjs <file> <label>
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const [path, label = "chain"] = process.argv.slice(2);
if (!existsSync(path)) {
  console.log(
    `::warning title=${label}::No evidence file; the flow did not finish.`,
  );
  process.exit(0);
}
const evidence = JSON.parse(readFileSync(path, "utf8"));
const find = (step) => evidence.steps.filter((entry) => entry.step === step);
const sol = (lamports) =>
  lamports == null ? "?" : `${(Number(lamports) / 1e9).toFixed(9)} SOL`;

const rows = [
  ["config created", (e) => `cost ${sol(e.cost)} · ${e.signature}`],
  [
    "create + first buy",
    (e) =>
      `change ${sol(e.simulatedBalanceChange)} + fee ${sol(e.networkFee)} · ${e.units} CU · ${e.signature}`,
  ],
  [
    "buy 0.5 SOL",
    (e) => `change ${sol(e.simulatedBalanceChange)} · ${e.signature}`,
  ],
  [
    "sell half",
    (e) => `change ${sol(e.simulatedBalanceChange)} · ${e.signature}`,
  ],
  [
    "complete curve",
    (e) => `change ${sol(e.simulatedBalanceChange)} · ${e.signature}`,
  ],
  ["pool authority rent float", (e) => sol(e.lamports)],
  [
    "migrate to DAMM v2",
    (e) => `fee ${sol(e.networkFee)} · ${e.units} CU · ${e.signature}`,
  ],
  ["migration cost", (e) => sol(e.lamports)],
  [
    "locked position",
    (e) =>
      `holder ${e.holder} · permanent ${e.permanent} · unlocked ${e.unlocked} · vested ${e.vested}`,
  ],
  [
    "creator claim",
    (e) =>
      e.signature
        ? `claimed ${sol(e.simulatedBalanceChange)} · ${e.signature}`
        : null,
  ],
];
const lines = [];
for (const [step, format] of rows)
  for (const entry of find(step)) {
    const text = format(entry);
    if (text) lines.push(`${step}: ${text}`);
  }
for (const key of ["migration", "graduation", "skipped"])
  if (evidence[key]) lines.push(`${key}: ${evidence[key]}`);

// GitHub keeps 10 notices per step; group them in three.
const groups = [lines.slice(0, 5), lines.slice(5, 10), lines.slice(10)];
groups.forEach((group, i) => {
  if (group.length)
    console.log(`::notice title=${label} (${i + 1})::${group.join("%0A")}`);
});
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### ${label}\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`,
  );
