"use client";
import { useState } from "react";
import { useConnection } from "wagmi";
import { formatEther } from "viem";
import {
  ArrowUpRight,
  Copy,
  Layers,
  LockKeyhole,
  Radio,
  Wallet,
} from "lucide-react";
import { useApp } from "@/components/providers";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { useMounted } from "@/hooks/use-mounted";
import { isSupportedChain } from "@/config/networks";
import { WalletButton } from "@/components/wallet/wallet-button";
import { EmptyState } from "@/components/ui/feedback";
import { shorten } from "@/lib/format";
import Link from "next/link";
export function Portfolio() {
  const { address, isConnected, chain, chainId } = useConnection();
  const balance = useWalletBalance();
  const { setWalletOpen, notify } = useApp();
  const mounted = useMounted();
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
      {!mounted || !isConnected || !address ? (
        <section className="panel portfolio-connect">
          <div className="portfolio-art">
            <Wallet size={41} />
          </div>
          <span className="eyebrow">IT STARTS WITH YOUR WALLET</span>
          <h2>A home for your next chapter.</h2>
          <p>
            Connect your wallet to see your Base network and ETH balance. Token
            positions and activity will arrive in a future stage.
          </p>
          <WalletButton />
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
            </section>
            <section className="panel">
              <h2>Connected network</h2>
              <strong>{chain?.name ?? "Unsupported network"}</strong>
              <button
                className="reference-button"
                onClick={() => setWalletOpen(true)}
              >
                Change network
                <ArrowUpRight size={12} />
              </button>
              <p className="mt-3">Chain ID: {chainId}</p>
            </section>
            <section className="panel">
              <h2>Native ETH balance · Live RPC</h2>
              <strong>
                {!isSupportedChain(chainId)
                  ? "Unsupported network"
                  : balance.isPending
                    ? "Loading…"
                    : balance.isError
                      ? "Unavailable"
                      : balance.data
                        ? `${Number(formatEther(balance.data.value)).toFixed(5)} ETH`
                        : "Unavailable"}
              </strong>
              <p>
                {balance.isError
                  ? "RPC request failed. No estimated balance is shown."
                  : "Read from your wallet’s connected Base network."}
              </p>
              {balance.isError ? (
                <button
                  className="reference-button mt-3"
                  onClick={() => balance.refetch()}
                >
                  Retry balance
                </button>
              ) : null}
            </section>
          </div>
          {!isSupportedChain(chainId) ? (
            <div className="notice-strip mb-5">
              Switch to Base Sepolia or Base in the wallet menu to read your
              native ETH balance.
            </div>
          ) : null}
          <section className="panel">
            <nav className="portfolio-tabs" aria-label="Portfolio sections">
              {[
                { id: "holdings", title: "Tokens acquired" },
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
            <EmptyState
              title={
                tab === "holdings"
                  ? "Your next discovery awaits."
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
                ? "Token balances are not indexed in this preview. This is not a statement of your actual holdings."
                : tab === "created"
                  ? "Token launches are not enabled yet. You can prepare a local draft."
                  : "Onchain activity is not indexed yet. No transaction history is available in this preview."}
            </EmptyState>
          </section>
        </>
      )}
    </div>
  );
}
