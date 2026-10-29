import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";
import { RETRY_DBC_CONFIGS } from "@/config/retry-protocol";
import { RETRY_LAUNCH, retryCurve } from "@/lib/meteora/curve";
import {
  assertSdkProgramIds,
  DBC_PROGRAM,
  DAMM_V2_PROGRAM,
  METAPLEX_PROGRAM,
  DBC_POOL_AUTHORITY,
  dammV2ConfigFor,
} from "@/lib/meteora/programs";
import { DEVNET_GENESIS } from "../chain/devnet-safety";

it("checks public Devnet programs and prerequisites without a signing key", async () => {
  const rpc = process.env.RETRY_CHAIN_RPC ?? "https://api.devnet.solana.com";
  const url = new URL(rpc);
  if (url.protocol !== "https:" || url.username || url.password || url.search)
    throw new Error(
      "Use an HTTPS public Devnet RPC without credentials or query tokens for this public evidence probe.",
    );
  const connection = new Connection(rpc, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
    fetch: (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }),
  });
  const genesis = await connection.getGenesisHash();
  expect(genesis).toBe(DEVNET_GENESIS);
  assertSdkProgramIds();
  const locker = new PublicKey("LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn");
  const dammConfig = dammV2ConfigFor(RETRY_LAUNCH.migrationFeeOption);
  const programs = [DBC_PROGRAM, DAMM_V2_PROGRAM, locker, METAPLEX_PROGRAM];
  const accounts = await connection.getMultipleAccountsInfoAndContext([
    ...programs,
    dammConfig,
    DBC_POOL_AUTHORITY,
  ]);
  const funderAddress = process.env.RETRY_DEVNET_FUNDER_ADDRESS;
  const balance = funderAddress
    ? await connection.getBalanceAndContext(new PublicKey(funderAddress))
    : null;
  const evidence = {
    evidence: "REAL_PUBLIC_DEVNET_READ_ONLY",
    at: new Date().toISOString(),
    rpc,
    genesis,
    slot: accounts.context.slot,
    programs: programs.map((key, i) => ({
      address: key.toBase58(),
      exists: !!accounts.value[i],
      executable: accounts.value[i]?.executable ?? false,
      owner: accounts.value[i]?.owner.toBase58() ?? null,
    })),
    dammV2Config: {
      address: dammConfig.toBase58(),
      exists: !!accounts.value[4],
      owner: accounts.value[4]?.owner.toBase58() ?? null,
    },
    poolAuthority: {
      address: DBC_POOL_AUTHORITY.toBase58(),
      lamports: accounts.value[5]?.lamports ?? 0,
    },
    retryConfig: RETRY_DBC_CONFIGS.devnet,
    thresholdLamports: retryCurve().migrationQuoteThreshold.toString(),
    funder: balance
      ? {
          address: funderAddress,
          lamports: balance.value,
          sol:
            (BigInt(balance.value) / 1_000_000_000n).toString() +
            "." +
            (BigInt(balance.value) % 1_000_000_000n)
              .toString()
              .padStart(9, "0"),
          slot: balance.context.slot,
        }
      : { status: "PENDING_OWNER_PUBLIC_ADDRESS" },
    transactionsSent: 0,
  };
  if (process.env.RETRY_DEVNET_READINESS_EVIDENCE)
    writeFileSync(
      process.env.RETRY_DEVNET_READINESS_EVIDENCE,
      JSON.stringify(evidence, null, 2) + "\n",
    );
  console.log("RETRY_DEVNET_READINESS " + JSON.stringify(evidence));
  for (const account of accounts.value.slice(0, 4))
    expect(account?.executable).toBe(true);
  expect(accounts.value[4]?.owner.equals(DAMM_V2_PROGRAM)).toBe(true);
}, 60_000);
