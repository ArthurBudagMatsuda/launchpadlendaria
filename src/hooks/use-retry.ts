"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PublicKey, type Keypair, type Transaction } from "@solana/web3.js";
import { executionPolicy } from "@/config/retry-protocol";
import { useSolanaWallet } from "@/components/wallet/solana-provider";
import { meteoraContext } from "@/lib/meteora/client";
import { userMessage } from "@/lib/meteora/errors";
import {
  fetchOffchainMetadata,
  readMetadata,
  type OnchainMetadata,
} from "@/lib/meteora/metadata";
import {
  browserStore,
  OPERATIONS_EVENT,
  type OperationKind,
  type OperationRecord,
} from "@/lib/meteora/operations";
import {
  listRetryPools,
  PoolValidationError,
  readRetryPool,
  retryPoolAddress,
  type RetryPool,
} from "@/lib/meteora/pools";
import {
  execute,
  reconcile,
  simulate,
  type ExecutionStage,
  type SimulationPreview,
  type TxExpectation,
} from "@/lib/meteora/transactions";
import { SPL_TOKEN_PROGRAM } from "@/lib/meteora/programs";
import { supportsSigning, walletSigner } from "@/lib/meteora/wallet-signer";

export const LAUNCHES_REFRESH_MS = 20_000;
export const POOL_REFRESH_MS = 10_000;

/**
 * The Meteora context for the cluster and RPC the wallet provider holds,
 * plus what the app may do there. One source of truth: the provider.
 */
export function useMeteora() {
  const wallet = useSolanaWallet();
  const config = wallet.config;
  const context = useMemo(
    () => (config ? meteoraContext(config) : null),
    [config],
  );
  const policy = config ? executionPolicy(config.cluster) : null;
  return { wallet, context, policy };
}

export interface RetryLaunch {
  pool: RetryPool;
  metadata: OnchainMetadata | null;
}

/** Every RETRY launch on the selected cluster, read from the DBC program. */
export function useRetryLaunches() {
  const { context } = useMeteora();
  return useQuery({
    queryKey: [
      "retry",
      "launches",
      context?.cluster,
      context?.retryConfig?.toBase58(),
    ],
    enabled: Boolean(context?.retryConfig),
    staleTime: LAUNCHES_REFRESH_MS / 2,
    refetchInterval: LAUNCHES_REFRESH_MS,
    retry: 1,
    queryFn: async (): Promise<RetryLaunch[]> => {
      const pools = await listRetryPools(context!);
      const metadata = await readMetadata(
        context!,
        pools.map((pool) => new PublicKey(pool.baseMint)),
      );
      return pools
        .map((pool) => ({
          pool,
          metadata: metadata.get(pool.baseMint) ?? null,
        }))
        .sort((a, b) =>
          Number(b.pool.activationPoint - a.pool.activationPoint),
        );
    },
  });
}

/**
 * The RETRY launch of a mint, or null when the mint is not one (no pool at
 * the RETRY PDA, or a pool that fails validation).
 */
export function useRetryLaunch(mint: string | null) {
  const { context } = useMeteora();
  return useQuery({
    queryKey: [
      "retry",
      "launch",
      context?.cluster,
      context?.retryConfig?.toBase58(),
      mint,
    ],
    enabled: Boolean(context && mint),
    staleTime: POOL_REFRESH_MS / 2,
    refetchInterval: POOL_REFRESH_MS,
    retry: 1,
    queryFn: async () => {
      const address = retryPoolAddress(context!, new PublicKey(mint!));
      if (!address) return null;
      try {
        const read = await readRetryPool(context!, address);
        const metadata = (
          await readMetadata(context!, [new PublicKey(mint!)])
        ).get(mint!);
        return { ...read, address, metadata: metadata ?? null };
      } catch (cause) {
        if (cause instanceof PoolValidationError) return null;
        throw cause;
      }
    },
  });
}

export function useOffchainMetadata(
  onchain: OnchainMetadata | null | undefined,
) {
  return useQuery({
    queryKey: [
      "retry",
      "offchain",
      onchain?.uri,
      onchain?.name,
      onchain?.symbol,
    ],
    enabled: Boolean(onchain?.uri),
    staleTime: Infinity,
    retry: 1,
    queryFn: ({ signal }) => fetchOffchainMetadata(onchain!, signal),
  });
}

/** Recent transactions that touched a pool, newest first (signatures only). */
export function usePoolActivity(pool: string | null) {
  const { context } = useMeteora();
  return useQuery({
    queryKey: ["retry", "activity", context?.cluster, pool],
    enabled: Boolean(context && pool),
    refetchInterval: POOL_REFRESH_MS * 2,
    retry: 1,
    queryFn: () =>
      context!.connection.getSignaturesForAddress(
        new PublicKey(pool!),
        { limit: 20 },
        "confirmed",
      ),
  });
}

const store = typeof window === "undefined" ? null : browserStore();
const EMPTY: OperationRecord[] = [];
let snapshot: OperationRecord[] = EMPTY;
let snapshotKey = "";
function readOperations() {
  if (!store) return EMPTY;
  const list = store.list();
  const key = list.map((op) => `${op.signature}:${op.status}`).join(",");
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshot = list;
  }
  return snapshot;
}
function subscribeOperations(listener: () => void) {
  window.addEventListener(OPERATIONS_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(OPERATIONS_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** Transactions this browser sent, settled against the chain on load. */
export function useOperations() {
  const { context } = useMeteora();
  const operations = useSyncExternalStore(
    subscribeOperations,
    readOperations,
    () => EMPTY,
  );
  const reconciled = useRef<string | null>(null);
  useEffect(() => {
    if (!context || !store || reconciled.current === context.cluster) return;
    reconciled.current = context.cluster;
    reconcile(context, store).catch(() => {
      reconciled.current = null;
    });
  }, [context]);
  return { operations, store };
}

export interface ExecuteRequest {
  kind: OperationKind;
  tx: Transaction;
  expect: TxExpectation;
  extraSigners?: Keypair[];
  pool: string;
  mint: string;
  summary: string;
  requestId?: string;
}

export type ExecutionState =
  | { phase: "idle" }
  | { phase: "running"; stage: ExecutionStage }
  | { phase: "done"; signature: string; status: OperationRecord["status"] }
  | { phase: "error"; message: string; signature?: string };

/**
 * Run one transaction through simulate → wallet signature → send → confirm
 * with the connected Wallet Standard account. One at a time per component.
 */
export function useExecute() {
  const { wallet, context, policy } = useMeteora();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ExecutionState>({ phase: "idle" });
  const busy = useRef(false);
  const canSign =
    wallet.status === "connected" &&
    Boolean(wallet.account) &&
    supportsSigning(wallet.wallet);
  const run = useCallback(
    async (request: ExecuteRequest) => {
      if (busy.current || !context || !store) return null;
      if (!policy?.enabled) {
        setState({
          phase: "error",
          message: "Execution is not available on this cluster.",
        });
        return null;
      }
      if (!wallet.wallet || !wallet.account) {
        setState({ phase: "error", message: "Connect a wallet first." });
        return null;
      }
      busy.current = true;
      setState({ phase: "running", stage: "simulating" });
      try {
        const signer = walletSigner(
          wallet.wallet,
          wallet.account,
          context.cluster,
        );
        const { signature, result } = await execute({
          context,
          tx: request.tx,
          signer,
          extraSigners: request.extraSigners,
          expect: request.expect,
          store,
          record: {
            cluster: context.cluster,
            kind: request.kind,
            owner: signer.publicKey.toBase58(),
            pool: request.pool,
            mint: request.mint,
            summary: request.summary,
            requestId: request.requestId,
          },
          onStage: (stage) => setState({ phase: "running", stage }),
        });
        const status =
          result.status === "unknown"
            ? "sent"
            : result.status === "confirmed"
              ? "confirmed"
              : result.status;
        setState(
          status === "confirmed" || status === "sent"
            ? { phase: "done", signature, status }
            : {
                phase: "error",
                signature,
                message:
                  status === "expired"
                    ? "The transaction expired before it was confirmed. Nothing was spent; you can try again."
                    : "The transaction failed on-chain. Only the network fee was spent.",
              },
        );
        await queryClient.invalidateQueries({ queryKey: ["retry"] });
        await queryClient.invalidateQueries({
          queryKey: ["solana", "balance"],
        });
        return { signature, status };
      } catch (cause) {
        console.error("RETRY operation failed", cause);
        setState({ phase: "error", message: userMessage(cause) });
        return null;
      } finally {
        busy.current = false;
      }
    },
    [context, policy, queryClient, wallet.account, wallet.wallet],
  );
  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, run, reset, canSign };
}

/** Simulate a prepared transaction to show its real cost before signing. */
export async function previewCost(
  context: NonNullable<ReturnType<typeof useMeteora>["context"]>,
  tx: Transaction,
  owner: PublicKey,
): Promise<SimulationPreview> {
  const { blockhash } =
    await context.connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;
  return simulate(context.connection, tx, owner);
}

export { userMessage };

/** The wallet's balances of RETRY tokens on this cluster (SPL Token accounts). */
export function useRetryHoldings(owner: string | undefined) {
  const { context } = useMeteora();
  const launches = useRetryLaunches();
  return useQuery({
    queryKey: [
      "retry",
      "holdings",
      context?.cluster,
      owner,
      launches.data?.length,
    ],
    enabled: Boolean(context && owner && launches.data),
    refetchInterval: LAUNCHES_REFRESH_MS,
    retry: 1,
    queryFn: async () => {
      const { value } = await context!.connection.getParsedTokenAccountsByOwner(
        new PublicKey(owner!),
        { programId: SPL_TOKEN_PROGRAM },
        "confirmed",
      );
      const byMint = new Map(
        launches.data!.map((launch) => [launch.pool.baseMint, launch]),
      );
      const holdings = new Map<
        string,
        { launch: RetryLaunch; amount: bigint }
      >();
      for (const { account } of value) {
        const info = (
          account.data as {
            parsed?: {
              info?: { mint?: string; tokenAmount?: { amount?: string } };
            };
          }
        ).parsed?.info;
        const launch = info?.mint ? byMint.get(info.mint) : undefined;
        const amount = BigInt(info?.tokenAmount?.amount ?? "0");
        if (!launch || amount === 0n) continue;
        const previous = holdings.get(launch.pool.baseMint)?.amount ?? 0n;
        holdings.set(launch.pool.baseMint, {
          launch,
          amount: previous + amount,
        });
      }
      return [...holdings.values()];
    },
  });
}
