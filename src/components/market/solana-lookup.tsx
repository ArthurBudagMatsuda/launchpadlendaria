"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSolanaWallet } from "@/components/wallet/solana-provider";
import { parseAddress } from "@/lib/solana/address";
import { EmptyState } from "@/components/ui/feedback";
import { SolanaTokenTerminal } from "./solana-terminal";
export function TokenLookup() {
  const params = useSearchParams();
  const { config } = useSolanaWallet();
  const mint = parseAddress((params.get("mint") ?? "").trim());
  const cluster = params.get("cluster");
  if (!mint || !config)
    return (
      <EmptyState
        title="Enter a Solana mint address"
        action={
          <Link href="/" className="button button-primary">
            Back to Discover
          </Link>
        }
      >
        Search a base58 mint from Discover, or use ?mint=… . The selected
        application cluster is authoritative.
      </EmptyState>
    );
  if (cluster && cluster !== config.cluster)
    return (
      <EmptyState title="Select the matching application cluster">
        This link targets {cluster}. Select that environment in the header
        before inspecting the mint. No data is mixed across clusters.
      </EmptyState>
    );
  return (
    <SolanaTokenTerminal
      key={`${config.cluster}:${mint}`}
      token={{ cluster: config.cluster, address: mint }}
    />
  );
}
