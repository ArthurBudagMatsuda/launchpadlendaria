"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import type { PoolConfig, VirtualPool } from "@/lib/meteora/sdk";
import { Settings2, Zap } from "lucide-react";
import { useSolBalance } from "@/components/wallet/solana-provider";
import { WalletStatus } from "@/components/wallet/solana-status";
import { Button } from "@/components/ui/button";
import { useExecute, useMeteora, userMessage } from "@/hooks/use-retry";
import { splitTradingFee } from "@/lib/meteora/fees";
import {
  parseSol,
  parseTokens,
  sol,
  tokenInput,
  tokens,
} from "@/lib/meteora/format";
import type { RetryPool } from "@/lib/meteora/pools";
import {
  currentPoint,
  DEFAULT_SLIPPAGE_BPS,
  isQuoteFresh,
  quoteTrade,
  type TradeQuote,
  type TradeSide,
} from "@/lib/meteora/quotes";
import {
  prepareTrade,
  tokenBalance,
  wrappedSolBalance,
} from "@/lib/meteora/trade";
import { OperationState, PolicyNotice } from "./launch-ui";

const SLIPPAGE_OPTIONS = [50, 100, 200, 500, 1000];
/** Lamports kept back on a max buy for fees and token account rent. */
const BUY_RESERVE = 10_000_000n;

/**
 * Buy and sell a RETRY token on its bonding curve. The quote is computed
 * from the pool account read at a known slot, rebuilt right before signing,
 * and the transaction carries its minimum output, so the program refuses
 * any fill worse than the slippage the user chose.
 */
export function RetryTradePanel({
  pool,
  raw,
  config,
  symbol,
}: {
  pool: RetryPool;
  raw: VirtualPool;
  config: PoolConfig;
  symbol: string;
}) {
  const { wallet, context, policy } = useMeteora();
  const balance = useSolBalance();
  const [side, setSide] = useState<TradeSide>("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const { state, run, reset, canSign } = useExecute();
  const [prepareError, alertError] = useState<string | null>(null);
  const owner = wallet.status === "connected" ? wallet.address : undefined;
  const mint = useMemo(() => new PublicKey(pool.baseMint), [pool.baseMint]);
  const holdings = useQuery({
    queryKey: ["retry", "holding", pool.cluster, owner, pool.baseMint],
    enabled: Boolean(context && owner),
    refetchInterval: 15_000,
    queryFn: async () => {
      const key = new PublicKey(owner!);
      const [held, wrapped] = await Promise.all([
        tokenBalance(context!, key, mint),
        wrappedSolBalance(context!, key),
      ]);
      return { held, wrapped };
    },
  });
  const amountIn = side === "buy" ? parseSol(amount) : parseTokens(amount);
  const tradable =
    !pool.isMigrated &&
    pool.status !== "graduation-ready" &&
    pool.status !== "migrating";
  const quote = useQuery({
    queryKey: [
      "retry",
      "quote",
      pool.address,
      pool.slot,
      side,
      amountIn?.toString(),
      slippageBps,
    ],
    enabled: Boolean(context && amountIn && amountIn > 0n && tradable),
    refetchInterval: 10_000,
    retry: false,
    queryFn: async (): Promise<TradeQuote> =>
      quoteTrade({
        side,
        pool: { address: pool.address, raw, config, slot: pool.slot },
        amountIn: amountIn!,
        slippageBps,
        currentPoint: await currentPoint(context!, config),
        context: context!,
      }),
  });
  const q = quote.data;
  const lamports = balance.data?.lamports ?? null;
  const insufficient =
    amountIn != null &&
    (side === "buy"
      ? lamports != null && amountIn + BUY_RESERVE > lamports
      : holdings.data != null && amountIn > holdings.data.held);
  const running = state.phase === "running";
  const disabled =
    !policy?.enabled ||
    !canSign ||
    !q ||
    !isQuoteFresh(q) ||
    insufficient ||
    running ||
    !tradable;
  async function submit() {
    if (!context || !q || !owner) return;
    reset();
    try {
      const prepared = await prepareTrade(context, {
        owner: new PublicKey(owner),
        pool: new PublicKey(pool.address),
        side: q.side,
        amountIn: q.amountIn,
        slippageBps: q.slippageBps,
        reviewed: q,
      });
      const result = await run({
        kind: q.side,
        tx: prepared.tx,
        expect: prepared.expect,
        pool: pool.address,
        mint: pool.baseMint,
        summary:
          q.side === "buy"
            ? `Buy ${symbol} with ${sol(q.amountInUsed)}`
            : `Sell ${tokens(q.amountIn)} ${symbol}`,
      });
      if (result) setAmount("");
    } catch (cause) {
      quote.refetch();
      alertError(userMessage(cause));
    }
  }
  const fee = q ? splitTradingFee(q.fee) : null;
  return (
    <section className="panel trade-panel" aria-label={`Trade ${symbol}`}>
      <h2>Trade {symbol}</h2>
      <WalletStatus disconnectedText="Connect a Solana wallet to trade this token on Devnet." />
      <PolicyNotice policy={policy} />
      {owner && !canSign ? (
        <p className="notice-strip">
          This wallet does not offer transaction signing to web apps.
        </p>
      ) : null}
      {!tradable ? (
        <p className="notice-strip">
          {pool.isMigrated
            ? "This token graduated. It now trades on Meteora DAMM v2, outside RETRY."
            : "The curve is complete. Trading resumes on DAMM v2 after graduation."}
        </p>
      ) : null}
      <div className="segmented" aria-label="Trade direction">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            aria-pressed={side === s}
            className={side === s ? `active ${s}` : ""}
            onClick={() => {
              setSide(s);
              setAmount("");
              reset();
              alertError(null);
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
            {side === "buy"
              ? balance.display
                ? `Balance: ${balance.display}`
                : owner
                  ? "Reading balance…"
                  : "Wallet not connected"
              : holdings.data
                ? `Holding: ${tokens(holdings.data.held)} ${symbol}`
                : owner
                  ? "Reading balance…"
                  : "Wallet not connected"}
          </span>
        </label>
        <div className="amount-box">
          <input
            id="trade-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(",", "."));
              reset();
              alertError(null);
            }}
            aria-invalid={amount !== "" && !amountIn}
          />
          <span>{side === "buy" ? "SOL" : symbol}</span>
        </div>
        <div className="amount-shortcuts">
          {side === "buy"
            ? ["0.1", "0.5", "1"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(value)}
                >
                  {value} SOL
                </button>
              ))
            : [25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  disabled={!holdings.data?.held}
                  onClick={() =>
                    holdings.data &&
                    setAmount(
                      tokenInput((holdings.data.held * BigInt(pct)) / 100n),
                    )
                  }
                >
                  {pct}%
                </button>
              ))}
        </div>
        {amount && !amountIn ? (
          <p className="form-error">Enter a plain amount, like 0.5.</p>
        ) : null}
        {insufficient ? (
          <p className="form-error">
            {side === "buy"
              ? "Not enough SOL for this amount plus fees and account rent."
              : "You do not hold that many tokens."}
          </p>
        ) : null}
      </div>
      <label className="slippage-control">
        <span className="inline-flex items-center gap-1.5">
          <Settings2 size={12} />
          Slippage tolerance
        </span>
        <select
          aria-label="Slippage tolerance"
          value={slippageBps}
          onChange={(e) => setSlippageBps(Number(e.target.value))}
        >
          {SLIPPAGE_OPTIONS.map((bps) => (
            <option key={bps} value={bps}>
              {bps / 100}%
            </option>
          ))}
        </select>
      </label>
      <div className="trade-summary">
        <div>
          <span>You receive (expected)</span>
          <strong>
            {q
              ? side === "buy"
                ? `${tokens(q.amountOut)} ${symbol}`
                : sol(q.amountOut)
              : "—"}
          </strong>
        </div>
        <div>
          <span>Minimum after slippage</span>
          <strong>
            {q
              ? side === "buy"
                ? `${tokens(q.minimumAmountOut)} ${symbol}`
                : sol(q.minimumAmountOut)
              : "—"}
          </strong>
        </div>
        <div>
          <span>Price impact</span>
          <strong
            className={
              q && Number(q.priceImpactPct) > 5 ? "negative" : undefined
            }
          >
            {q ? `${q.priceImpactPct}%` : "—"}
          </strong>
        </div>
        <div>
          <span>Trading fee (1%)</span>
          <strong
            title={
              fee
                ? `Meteora ${sol(fee.protocol, 6)} · creator ${sol(fee.creator, 6)} · RETRY ${sol(fee.partner, 6)}`
                : undefined
            }
          >
            {q ? sol(q.fee, 6) : "—"}
          </strong>
        </div>
        {q?.amountLeft ? (
          <div>
            <span>Not used (curve completes)</span>
            <strong>{sol(q.amountLeft)}</strong>
          </div>
        ) : null}
        <div>
          <span>Network fee</span>
          <strong>
            ~0.000005 SOL{side === "buy" ? " + token account rent if new" : ""}
          </strong>
        </div>
      </div>
      {quote.isError ? (
        <p className="form-error">{userMessage(quote.error)}</p>
      ) : null}
      {q?.completesCurve ? (
        <p className="notice-strip">
          This buy completes the curve. The token then waits for graduation.
        </p>
      ) : null}
      {side === "buy" && holdings.data?.wrapped ? (
        <p className="tiny">
          Your wallet holds {sol(holdings.data.wrapped)} as wrapped SOL. Trading
          here unwraps it back to SOL.
        </p>
      ) : null}
      <Button disabled={disabled} onClick={submit}>
        <Zap size={14} />
        {running
          ? "Working…"
          : side === "buy"
            ? `Buy ${symbol}`
            : `Sell ${symbol}`}
      </Button>
      {prepareError ? (
        <p className="operation-state error" role="alert">
          {prepareError}
        </p>
      ) : null}
      <OperationState
        state={state}
        cluster={pool.cluster}
        success={
          side === "buy"
            ? "Bought. Balances refresh in a moment."
            : "Sold. Balances refresh in a moment."
        }
      />
      <p className="tiny">
        Quotes come from the pool account at slot{" "}
        {pool.slot.toLocaleString("en-US")} and refresh every 10 s. The
        transaction is simulated before your wallet opens, and the program
        rejects a fill below the minimum. This limits slippage; it does not
        prevent every form of MEV.
      </p>
    </section>
  );
}
