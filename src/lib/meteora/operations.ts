import type { SolanaCluster } from "@/config/solana";

export type OperationKind = "create" | "buy" | "sell" | "migrate" | "claim";
export type OperationStatus = "sent" | "confirmed" | "failed" | "expired";

/**
 * One transaction RETRY sent from this browser. Public data only: no keys,
 * no secrets. The signature is the ID the chain is asked about.
 */
export interface OperationRecord {
  signature: string;
  cluster: SolanaCluster;
  kind: OperationKind;
  owner: string;
  pool: string;
  mint: string;
  /** Human summary, e.g. "Buy with 0.5 SOL". */
  summary: string;
  /** Fingerprint of a create request, to block a second launch of it. */
  requestId?: string;
  lastValidBlockHeight: number;
  status: OperationStatus;
  error?: string;
  slot?: number;
  createdAt: number;
  updatedAt: number;
}

export interface OperationStore {
  list(): OperationRecord[];
  put(record: OperationRecord): void;
}

const KEY = "retry:solana:operations:v1";
const LIMIT = 100;
export const OPERATIONS_EVENT = "retry:operations-change";

function valid(value: unknown): value is OperationRecord {
  if (!value || typeof value !== "object") return false;
  const op = value as Record<string, unknown>;
  return (
    typeof op.signature === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(op.signature) &&
    (op.cluster === "devnet" || op.cluster === "mainnet-beta") &&
    typeof op.kind === "string" &&
    typeof op.status === "string" &&
    typeof op.lastValidBlockHeight === "number"
  );
}

export function memoryStore(initial: OperationRecord[] = []): OperationStore {
  const records = new Map(initial.map((op) => [op.signature, op]));
  return {
    list: () => [...records.values()].sort((a, b) => b.createdAt - a.createdAt),
    put: (record) => void records.set(record.signature, record),
  };
}

/** Browser store. Falls back to memory when storage is unavailable. */
export function browserStore(): OperationStore {
  const fallback = memoryStore();
  const read = (): OperationRecord[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(valid) : [];
    } catch {
      return fallback.list();
    }
  };
  return {
    list: () => read().sort((a, b) => b.createdAt - a.createdAt),
    put(record) {
      fallback.put(record);
      const next = [
        record,
        ...read().filter((op) => op.signature !== record.signature),
      ]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, LIMIT);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* Storage full or blocked: the in-memory copy keeps this tab honest. */
      }
      window.dispatchEvent(new Event(OPERATIONS_EVENT));
    },
  };
}

/** A create still waiting for the chain's answer blocks a second attempt. */
export function pendingCreate(
  store: OperationStore,
  cluster: SolanaCluster,
  owner: string,
) {
  return store
    .list()
    .find(
      (op) =>
        op.kind === "create" &&
        op.cluster === cluster &&
        op.owner === owner &&
        op.status === "sent",
    );
}
