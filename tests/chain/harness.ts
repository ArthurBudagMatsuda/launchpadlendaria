import { writeFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { getBase58Encoder } from "@solana/kit";
import type { TransactionSigner } from "@/lib/meteora/transactions";

/**
 * Chain tests run against a real Solana cluster: a local validator loaded
 * with Meteora's program binaries, or Devnet. Nothing here is mocked.
 *
 *   RETRY_CHAIN_RPC       RPC URL (default http://127.0.0.1:8899)
 *   RETRY_CHAIN_MODE      "local" (default) or "devnet"
 *   RETRY_CHAIN_EVIDENCE  JSON file to write signatures and addresses to
 *   RETRY_METADATA_URI    https metadata URI on a trusted host
 *   RETRY_DEVNET_CONFIG   existing RETRY config to reuse (optional)
 *   RETRY_CHAIN_USE_APP_CONFIG=1  reuse the app's Devnet config (Devnet, or
 *                         a validator that cloned it)
 *   RETRY_DEVNET_FUNDER   Devnet only: secret key (JSON array or base58) of a
 *                         throwaway test wallet funded by hand at
 *                         faucet.solana.com. A CI secret, never in the repo.
 */
export const env = {
  rpc: process.env.RETRY_CHAIN_RPC ?? "http://127.0.0.1:8899",
  mode: (process.env.RETRY_CHAIN_MODE ?? "local") as "local" | "devnet",
  evidence: process.env.RETRY_CHAIN_EVIDENCE,
  metadataUri:
    process.env.RETRY_METADATA_URI ??
    "https://raw.githubusercontent.com/ArthurBudagMatsuda/launchpadlendaria/feat/retry-meteora-dbc-mvp/docs/meteora/devnet-metadata/retry-devnet-test.json",
  devnetConfig: process.env.RETRY_DEVNET_CONFIG || null,
  useAppConfig: process.env.RETRY_CHAIN_USE_APP_CONFIG === "1",
  funder: process.env.RETRY_DEVNET_FUNDER?.trim() || null,
};

export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

export function connect() {
  return new Connection(env.rpc, { commitment: "confirmed" });
}

/** Signs like a wallet: a copy of the bytes, signed, handed back. */
export function keypairSigner(keypair: Keypair): TransactionSigner {
  return {
    publicKey: keypair.publicKey,
    async signTransaction(tx) {
      const copy = Transaction.from(
        tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
      );
      copy.partialSign(keypair);
      return copy;
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The Devnet test wallet that pays for a Devnet run. The public RPC faucet
 * is closed on Devnet (410), so SOL comes from faucet.solana.com by hand.
 * Only used once the RPC has answered with the Devnet genesis hash.
 */
export function devnetFunder(genesis: string) {
  if (env.mode !== "devnet" || !env.funder) return null;
  if (genesis !== DEVNET_GENESIS)
    throw new Error("The funder key is only ever used on Devnet.");
  const secret = env.funder.startsWith("[")
    ? Uint8Array.from(JSON.parse(env.funder) as number[])
    : Uint8Array.from(getBase58Encoder().encode(env.funder));
  return Keypair.fromSecretKey(secret);
}

/**
 * Fund a fresh test key. Locally the validator mints SOL freely. On Devnet
 * the funder pays when it is set; otherwise the public faucet is asked in
 * 1 SOL steps, stopping at the first refusal. Returns the balance reached.
 */
export async function fund(
  connection: Connection,
  key: PublicKey,
  sol: number,
  funder: Keypair | null = null,
) {
  if (funder) {
    const available = await connection.getBalance(funder.publicKey);
    const lamports = Math.round(sol * LAMPORTS_PER_SOL);
    if (available >= lamports + 10_000) {
      const signature = await transferSol(connection, funder, key, lamports);
      log("funded by test wallet", { key: key.toBase58(), sol, signature });
    } else {
      log("test wallet too low", {
        funder: funder.publicKey.toBase58(),
        available,
        needed: lamports,
      });
    }
    return connection.getBalance(key, "confirmed");
  }
  const step = env.mode === "local" ? sol : 1;
  let asked = 0;
  while (asked < sol) {
    try {
      const signature = await connection.requestAirdrop(
        key,
        step * LAMPORTS_PER_SOL,
      );
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature, ...latest },
        "confirmed",
      );
      asked += step;
    } catch (cause) {
      log("airdrop refused", {
        key: key.toBase58(),
        asked,
        error: String(cause).slice(0, 200),
      });
      break;
    }
    if (env.mode === "devnet") await sleep(1_500);
  }
  return connection.getBalance(key, "confirmed");
}

/** Send what is left on a test key back to the Devnet test wallet. */
export async function refund(
  connection: Connection,
  from: Keypair,
  to: PublicKey,
) {
  const balance = await connection.getBalance(from.publicKey, "confirmed");
  if (balance <= 5_000) return null;
  return transferSol(connection, from, to, balance - 5_000).catch(
    (cause) => (log("refund failed", { error: String(cause) }), null),
  );
}

export async function transferSol(
  connection: Connection,
  from: Keypair,
  to: PublicKey,
  lamports: number,
) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports,
    }),
  );
  return sendAndConfirmTransaction(connection, tx, [from], {
    commitment: "confirmed",
  });
}

const records: Record<string, unknown>[] = [];
/** One line per fact, grep-able in CI logs as RETRY_CHAIN {...}. */
export function log(step: string, data: Record<string, unknown>) {
  const entry = { step, ...data };
  records.push(entry);
  console.log(
    `RETRY_CHAIN ${JSON.stringify(entry, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    )}`,
  );
}

export function writeEvidence(extra: Record<string, unknown>) {
  if (!env.evidence) return;
  writeFileSync(
    env.evidence,
    JSON.stringify(
      {
        mode: env.mode,
        rpc: env.rpc,
        at: new Date().toISOString(),
        ...extra,
        steps: records,
      },
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
}
