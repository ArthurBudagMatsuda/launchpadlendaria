export type SolanaCluster = "devnet" | "mainnet-beta";
export const CLUSTERS = {
  devnet: {
    label: "Solana Devnet",
    rpc: "https://api.devnet.solana.com",
    chain: "solana:devnet",
    genesis: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  },
  "mainnet-beta": {
    label: "Solana Mainnet",
    rpc: "https://api.mainnet.solana.com",
    chain: "solana:mainnet",
    genesis: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  },
} as const;
export interface SolanaConfig {
  cluster: SolanaCluster;
  rpcUrl: string;
  wsUrl?: string;
}
export const financialActionsEnabled = false;
export function isCluster(value: unknown): value is SolanaCluster {
  return value === "devnet" || value === "mainnet-beta";
}
export function parseSolanaConfig(
  env: Record<string, string | undefined>,
): SolanaConfig {
  const cluster = env.cluster || "devnet";
  if (!isCluster(cluster)) throw new Error("Unsupported Solana cluster.");
  if ([env.trading, env.launch].some((value) => value && value !== "false"))
    throw new Error("Financial operations are unavailable in this migration.");
  const rpcUrl = env.rpc || CLUSTERS[cluster].rpc;
  const rpc = new URL(rpcUrl);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(rpc.hostname);
  if (
    rpc.username ||
    rpc.password ||
    !(rpc.protocol === "https:" || (rpc.protocol === "http:" && loopback))
  )
    throw new Error("RPC requires HTTPS or a loopback HTTP endpoint.");
  if (env.ws) {
    const ws = new URL(env.ws);
    if (
      ws.username ||
      ws.password ||
      !(
        ws.protocol === "wss:" ||
        (ws.protocol === "ws:" && loopback && ws.hostname === rpc.hostname)
      )
    )
      throw new Error("Invalid WebSocket endpoint.");
  }
  return { cluster, rpcUrl: rpc.href, wsUrl: env.ws || undefined };
}
export function appSolanaConfig() {
  return parseSolanaConfig({
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
    rpc: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    ws: process.env.NEXT_PUBLIC_SOLANA_WS_URL,
    trading: process.env.NEXT_PUBLIC_ENABLE_LIVE_TRADING,
    launch: process.env.NEXT_PUBLIC_ENABLE_TOKEN_LAUNCH,
  });
}
export function explorerUrl(
  cluster: SolanaCluster,
  kind: "address" | "tx",
  value: string,
) {
  return `https://explorer.solana.com/${kind}/${encodeURIComponent(value)}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
}
