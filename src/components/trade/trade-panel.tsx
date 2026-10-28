"use client";
import { useState } from "react";
import { LockKeyhole, Settings2 } from "lucide-react";
import { useRetryBalance, useRetryWallet } from "@retry/web3";
import { useTokenBalance } from "@/hooks/use-market";
import { tokenAmount as rawToAmount } from "@/lib/market/metrics";
import type { TokenRef } from "@/lib/market/types";
import { number, tokenAmount } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { WalletStatus } from "@/components/wallet/wallet-status";

// View-only. Market data on the page is real, but RETRY has no verified swap
// route yet, so this panel shows no quote, builds no transaction and never
// asks the wallet for an approval or signature.
export function TradePanel({
  symbol,
  token,
  decimals = null,
}: {
  symbol: string;
  token?: TokenRef;
  decimals?: number | null;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const { notify } = useApp();
  const balance = useRetryBalance();
  const wallet = useRetryWallet();
  const owner = wallet.isConnected ? wallet.address : undefined;
  const tokenBalance = useTokenBalance(token, owner);
  const quantity = Number(amount);
  const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= 1e12;
  const sellBalance = !token
    ? "Token balance: not indexed"
    : !owner
      ? "Wallet not connected"
      : tokenBalance.isPending
        ? "Reading balance…"
        : tokenBalance.isError ||
            decimals === null ||
            tokenBalance.data === undefined
          ? "Balance unavailable"
          : `Balance: ${tokenAmount(rawToAmount(tokenBalance.data, decimals))} ${symbol}`;
  return (
    <section className="panel trade-panel" aria-label="Trade preview">
      <h2>Trade {symbol}</h2>
      <WalletStatus disconnectedText="Connect a wallet to see your balances here. Trading is not enabled yet." />
      <div className="segmented" aria-label="Trade direction">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            aria-pressed={side === s}
            className={side === s ? `active ${s}` : ""}
            onClick={() => {
              setSide(s);
              setAmount("");
            }}
          >
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>
      <div className="trade-amount">
        <label className="field-label" htmlFor="trade-amount">
          You {side === "buy" ? "pay" : "sell"}
          <span>
            {side === "sell"
              ? sellBalance
              : balance.status === "success"
                ? `Balance: ${balance.display}`
                : balance.status === "loading"
                  ? "Reading balance…"
                  : balance.status === "disconnected"
                    ? "Wallet not connected"
                    : balance.status === "wrong-network"
                      ? "Wrong network"
                      : "Balance unavailable"}
          </span>
        </label>
        <div className="amount-box">
          <input
            id="trade-amount"
            type="number"
            min="0"
            max="1000000000000"
            step="any"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={amount !== "" && !valid}
          />
          <span>{side === "buy" ? "ETH" : symbol}</span>
        </div>
        {amount && !valid ? (
          <p className="form-error">
            Enter a positive amount up to 1 trillion.
          </p>
        ) : null}
      </div>
      <div className="quick-amounts">
        {(side === "buy"
          ? [0.01, 0.05, 0.1, 0.5]
          : [1000, 10000, 50000, 100000]
        ).map((v) => (
          <button
            className={quantity === v ? "active" : ""}
            key={v}
            onClick={() => setAmount(String(v))}
          >
            {side === "buy" ? v : number(v)}
          </button>
        ))}
      </div>
      <label className="slippage-control">
        <span className="inline-flex items-center gap-1.5">
          <Settings2 size={12} />
          Slippage tolerance
        </span>
        <select
          aria-label="Slippage tolerance"
          value={slippage}
          onChange={(e) => setSlippage(e.target.value)}
        >
          <option value="0.5">0.5%</option>
          <option value="1">1%</option>
          <option value="3">3%</option>
          <option value="5">5%</option>
        </select>
      </label>
      <div className="trade-summary">
        <div>
          <span>Quote</span>
          <strong>Not available</strong>
        </div>
        <div>
          <span>Route</span>
          <strong>None verified</strong>
        </div>
        <div>
          <span>Network fee</span>
          <strong>Not estimated</strong>
        </div>
        <div>
          <span>Execution</span>
          <strong>Disabled</strong>
        </div>
      </div>
      <Button
        onClick={() =>
          notify(
            "Trading is coming in a future stage. This preview cannot send transactions.",
          )
        }
      >
        <LockKeyhole size={14} />
        Trading Coming Soon
      </Button>
      <p className="tiny">
        View only. Prices on this page come from public market data; RETRY does
        not quote, route or execute trades yet.
      </p>
    </section>
  );
}
