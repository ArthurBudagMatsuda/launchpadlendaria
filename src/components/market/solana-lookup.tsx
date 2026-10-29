"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSolanaWallet } from "@/components/wallet/solana-provider";
import { parseAddress } from "@/lib/solana/address";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { RetryTerminal } from "@/components/launch/retry-terminal";
import { useRetryLaunch } from "@/hooks/use-retry";
import { SolanaTokenTerminal } from "./solana-terminal";
export function TokenLookup() {
  const params = useSearchParams();
  const { config } = useSolanaWallet();
  const mint = parseAddress((params.get("mint") ?? "").trim());
  const cluster = params.get("cluster");
  const launch = useRetryLaunch(
    mint && config && (!cluster || cluster === config.cluster) ? mint : null,
  );
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
  // A mint whose RETRY pool validates is a RETRY launch; anything else is an
  // external mint and gets the read-only lookup.
  if (launch.isPending && launch.fetchStatus !== "idle")
    return <LoadingSkeleton />;
  if (launch.data)
    return (
      <RetryTerminal
        key={`${config.cluster}:${mint}`}
        pool={launch.data.pool}
        raw={launch.data.raw}
        config={launch.data.config}
        metadata={launch.data.metadata}
        retrievedAt={launch.dataUpdatedAt}
      />
    );
  return (
    <SolanaTokenTerminal
      key={`${config.cluster}:${mint}`}
      token={{ cluster: config.cluster, address: mint }}
    />
  );
}
