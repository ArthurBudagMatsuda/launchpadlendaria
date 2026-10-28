"use client";
import { useState } from "react";
import {
  ConnectWalletButton,
  SwitchNetworkButton,
  useRetryWallet,
} from "@retry/web3";
import {
  ArrowUpRight,
  Copy,
  Layers,
  LockKeyhole,
  Radio,
  Wallet,
} from "lucide-react";
import { useApp } from "@/components/providers";
import { EmptyState } from "@/components/ui/feedback";
import { TrackedBalances } from "@/components/portfolio/tracked-balances";
import { shorten } from "@/lib/format";
import Link from "next/link";
export function Portfolio() {
  const wallet = useRetryWallet();
  const { address, isConnected, chainId, balance, network } = wallet;
  const { notify } = useApp();
  const [tab, setTab] = useState("holdings");
  return (
    <div className="portfolio-page">
      <div className="page-heading">
        <div>
          <h1>
            Your corner of Base<span className="heading-dot">.</span>
          </h1>
          <p>Your tokens, your activity, your next beginning.</p>
        </div>
        <span className="status-label">Portfolio</span>
      </div>
      {!isConnected || !address ? (
        <section className="panel portfolio-connect">
          <div className="portfolio-art">
            <Wallet size={41} />
          </div>
          <span className="eyebrow">IT STARTS WITH YOUR WALLET</span>
          <h2>A home for your next chapter.</h2>
          <p>
            Connect your wallet to see your Base network, your ETH balance and
            your balances of the tokens RETRY tracks, read from Base RPC.
          </p>
          <ConnectWalletButton align="start" />
          <div className="portfolio-features">
            <span>
              <LockKeyhole size={12} />
              Non-custodial
            </span>
            <span>
              <Layers size={12} />
              Built on Base
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
              <strong>{shorten(address)}</strong>
              <button
                className="reference-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(address);
                    notify("Wallet address copied.");
                  } catch {
                    notify("Clipboard unavailable.", true);
                  }
                }}
              >
                Copy address
                <Copy size={12} />
              </button>
              <p className="address-full mt-3">{address}</p>
              {wallet.connector ? (
                <p className="mt-3">Connected with {wallet.connector.name}</p>
              ) : null}
              {wallet.explorerAddressUrl ? (
                <a
                  className="reference-button mt-3"
                  href={wallet.explorerAddressUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on {network.walletNetwork?.explorerName ?? "explorer"}
                  <ArrowUpRight size={12} />
                </a>
              ) : null}
            </section>
            <section className="panel">
              <h2>Connected network</h2>
              <strong>
                {network.isWrongNetwork
                  ? `Wrong network (${wallet.networkName ?? chainId})`
                  : wallet.networkName}
              </strong>
              {network.isWrongNetwork ? <SwitchNetworkButton /> : null}
              <p className="mt-3">Chain ID: {chainId}</p>
            </section>
            <section className="panel">
              <h2>Native ETH balance · Live RPC</h2>
              <strong title={balance.exact && `${balance.exact} ETH`}>
                {balance.status === "success"
                  ? balance.display
                  : balance.status === "loading"
                    ? "Loading…"
                    : balance.status === "wrong-network"
                      ? "Unsupported network"
                      : "Unavailable"}
              </strong>
              <p>
                {balance.status === "error"
                  ? (balance.error?.message ??
                    "RPC request failed. No estimated balance is shown.")
                  : "Read from your wallet’s connected Base network."}
              </p>
              {balance.status === "error" ? (
                <button
                  className="reference-button mt-3"
                  onClick={() => balance.refetch()}
                >
                  Retry balance
                </button>
              ) : null}
            </section>
          </div>
          {network.isWrongNetwork ? (
            <div className="notice-strip mb-5">
              {network.notice?.message ??
                "Switch to a Base network to read your native ETH balance."}
            </div>
          ) : null}
          <section className="panel">
            <nav className="portfolio-tabs" aria-label="Portfolio sections">
              {[
                { id: "holdings", title: "Tracked tokens" },
                { id: "created", title: "Tokens created" },
                { id: "activity", title: "Activity" },
              ].map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? "active" : ""}
                  onClick={() => setTab(t.id)}
                  aria-pressed={tab === t.id}
                >
                  {t.title}
                </button>
              ))}
            </nav>
            {tab === "holdings" ? (
              <TrackedBalances owner={address} />
            ) : (
              <EmptyState
                title={
                  tab === "created"
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
                {tab === "created"
                  ? "Token launches are not enabled yet. You can prepare a local draft."
                  : "Your wallet’s transactions are not indexed yet, so no history is shown. Market activity for tracked tokens (all traders) is on each token’s page."}
              </EmptyState>
            )}
          </section>
        </>
      )}
    </div>
  );
}
