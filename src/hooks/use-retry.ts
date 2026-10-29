"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  queryOptions,
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { PublicKey, type Keypair, type Transaction } from "@solana/web3.js";
import {
  executionPolicy,
  POLICY_MESSAGES,
  type RetryFeature,
} from "@/config/retry-protocol";
import { useSolanaWallet } from "@/components/wallet/solana-provider";
import { meteoraContext, type MeteoraContext } from "@/lib/meteora/client";
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
import { fetchActivity, type ActivityPage } from "@/lib/meteora/history";
// Types only: the DAMM v2 SDK loads on demand, on graduated tokens' pages.
import type { DammPool } from "@/lib/meteora/damm-v2";
import type { PoolState } from "@/lib/meteora/damm-sdk";
import { SPL_TOKEN_PROGRAM } from "@/lib/meteora/programs";
import { supportsSigning, walletSigner } from "@/lib/meteora/wallet-signer";

export const LAUNCHES_REFRESH_MS = 20_000;
export const POOL_REFRESH_MS = 10_000;

/**
 * The Meteora context for the cluster and RPC the wallet provider holds,
 * plus what the app may do there (for one feature, when given). One source
 * of truth: the provider.
 */
export function useMeteora(feature?: RetryFeature) {
  const wallet = useSolanaWallet();
  const config = wallet.config;
  const context = useMemo(
    () => (config ? meteoraContext(config) : null),
    [config],
  );
  const policy = config ? executionPolicy(config.cluster, feature) : null;
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

/** Transactions per pool and page of a launch's history. */
export const HISTORY_PAGE = 20;

/**
 * A launch's history, decoded from Meteora's events: its DBC pool and, once
 * graduated, its DAMM v2 pool. Pages go back in time ("load older").
 */
export function useLaunchHistory(pool: RetryPool) {
  const { context } = useMeteora();
  const damm = pool.status === "graduated" ? pool.dammV2Pool : null;
  return useInfiniteQuery({
    queryKey: ["retry", "history", context?.cluster, pool.address, damm],
    enabled: Boolean(context),
    initialPageParam: undefined as ActivityPage["before"] | undefined,
    queryFn: ({ pageParam }) =>
      fetchActivity(
        context!,
        { dbc: pool.address, damm },
        { limit: HISTORY_PAGE, before: pageParam },
      ),
    getNextPageParam: (last) => (last.hasMore ? last.before : undefined),
    refetchInterval: POOL_REFRESH_MS * 3,
    retry: 1,
  });
}

/**
 * The DAMM v2 pool a launch graduated to, checked against the launch. The
 * DAMM v2 SDK is imported here, so pages of tokens still on the curve never
 * download it.
 */
function dammPoolQuery(context: MeteoraContext | null, pool: RetryPool) {
  return queryOptions({
    queryKey: ["retry", "damm", context?.cluster, pool.dammV2Pool],
    enabled: Boolean(context && pool.dammV2Pool && pool.status === "graduated"),
    staleTime: POOL_REFRESH_MS / 2,
    refetchInterval: POOL_REFRESH_MS,
    retry: 1,
    queryFn: async (): Promise<{ pool: DammPool; state: PoolState }> => {
      const { readDammPool } = await import("@/lib/meteora/damm-v2");
      return readDammPool(context!, pool);
    },
  });
}

export function useDammPool(pool: RetryPool) {
  const { context } = useMeteora();
  return useQuery(dammPoolQuery(context, pool));
}

/** The graduated pools of several launches (one query each, shared cache). */
export function useDammPools(pools: RetryPool[]) {
  const { context } = useMeteora();
  return useQueries({
    queries: pools.map((pool) => dammPoolQuery(context, pool)),
  });
}

/** The wallet's LP positions in graduated RETRY pools. */
export function useLpPositions(owner: string | undefined) {
  const { context } = useMeteora();
  const launches = useRetryLaunches();
  const graduated = (launches.data ?? []).filter(
    (launch) => launch.pool.status === "graduated",
  );
  return useQuery({
    queryKey: [
      "retry",
      "lp-positions",
      context?.cluster,
      owner,
      graduated.length,
    ],
    enabled: Boolean(context && owner && launches.data),
    refetchInterval: LAUNCHES_REFRESH_MS * 3,
    retry: 1,
    queryFn: async () => {
      if (!graduated.length) return [];
      const { listLpPositions } = await import("@/lib/meteora/damm-v2");
      return listLpPositions(
        context!,
        new PublicKey(owner!),
        graduated.map((launch) => launch.pool),
      );
    },
  });
}

/** The graduated liquidity's lock, proven from the positions' state. */
export function useLockVerification(
  damm: { pool: DammPool; state: PoolState } | undefined,
) {
  const { context } = useMeteora();
  return useQuery({
    queryKey: [
      "retry",
      "lock",
      context?.cluster,
      damm?.pool.address,
      damm?.pool.slot,
    ],
    enabled: Boolean(context && damm),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const { verifyLockedLiquidity } = await import("@/lib/meteora/damm-v2");
      return verifyLockedLiquidity(context!, damm!.pool, damm!.state);
    },
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
export function useExecute(feature: RetryFeature) {
  const { wallet, context, policy } = useMeteora(feature);
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
          message: policy
            ? POLICY_MESSAGES[policy.reason]
            : "Execution is not available on this cluster.",
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
