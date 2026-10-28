"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Copy,
  Layers,
  LockKeyhole,
  Radio,
  Wallet,
} from "lucide-react";
import { ConnectWalletButton } from "@/components/wallet/solana-wallet";
import {
  useSolanaWallet,
  useSolBalance,
} from "@/components/wallet/solana-provider";
import { useApp } from "@/components/providers";
import { EmptyState } from "@/components/ui/feedback";
import { CLUSTERS, explorerUrl } from "@/config/solana";
import { shorten } from "@/lib/format";
export function Portfolio() {
  const wallet = useSolanaWallet();
  const balance = useSolBalance();
  const { notify } = useApp();
  const [tab, setTab] = useState("holdings");
  return (
    <div className="portfolio-page">
      <div className="page-heading">
        <div>
          <h1>
            Your corner of Solana<span className="heading-dot">.</span>
          </h1>
          <p>Your tokens, your activity, your next beginning.</p>
        </div>
        <span className="status-label">Portfolio</span>
      </div>
      {wallet.status !== "connected" || !wallet.address ? (
        <section className="panel portfolio-connect">
          <div className="portfolio-art">
            <Wallet size={41} />
          </div>
          <span className="eyebrow">IT STARTS WITH YOUR WALLET</span>
          <h2>A home for your next chapter.</h2>
          <p>
            Connect a Solana wallet to see its public address and real SOL
            balance on the application’s selected cluster.
          </p>
          <ConnectWalletButton align="start" />
          <div className="portfolio-features">
            <span>
              <LockKeyhole size={12} />
              Non-custodial
            </span>
            <span>
              <Layers size={12} />
              Built on Solana
            </span>
            <span>
              <Radio size={12} />
              Read-only access
            </span>
          </div>
        </section>
      ) : (
        <>
          <div className="portfolio-overview">
            <section className="panel">
              <h2>Connected wallet</h2>
              <strong>{shorten(wallet.address)}</strong>
              <button
                className="reference-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(wallet.address!);
                    notify("Wallet address copied.");
                  } catch {
                    notify("Clipboard unavailable.", true);
                  }
                }}
              >
                Copy address
                <Copy size={12} />
              </button>
              <p className="address-full mt-3">{wallet.address}</p>
              <p className="mt-3">Connected with {wallet.wallet?.name}</p>
              {wallet.config ? (
                <a
                  className="reference-button mt-3"
                  href={explorerUrl(
                    wallet.config.cluster,
                    "address",
                    wallet.address,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Solana Explorer
                  <ArrowUpRight size={12} />
                </a>
              ) : null}
            </section>
            <section className="panel">
              <h2>Application cluster</h2>
              <strong>
                {wallet.config
                  ? CLUSTERS[wallet.config.cluster].label
                  : "Configuration unavailable"}
              </strong>
              <p className="mt-3">
                RPC environment selected in RETRY. Your wallet’s own network
                settings are unchanged.
              </p>
              <p>
                {wallet.supportsCluster
                  ? "Wallet advertises support for this cluster."
                  : "Wallet cluster support is not advertised; public identity reads only."}
              </p>
            </section>
            <section className="panel">
              <h2>Native SOL balance · Live RPC</h2>
              <strong>
                {balance.available
                  ? `${balance.display} SOL`
                  : balance.isFetching
                    ? "Loading…"
                    : "Balance unavailable"}
              </strong>
              <p>
                {balance.isError
                  ? "RPC request failed. No estimated balance is shown."
                  : "Lamports read on the selected cluster, without a signature."}
              </p>
              <button
                className="reference-button mt-3"
                onClick={() => balance.refetch()}
              >
                Refresh balance
              </button>
            </section>
          </div>
          <section className="panel">
            <nav className="portfolio-tabs" aria-label="Portfolio sections">
              {[
                { id: "holdings", title: "SPL holdings" },
                { id: "created", title: "Tokens created" },
                { id: "activity", title: "Activity" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={tab === item.id ? "active" : ""}
                  aria-pressed={tab === item.id}
                  onClick={() => setTab(item.id)}
                >
                  {item.title}
                </button>
              ))}
            </nav>
            <EmptyState
              title={
                tab === "holdings"
                  ? "SPL holdings are not indexed yet"
                  : tab === "created"
                    ? "An idea is a good place to start."
                    : "A fresh page in your story."
              }
              action={
                <Link
                  href={tab === "created" ? "/create" : "/"}
                  className="button button-secondary"
                >
                  {tab === "created" ? "Preview a token" : "Explore tokens"}
                  <ArrowUpRight size={14} />
                </Link>
              }
            >
              {tab === "holdings"
                ? "Token accounts, mint ownership and prices need verified indexing. No holdings or PnL are inferred."
                : tab === "created"
                  ? "Token launches are not enabled. You can prepare a local draft."
                  : "Solana transaction signatures are not indexed yet. No activity is invented."}
            </EmptyState>
          </section>
        </>
      )}
      {wallet.configError ? (
        <p className="form-error" role="alert">
          {wallet.configError}
        </p>
      ) : null}
    </div>
  );
}
