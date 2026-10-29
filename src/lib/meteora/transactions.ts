import { Buffer } from "buffer";
import {
  PublicKey,
  SendTransactionError,
  Transaction,
  VersionedTransaction,
  type Connection,
  type Keypair,
  type TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { DynamicBondingCurveIdl } from "./sdk";
import { getBase58Decoder } from "@solana/kit";
import type { MeteoraContext } from "./client";
import {
  DAMM_V2_INSTRUCTIONS,
  type DammInstructionLayout,
  type DammInstructionName,
} from "./damm-layout";
import {
  ASSOCIATED_TOKEN_PROGRAM,
  COMPUTE_BUDGET_PROGRAM,
  DAMM_V2_PROGRAM,
  DBC_PROGRAM,
  LIGHTHOUSE_PROGRAM,
  SPL_TOKEN_PROGRAM,
  SYSTEM_PROGRAM,
  WSOL_MINT,
} from "./programs";
import type { OperationRecord, OperationStore } from "./operations";

/** Signs with the connected wallet. The wallet may add its own instructions. */
export interface TransactionSigner {
  publicKey: PublicKey;
  signTransaction(transaction: Transaction): Promise<Transaction>;
}

type DbcInstruction = (typeof DynamicBondingCurveIdl.instructions)[number];
export type DbcInstructionName = DbcInstruction["name"];

/** What a transaction is allowed to contain. Anything else aborts it. */
export interface TxExpectation {
  owner: PublicKey;
  dbc: DbcInstructionName[];
  /** DAMM v2 (cp_amm) instructions allowed, for graduated pools. */
  damm?: DammInstructionName[];
  /** Meteora instruction accounts (IDL names) that must hold these keys. */
  accounts: Record<string, PublicKey>;
  /** Mints the owner may get an associated token account for. */
  ataMints: PublicKey[];
  /** Keys other than the owner that must sign (fresh keypairs). */
  extraSigners?: PublicKey[];
}

export class TransactionValidationError extends Error {}

function discriminatorOf(data: Buffer) {
  return data.subarray(0, 8).toString("hex");
}
const DBC_BY_DISCRIMINATOR = new Map(
  DynamicBondingCurveIdl.instructions.map((ix) => [
    Buffer.from(ix.discriminator).toString("hex"),
    ix,
  ]),
);

const DAMM_BY_DISCRIMINATOR = new Map<string, DammInstructionLayout>(
  Object.values(DAMM_V2_INSTRUCTIONS).map((ix) => [
    Buffer.from(ix.discriminator).toString("hex"),
    ix,
  ]),
);

function fail(message: string): never {
  throw new TransactionValidationError(message);
}

function checkAccounts(
  ix: TransactionInstruction,
  names: readonly string[],
  expect: TxExpectation,
) {
  names.forEach((name, index) => {
    const wanted = expect.accounts[name];
    if (wanted && !ix.keys[index]?.pubkey.equals(wanted))
      fail(`Account ${name} was substituted.`);
  });
}

function checkInstruction(ix: TransactionInstruction, expect: TxExpectation) {
  const owner = expect.owner;
  const wsolAta = getAssociatedTokenAddressSync(WSOL_MINT, owner, true);
  if (ix.programId.equals(DBC_PROGRAM)) {
    const definition = DBC_BY_DISCRIMINATOR.get(discriminatorOf(ix.data));
    if (!definition || !expect.dbc.includes(definition.name))
      fail(`Unexpected Meteora instruction ${definition?.name ?? "unknown"}.`);
    checkAccounts(
      ix,
      definition.accounts.map((account) => account.name),
      expect,
    );
    return;
  }
  if (ix.programId.equals(DAMM_V2_PROGRAM)) {
    const definition = DAMM_BY_DISCRIMINATOR.get(discriminatorOf(ix.data));
    if (
      !definition ||
      !expect.damm?.includes(definition.name as DammInstructionName)
    )
      fail(`Unexpected DAMM v2 instruction ${definition?.name ?? "unknown"}.`);
    checkAccounts(ix, definition.accounts, expect);
    return;
  }
  if (ix.programId.equals(SYSTEM_PROGRAM)) {
    // Only the transfer that funds the owner's own wrapped SOL account.
    if (ix.data.length !== 12 || ix.data.readUInt32LE(0) !== 2)
      fail("Unexpected System Program instruction.");
    if (
      !ix.keys[0]?.pubkey.equals(owner) ||
      !ix.keys[1]?.pubkey.equals(wsolAta)
    )
      fail("SOL transfer to an unexpected account.");
    return;
  }
  if (ix.programId.equals(SPL_TOKEN_PROGRAM)) {
    const kind = ix.data[0];
    if (kind === 17 && ix.keys[0]?.pubkey.equals(wsolAta)) return; // SyncNative
    if (
      kind === 9 && // CloseAccount: owner's own WSOL account, back to the owner
      ix.keys[0]?.pubkey.equals(wsolAta) &&
      ix.keys[1]?.pubkey.equals(owner) &&
      ix.keys[2]?.pubkey.equals(owner)
    )
      return;
    fail("Unexpected SPL Token instruction.");
  }
  if (ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM)) {
    const mint = ix.keys[3]?.pubkey;
    if (
      (ix.data.length === 0 || ix.data[0] === 0 || ix.data[0] === 1) &&
      ix.keys[2]?.pubkey.equals(owner) &&
      mint &&
      expect.ataMints.some((allowed) => allowed.equals(mint)) &&
      ix.keys[1]?.pubkey.equals(
        getAssociatedTokenAddressSync(mint, owner, true, ix.keys[5]?.pubkey),
      ) &&
      ix.keys[5]?.pubkey.equals(SPL_TOKEN_PROGRAM)
    )
      return;
    fail("Unexpected token account creation.");
  }
  if (ix.programId.equals(COMPUTE_BUDGET_PROGRAM)) {
    // Unit limit (2) only; RETRY adds no priority fee of its own.
    if (ix.data[0] === 2 && ix.data.length === 5) return;
    fail("Unexpected compute budget instruction.");
  }
  fail(`Unexpected program ${ix.programId.toBase58()}.`);
}

const sameInstruction = (
  a: TransactionInstruction,
  b: TransactionInstruction,
) =>
  a.programId.equals(b.programId) &&
  a.data.equals(b.data) &&
  a.keys.length === b.keys.length &&
  a.keys.every((key, i) => key.pubkey.equals(b.keys[i].pubkey));

/** Validate a transaction RETRY built, before the wallet sees it. */
export function validateTransaction(tx: Transaction, expect: TxExpectation) {
  if (!tx.feePayer?.equals(expect.owner)) fail("Fee payer is not the wallet.");
  if (!tx.instructions.length) fail("Empty transaction.");
  tx.instructions.forEach((ix) => checkInstruction(ix, expect));
  const signers = new Set(
    tx.instructions.flatMap((ix) =>
      ix.keys.filter((key) => key.isSigner).map((key) => key.pubkey.toBase58()),
    ),
  );
  const allowed = new Set(
    [expect.owner, ...(expect.extraSigners ?? [])].map((key) => key.toBase58()),
  );
  for (const signer of signers)
    if (!allowed.has(signer))
      fail("Transaction asks for an unexpected signer.");
}

/**
 * Validate what the wallet returned: same fee payer and blockhash, every
 * instruction RETRY built still there in order, and anything the wallet
 * added limited to compute budget and Lighthouse assertions.
 */
export function validateSigned(original: Transaction, signed: Transaction) {
  if (!signed.feePayer?.equals(original.feePayer!))
    fail("The wallet changed the fee payer.");
  if (signed.recentBlockhash !== original.recentBlockhash)
    fail("The wallet changed the blockhash.");
  let next = 0;
  for (const ix of signed.instructions) {
    if (
      next < original.instructions.length &&
      sameInstruction(ix, original.instructions[next])
    ) {
      next++;
      continue;
    }
    if (
      !ix.programId.equals(COMPUTE_BUDGET_PROGRAM) &&
      !ix.programId.equals(LIGHTHOUSE_PROGRAM)
    )
      fail("The wallet added an unexpected instruction.");
  }
  if (next !== original.instructions.length)
    fail("The wallet removed or changed an instruction.");
}

export interface SimulationPreview {
  /** Lamports the owner's balance changes by, excluding the network fee. */
  balanceChange: bigint;
  /** Base network fee for the message, in lamports. */
  networkFee: bigint;
  unitsConsumed: number | null;
  logs: string[];
  error: string | null;
}

/**
 * Run the exact transaction through the RPC's simulator. The owner's
 * post-simulation balance gives the real cost (rent deposits, fees, first
 * buy) at this moment, without assuming account sizes or program fees.
 */
export async function simulate(
  connection: Connection,
  tx: Transaction,
  owner: PublicKey,
): Promise<SimulationPreview> {
  const message = tx.compileMessage();
  const [before, fee, result] = await Promise.all([
    connection.getBalance(owner, "confirmed"),
    connection.getFeeForMessage(message, "confirmed"),
    connection.simulateTransaction(new VersionedTransaction(message), {
      sigVerify: false,
      commitment: "confirmed",
      accounts: { encoding: "base64", addresses: [owner.toBase58()] },
    }),
  ]);
  const after = result.value.accounts?.[0]?.lamports;
  const networkFee = BigInt(fee.value ?? 0);
  return {
    // The simulated balance already has the fee deducted.
    balanceChange:
      after == null ? 0n : BigInt(after) - BigInt(before) + networkFee,
    networkFee,
    unitsConsumed: result.value.unitsConsumed ?? null,
    logs: result.value.logs ?? [],
    error: result.value.err ? JSON.stringify(result.value.err) : null,
  };
}

export class SimulationError extends Error {
  constructor(
    message: string,
    readonly logs: string[],
  ) {
    super(message);
  }
}

export type ExecutionStage =
  "simulating" | "signing" | "sending" | "confirming";

export type ConfirmationResult =
  | { status: "confirmed"; slot: number }
  | { status: "failed"; error: string }
  | { status: "expired" }
  | { status: "unknown" };

const base58 = getBase58Decoder();
export const signatureOf = (tx: Transaction) => {
  if (!tx.signature) fail("Transaction is not signed.");
  return base58.decode(new Uint8Array(tx.signature));
};

/**
 * Wait for a signature until it is confirmed, fails, or its blockhash
 * expires. An expired blockhash proves the transaction can no longer land,
 * which is the only safe moment to offer a retry.
 */
export async function confirmSignature(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
  options: { raw?: Buffer; timeoutMs?: number; intervalMs?: number } = {},
): Promise<ConfirmationResult> {
  const deadline = Date.now() + (options.timeoutMs ?? 120_000);
  const interval = options.intervalMs ?? 1_500;
  while (Date.now() < deadline) {
    try {
      const { value } = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const status = value[0];
      if (status?.err)
        return { status: "failed", error: JSON.stringify(status.err) };
      if (
        status?.confirmationStatus === "confirmed" ||
        status?.confirmationStatus === "finalized"
      )
        return { status: "confirmed", slot: status.slot };
      if (!status) {
        const height = await connection.getBlockHeight("confirmed");
        if (height > lastValidBlockHeight) {
          // One last look: it may have landed in the final valid block.
          const last = await connection.getSignatureStatuses([signature], {
            searchTransactionHistory: true,
          });
          const final = last.value[0];
          if (final?.err)
            return { status: "failed", error: JSON.stringify(final.err) };
          if (final) return { status: "confirmed", slot: final.slot };
          return { status: "expired" };
        }
        // Rebroadcast the same signed bytes; it cannot execute twice.
        if (options.raw)
          await connection
            .sendRawTransaction(options.raw, {
              skipPreflight: true,
              maxRetries: 0,
            })
            .catch(() => undefined);
      }
    } catch {
      /* RPC hiccup: keep polling until the deadline. */
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return { status: "unknown" };
}

export interface ExecuteInput {
  context: MeteoraContext;
  tx: Transaction;
  signer: TransactionSigner;
  extraSigners?: Keypair[];
  expect: TxExpectation;
  record: Omit<
    OperationRecord,
    "signature" | "status" | "lastValidBlockHeight" | "createdAt" | "updatedAt"
  >;
  store: OperationStore;
  onStage?: (stage: ExecutionStage) => void;
}

/**
 * Simulate, sign, send and confirm one transaction. The signature is stored
 * before it is sent, so a reload or an RPC failure after sending reconciles
 * from chain state instead of resending or creating a duplicate.
 */
export async function execute(input: ExecuteInput) {
  const { context, tx, signer, expect, store } = input;
  const { connection } = context;
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = blockhash;
  validateTransaction(tx, expect);
  input.onStage?.("simulating");
  const preview = await simulate(connection, tx, signer.publicKey);
  if (preview.error) throw new SimulationError(preview.error, preview.logs);
  input.onStage?.("signing");
  const signed = await signer.signTransaction(tx);
  validateSigned(tx, signed);
  if (input.extraSigners?.length) signed.partialSign(...input.extraSigners);
  if (!signed.verifySignatures(true)) fail("A required signature is missing.");
  const signature = signatureOf(signed);
  const now = Date.now();
  const record: OperationRecord = {
    ...input.record,
    signature,
    lastValidBlockHeight,
    status: "sent",
    createdAt: now,
    updatedAt: now,
  };
  store.put(record);
  input.onStage?.("sending");
  const raw = signed.serialize();
  try {
    await connection.sendRawTransaction(raw, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 2,
    });
  } catch (cause) {
    // Preflight rejected it, so it was not broadcast. Anything else (timeout,
    // network) is ambiguous and is settled by the confirmation loop below.
    const message = cause instanceof Error ? cause.message : String(cause);
    if (/simulation failed|preflight/i.test(message)) {
      store.put({
        ...record,
        status: "failed",
        error: message,
        updatedAt: Date.now(),
      });
      // DBC and DAMM v2 reuse error numbers; the program's own log line
      // names the error, so the message is about the program that failed.
      throw new SimulationError(
        message,
        cause instanceof SendTransactionError ? (cause.logs ?? []) : [],
      );
    }
  }
  input.onStage?.("confirming");
  const result = await confirmSignature(
    connection,
    signature,
    lastValidBlockHeight,
    {
      raw,
    },
  );
  store.put({
    ...record,
    status:
      result.status === "confirmed"
        ? "confirmed"
        : result.status === "failed"
          ? "failed"
          : result.status === "expired"
            ? "expired"
            : "sent",
    error: result.status === "failed" ? result.error : undefined,
    slot: result.status === "confirmed" ? result.slot : undefined,
    updatedAt: Date.now(),
  });
  return { signature, result, preview };
}

/** Settle operations left in "sent" (reload, closed tab, lost response). */
export async function reconcile(
  context: MeteoraContext,
  store: OperationStore,
) {
  const pending = store
    .list()
    .filter((op) => op.status === "sent" && op.cluster === context.cluster);
  if (!pending.length) return [];
  const { value } = await context.connection.getSignatureStatuses(
    pending.map((op) => op.signature),
    { searchTransactionHistory: true },
  );
  const height = await context.connection.getBlockHeight("confirmed");
  const updated: OperationRecord[] = [];
  pending.forEach((op, i) => {
    const status = value[i];
    const next: OperationRecord | null = status?.err
      ? { ...op, status: "failed", error: JSON.stringify(status.err) }
      : status &&
          (status.confirmationStatus === "confirmed" ||
            status.confirmationStatus === "finalized")
        ? { ...op, status: "confirmed", slot: status.slot }
        : !status && height > op.lastValidBlockHeight
          ? { ...op, status: "expired" }
          : null;
    if (next) {
      store.put({ ...next, updatedAt: Date.now() });
      updated.push(next);
    }
  });
  return updated;
}
