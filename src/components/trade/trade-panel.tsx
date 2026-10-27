"use client";
import { useState } from "react";
import { LockKeyhole, Settings2 } from "lucide-react";
import { useRetryBalance } from "@retry/web3";
import type { Token } from "@/types/token";
import { number } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
export function TradePanel({ token }: { token: Token }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const { notify } = useApp();
  const balance = useRetryBalance();
  const quantity = Number(amount);
  const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= 1e12;
  // This is a UI fixture ratio, unrelated to token prices, reserves or any live quote.
  const estimate = valid
    ? side === "buy"
      ? `${number(quantity * 250000)} ${token.metadata.symbol}`
      : `${(quantity / 250000).toFixed(6)} ETH`
    : "—";
  return (
    <section className="panel trade-panel" aria-label="Trade preview">
      <h2>Trade {token.metadata.symbol}</h2>
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
              ? "Token balance: not indexed"
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
          <span>{side === "buy" ? "ETH" : token.metadata.symbol}</span>
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
          <span>Illustrative output</span>
          <strong>{estimate}</strong>
        </div>
        <div>
          <span>Platform fee</span>
          <strong>To be defined</strong>
        </div>
        <div>
          <span>Network fee</span>
          <strong>Not estimated</strong>
        </div>
        <div>
          <span>Execution</span>
          <strong>Preview only</strong>
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
        Demo ratio: 1 ETH = 250K tokens.
        <br />
        Illustration only. No executable quote or transaction.
      </p>
    </section>
  );
}
