"use client";
import { ConnectWalletButton } from "./solana-wallet";
import { useSolanaWallet } from "./solana-provider";
import { CLUSTERS } from "@/config/solana";
import { shorten } from "@/lib/format";
export function WalletStatus({
  disconnectedText,
}: {
  disconnectedText: string;
}) {
  const wallet = useSolanaWallet();
  if (!wallet.address || wallet.status !== "connected")
    return (
      <div className="wallet-status" data-state="disconnected">
        <p>{disconnectedText}</p>
        <ConnectWalletButton align="start" />
      </div>
    );
  return (
    <div className="wallet-status" data-state="connected">
      <dl className="detail-list">
        <div>
          <dt>Wallet</dt>
          <dd title={wallet.address}>{shorten(wallet.address)}</dd>
        </div>
        <div>
          <dt>Application cluster</dt>
          <dd>
            {wallet.config
              ? CLUSTERS[wallet.config.cluster].label
              : "Unavailable"}
          </dd>
        </div>
      </dl>
      <p className="tiny">
        Read-only connection. Cluster selection does not switch your wallet
        settings.
      </p>
    </div>
  );
}
