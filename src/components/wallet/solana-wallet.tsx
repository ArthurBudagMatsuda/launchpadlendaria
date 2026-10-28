"use client";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, Copy, LogOut, Wallet } from "lucide-react";
import { CLUSTERS, explorerUrl, type SolanaCluster } from "@/config/solana";
import { Modal } from "@/components/ui/modal";
import { shorten } from "@/lib/format";
import { useSolanaWallet, useSolBalance } from "./solana-provider";
const INSTALL = [
  { name: "Phantom", url: "https://phantom.com/" },
  { name: "Solflare", url: "https://solflare.com/" },
  { name: "Backpack", url: "https://backpack.app/" },
];
export function NetworkIndicator({ className = "" }: { className?: string }) {
  const wallet = useSolanaWallet();
  return (
    <label className={`solana-cluster ${className}`}>
      <span className="solana-mark" aria-hidden="true" />
      <select
        aria-label="Application Solana cluster"
        value={wallet.config?.cluster ?? ""}
        onChange={(event) =>
          wallet.selectCluster(event.target.value as SolanaCluster)
        }
      >
        {!wallet.config ? <option value="">Configuration error</option> : null}
        <option value="devnet">Devnet</option>
        <option value="mainnet-beta">Mainnet</option>
      </select>
    </label>
  );
}
export function ConnectWalletButton({
  className = "",
}: {
  className?: string;
  align?: "start" | "end";
}) {
  const wallet = useSolanaWallet();
  const balance = useSolBalance();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const connected = wallet.status === "connected" && wallet.address;
  function dismiss(next: boolean) {
    if (!next && wallet.status === "connecting") wallet.cancel();
    setOpen(next);
  }
  return (
    <>
      <button
        className={`button button-primary ${className}`}
        onClick={() => setOpen(true)}
      >
        <Wallet size={16} />
        {connected ? shorten(wallet.address!) : "Connect Wallet"}
      </button>
      <Modal
        open={open}
        onOpenChange={dismiss}
        title={connected ? "Your Solana wallet" : "Connect a Solana wallet"}
        description="Connecting shares your public address. Every transaction needs your approval in the wallet."
      >
        {connected ? (
          <div className="solana-wallet-menu">
            <strong>{wallet.wallet?.name}</strong>
            <p className="address-full">{wallet.address}</p>
            <p>
              {wallet.config
                ? CLUSTERS[wallet.config.cluster].label
                : "Configuration unavailable"}{" "}
              · application RPC
            </p>
            <p>
              Balance:{" "}
              {balance.available
                ? `${balance.display} SOL`
                : balance.isFetching
                  ? "Loading…"
                  : "Balance unavailable"}
            </p>
            {!wallet.supportsCluster ? (
              <p className="notice-strip">
                The wallet does not advertise support for this cluster. The
                public balance is read using the application RPC.
              </p>
            ) : null}
            <button
              className="button button-secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(wallet.address!);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <Copy size={15} />
              {copied ? "Copied" : "Copy address"}
            </button>
            {wallet.config ? (
              <a
                className="button button-secondary"
                href={explorerUrl(
                  wallet.config.cluster,
                  "address",
                  wallet.address!,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                Solana Explorer
                <ArrowUpRight size={15} />
              </a>
            ) : null}
            <button
              className="button button-secondary"
              onClick={() => balance.refetch()}
            >
              Refresh balance
            </button>
            <button
              className="button button-secondary"
              onClick={async () => {
                await wallet.disconnect();
                setOpen(false);
              }}
            >
              <LogOut size={15} />
              Disconnect
            </button>
          </div>
        ) : (
          <div className="solana-wallet-list">
            {wallet.wallets.map((selected) => (
              <button
                key={selected.name}
                className="button button-secondary solana-wallet-option"
                disabled={wallet.status === "connecting"}
                onClick={async () => {
                  await wallet.connect(selected);
                }}
              >
                {/^data:image\/(png|jpeg|webp|svg\+xml);base64,[a-zA-Z0-9+/=]+$/.test(
                  selected.icon,
                ) && selected.icon.length < 100_000 ? (
                  <Image
                    unoptimized
                    src={selected.icon}
                    width={26}
                    height={26}
                    alt=""
                  />
                ) : (
                  <Wallet size={22} />
                )}
                <span>{selected.name}</span>
                <small>Available</small>
              </button>
            ))}
            {!wallet.wallets.length ? (
              <p>
                No compatible Solana wallet detected. Open this site in a wallet
                browser or install a supported wallet.
              </p>
            ) : null}
            {INSTALL.filter(
              (item) =>
                !wallet.wallets.some(
                  (installed) =>
                    installed.name.toLowerCase() === item.name.toLowerCase(),
                ),
            ).map((item) => (
              <a
                className="button button-secondary"
                key={item.name}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Install {item.name}
                <ArrowUpRight size={14} />
              </a>
            ))}
            {wallet.status === "connecting" ? (
              <p role="status">
                Confirm the connection in your wallet.{" "}
                <button onClick={wallet.cancel} className="reference-button">
                  Cancel
                </button>
              </p>
            ) : null}
          </div>
        )}
        {wallet.error ? (
          <p className="form-error" role="alert">
            {wallet.error}
          </p>
        ) : null}
        {wallet.configError ? (
          <p className="form-error" role="alert">
            {wallet.configError}
          </p>
        ) : null}
        <p className="tiny muted mt-3">
          Cluster selection changes RETRY’s RPC. It does not change your
          wallet’s network settings.
        </p>
      </Modal>
    </>
  );
}
