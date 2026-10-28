import { createSolanaRpc } from "@solana/kit";
import { CLUSTERS, type SolanaConfig } from "@/config/solana";
import { parseAddress, type SolanaAddress } from "./address";
const verified = new Map<string, number>();
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export type TokenProgram = typeof TOKEN_PROGRAM | typeof TOKEN_2022_PROGRAM;
export async function readSolana<T>(
  config: SolanaConfig,
  read: (
    rpc: ReturnType<typeof createSolanaRpc>,
    signal: AbortSignal,
  ) => Promise<T>,
  signal?: AbortSignal,
  timeoutMs = 7_000,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    try {
      const rpc = createSolanaRpc(config.rpcUrl);
      const key = `${config.cluster}:${config.rpcUrl}`;
      if ((verified.get(key) ?? 0) < Date.now()) {
        const genesis = await rpc
          .getGenesisHash()
          .send({ abortSignal: controller.signal });
        if (genesis !== CLUSTERS[config.cluster].genesis)
          throw new Error("RPC_CLUSTER_MISMATCH");
        verified.set(key, Date.now() + 60_000);
      }
      return await read(rpc, controller.signal);
    } catch (error) {
      if (
        signal?.aborted ||
        (error instanceof Error && error.message === "RPC_CLUSTER_MISMATCH") ||
        attempt === 1
      )
        throw new Error(
          error instanceof Error && error.message === "RPC_CLUSTER_MISMATCH"
            ? "RPC cluster does not match the selected environment."
            : "Solana RPC unavailable or timed out.",
        );
      await new Promise((resolve) => setTimeout(resolve, 150));
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  throw new Error("Solana RPC unavailable.");
}
export function readSolBalance(
  config: SolanaConfig,
  owner: SolanaAddress,
  signal?: AbortSignal,
) {
  return readSolana(
    config,
    async (rpc, abortSignal) => {
      const result = await rpc
        .getBalance(owner, { commitment: "confirmed" })
        .send({ abortSignal });
      if (
        typeof result.value !== "bigint" ||
        result.value < 0n ||
        result.value > (1n << 64n) - 1n
      )
        throw new Error("Invalid lamport balance.");
      return {
        lamports: result.value,
        slot: result.context.slot,
        cluster: config.cluster,
      };
    },
    signal,
  );
}
export interface MintFacts {
  verdict: "token" | "missing" | "not-token";
  mint: SolanaAddress;
  cluster: SolanaConfig["cluster"];
  tokenProgram: TokenProgram | null;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: bigint | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  retrievedAt: number;
}
export function readMint(
  config: SolanaConfig,
  mint: SolanaAddress,
  signal?: AbortSignal,
): Promise<MintFacts> {
  return readSolana(
    config,
    async (rpc, abortSignal) => {
      const response = await rpc
        .getAccountInfo(mint, {
          encoding: "jsonParsed",
          commitment: "confirmed",
        })
        .send({ abortSignal });
      const account = response.value;
      const facts: MintFacts = {
        verdict: account ? "not-token" : "missing",
        mint,
        cluster: config.cluster,
        tokenProgram: null,
        name: null,
        symbol: null,
        decimals: null,
        totalSupply: null,
        mintAuthority: null,
        freezeAuthority: null,
        retrievedAt: Date.now(),
      };
      if (
        !account ||
        ![TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(account.owner)
      )
        return facts;
      const data = account.data as unknown as {
        parsed?: {
          type?: string;
          info?: {
            decimals?: unknown;
            supply?: unknown;
            isInitialized?: unknown;
            mintAuthority?: unknown;
            freezeAuthority?: unknown;
          };
        };
      };
      const info = data.parsed?.info;
      if (
        data.parsed?.type !== "mint" ||
        !info ||
        info.isInitialized !== true ||
        typeof info.decimals !== "number" ||
        !Number.isInteger(info.decimals) ||
        info.decimals < 0 ||
        info.decimals > 255 ||
        typeof info.supply !== "string" ||
        !/^\d+$/.test(info.supply) ||
        BigInt(info.supply) > (1n << 64n) - 1n
      )
        return facts;
      if (info.mintAuthority !== null && !parseAddress(info.mintAuthority))
        return facts;
      if (info.freezeAuthority !== null && !parseAddress(info.freezeAuthority))
        return facts;
      return {
        ...facts,
        verdict: "token",
        tokenProgram: account.owner as TokenProgram,
        decimals: info.decimals,
        totalSupply: BigInt(info.supply),
        mintAuthority: info.mintAuthority as string | null,
        freezeAuthority: info.freezeAuthority as string | null,
      };
    },
    signal,
  );
}
