"use client";
import { useState } from "react";
import { LockKeyhole, Settings2 } from "lucide-react";
import {
  useSolBalance,
  useSolanaWallet,
} from "@/components/wallet/solana-provider";
import type { TokenRef } from "@/lib/market/types";
import { Button } from "@/components/ui/button";
import { WalletStatus } from "@/components/wallet/solana-status";

// View-only. Market data on the page is real, but RETRY has no verified swap
// route yet, so this panel shows no quote, builds no transaction and never
// asks the wallet for an approval or signature.
export function TradePanel({
  symbol,
}: {
  symbol: string;
  token?: TokenRef;
  decimals?: number | null;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const balance = useSolBalance();
  const wallet = useSolanaWallet();
  const owner = wallet.status === "connected" ? wallet.address : undefined;
  const quantity = Number(amount);
  const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= 1e12;
  const sellBalance = owner
    ? "SPL token accounts: not indexed"
    : "Wallet not connected";
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
              : balance.available
                ? `Balance: ${balance.display}`
                : balance.isFetching
                  ? "Reading balance…"
                  : !owner
                    ? "Wallet not connected"
                    : !wallet.config
                      ? "Configuration unavailable"
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
          <span>{side === "buy" ? "SOL" : symbol}</span>
        </div>
        {amount && !valid ? (
          <p className="form-error">
            Enter a positive amount up to 1 trillion.
          </p>
        ) : null}
      </div>
      <label className="slippage-control">
        <span className="inline-flex items-center gap-1.5">
          <Settings2 size={12} />
          Slippage tolerance
        </span>
        <select aria-label="Slippage tolerance" disabled value="pending">
          <option value="pending">Pending execution design</option>
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
      <Button disabled>
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
