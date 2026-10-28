"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { ArrowUpRight, Calculator, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletStatus } from "@/components/wallet/solana-status";
import { tokenHref } from "@/config/tracked-mints";
import {
  previewCost,
  useExecute,
  useMeteora,
  useOperations,
  userMessage,
} from "@/hooks/use-retry";
import {
  launchRequestId,
  MAX_INITIAL_BUY_LAMPORTS,
  prepareCreateToken,
  type PreparedCreate,
} from "@/lib/meteora/create-token";
import { curveSummary, RETRY_LAUNCH } from "@/lib/meteora/curve";
import { feeSchedule } from "@/lib/meteora/fees";
import { parseSol, sol, tokens } from "@/lib/meteora/format";
import {
  metadataEndpoint,
  uploadMetadata,
} from "@/lib/meteora/metadata-upload";
import { pendingCreate } from "@/lib/meteora/operations";
import { DEFAULT_SLIPPAGE_BPS } from "@/lib/meteora/quotes";
import type { SimulationPreview } from "@/lib/meteora/transactions";
import type { SolanaAddress } from "@/lib/solana/address";
import type { TokenDraft } from "@/lib/validation";
import { OperationState, PolicyNotice } from "./launch-ui";

/** A prepared launch is rebuilt after this long (its blockhash ages out). */
const PREPARED_TTL_MS = 45_000;

interface Review {
  key: string;
  prepared: PreparedCreate;
  preview: SimulationPreview;
  requestId: string;
  initialBuy: bigint;
  at: number;
}

/**
 * The real launch: upload the metadata, build the DBC pool (and optional
 * first buy) from the RETRY config, simulate it to show the exact cost,
 * then ask the wallet to sign. Nothing is signed before the user confirms
 * the simulated cost, and a launch already sent cannot be sent again.
 */
export function LaunchPanel({ draft }: { draft: TokenDraft }) {
  const { wallet, context, policy } = useMeteora();
  const { operations, store } = useOperations();
  const { state, run, reset, canSign } = useExecute();
  const [initialBuy, setInitialBuy] = useState("0");
  const [stored, setReview] = useState<Review | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploaded = useRef<{ key: string; uri: string } | null>(null);
  const endpoint = metadataEndpoint();
  const owner = wallet.status === "connected" ? wallet.address : undefined;
  const buyLamports = parseSol(initialBuy || "0");
  const buyValid =
    buyLamports != null && buyLamports <= MAX_INITIAL_BUY_LAMPORTS;
  const curve = curveSummary();
  const fees = feeSchedule();
  const pending =
    owner && store && context
      ? pendingCreate(store, context.cluster, owner)
      : undefined;
  // A review belongs to the exact inputs it was built from; any edit drops it.
  const inputsKey = JSON.stringify([
    draft,
    initialBuy,
    owner,
    context?.cluster,
  ]);
  const review = stored?.key === inputsKey ? stored : null;
  const launched = review
    ? operations.find(
        (op) => op.requestId === review.requestId && op.status === "confirmed",
      )
    : undefined;
  const blocked = !policy?.enabled
    ? "policy"
    : !owner
      ? "wallet"
      : !canSign
        ? "signing"
        : !endpoint
          ? "metadata"
          : pending
            ? "pending"
            : null;
  async function prepare() {
    if (!context || !owner || !buyValid) return;
    setWorking(true);
    setError(null);
    reset();
    try {
      const key = JSON.stringify(draft);
      if (uploaded.current?.key !== key)
        uploaded.current = { key, uri: (await uploadMetadata(draft)).uri };
      const uri = uploaded.current.uri;
      const requestId = await launchRequestId({
        owner,
        name: draft.name,
        symbol: draft.symbol,
        uri,
      });
      const previous = operations.find(
        (op) =>
          op.requestId === requestId &&
          (op.status === "sent" || op.status === "confirmed"),
      );
      if (previous) {
        setError(
          previous.status === "confirmed"
            ? "This exact token was already launched from this wallet."
            : "This launch was already sent and is waiting for the network.",
        );
        return;
      }
      const creator = new PublicKey(owner);
      const prepared = await prepareCreateToken(context, {
        name: draft.name,
        symbol: draft.symbol,
        uri,
        creator,
        initialBuyLamports: buyLamports!,
        slippageBps: DEFAULT_SLIPPAGE_BPS,
      });
      const preview = await previewCost(context, prepared.tx, creator);
      if (preview.error)
        throw new Error(
          preview.logs.find((line) => /Error/.test(line)) ?? preview.error,
        );
      setReview({
        key: inputsKey,
        prepared,
        preview,
        requestId,
        initialBuy: buyLamports!,
        at: Date.now(),
      });
    } catch (cause) {
      console.error("RETRY launch preparation failed", cause);
      setError(userMessage(cause));
    } finally {
      setWorking(false);
    }
  }
  async function launch() {
    if (!review) return;
    if (Date.now() - review.at > PREPARED_TTL_MS) {
      setReview(null);
      setError("The cost preview expired. Review it again before signing.");
      return;
    }
    const { prepared } = review;
    setError(null);
    await run({
      kind: "create",
      tx: prepared.tx,
      expect: prepared.expect,
      extraSigners: [prepared.mint],
      pool: prepared.pool.toBase58(),
      mint: prepared.mint.publicKey.toBase58(),
      summary: `Launch ${draft.symbol}`,
      requestId: review.requestId,
    });
  }
  const spent = review ? -review.preview.balanceChange : 0n;
  const otherCosts = review ? spent - review.initialBuy : 0n;
  const mint = review?.prepared.mint.publicKey.toBase58();
  return (
    <div className="launch-panel">
      <dl className="summary-list">
        {[
          ["Token", `${draft.name} (${draft.symbol})`],
          [
            "Network",
            context
              ? context.cluster === "devnet"
                ? "Solana Devnet"
                : "Solana Mainnet"
              : "—",
          ],
          ["Total supply", "1,000,000,000 · fixed, 9 decimals"],
          ["Mint & freeze authority", "None: revoked by the program at launch"],
          [
            "Creator allocation",
            "None. Your first buy below is the only way to start with tokens",
          ],
          [
            "Bonding curve",
            `Meteora DBC · start ~${curve.startFdvSol} SOL FDV`,
          ],
          [
            "Graduation",
            `At ${RETRY_LAUNCH.migrationQuoteThresholdSol} SOL in the curve → Meteora DAMM v2 (~${curve.graduationFdvSol} SOL FDV)`,
          ],
          [
            "Graduated liquidity",
            "100% permanently locked (50% creator · 50% RETRY)",
          ],
          [
            "Trading fee",
            `${fees.tradingPct}% · ${fees.protocolPct}% Meteora · ${fees.creatorPct}% you · ${fees.partnerPct}% RETRY`,
          ],
          ["RETRY launch fee", "None"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="form-field mt-5">
        <label className="field-label" htmlFor="initial-buy">
          Optional first buy<span>0–1 SOL · same transaction</span>
        </label>
        <div className="amount-box">
          <input
            id="initial-buy"
            inputMode="decimal"
            autoComplete="off"
            value={initialBuy}
            onChange={(e) => setInitialBuy(e.target.value.replace(",", "."))}
            aria-invalid={!buyValid}
          />
          <span>SOL</span>
        </div>
        {!buyValid ? <p className="form-error">Enter 0 to 1 SOL.</p> : null}
        <p className="form-help">
          Buying in the launch transaction means no one can buy before you. It
          uses the same curve and fee as everyone else, with 1% slippage
          protection.
        </p>
      </div>
      <WalletStatus disconnectedText="Connect a Solana wallet set to Devnet to launch with free test SOL." />
      <PolicyNotice policy={policy} />
      {blocked === "signing" ? (
        <p className="notice-strip">
          This wallet does not offer transaction signing to web apps.
        </p>
      ) : blocked === "metadata" ? (
        <p className="notice-strip">
          Launching needs RETRY&apos;s metadata host, so your name, image and
          links stay online for good. It is not configured in this build yet.
        </p>
      ) : blocked === "pending" && pending ? (
        <p className="notice-strip">
          Your previous launch is still waiting for the network. It settles on
          its own; reload in a minute.
        </p>
      ) : null}
      {review ? (
        <div className="cost-review" aria-live="polite">
          <h3>
            <Calculator size={14} /> Simulated cost
          </h3>
          <dl className="detail-list">
            <div>
              <dt>First buy</dt>
              <dd>
                {sol(review.initialBuy)}
                {review.prepared.initialBuyOut != null
                  ? ` → ~${tokens(review.prepared.initialBuyOut)} ${draft.symbol} (min ${tokens(review.prepared.initialBuyMinimumOut!)})`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Accounts rent & program fees</dt>
              <dd>{sol(otherCosts, 6)}</dd>
            </div>
            <div>
              <dt>Network fee</dt>
              <dd>{sol(review.preview.networkFee, 6)}</dd>
            </div>
            <div className="total">
              <dt>Total leaving your wallet</dt>
              <dd>{sol(spent + review.preview.networkFee, 6)}</dd>
            </div>
          </dl>
          <p className="tiny">
            From a simulation of this exact transaction at the current slot. The
            mint address will be <code>{mint}</code>.
          </p>
        </div>
      ) : null}
      {error ? (
        <p className="operation-state error" role="alert">
          {error}
        </p>
      ) : null}
      <OperationState
        state={state}
        cluster={context?.cluster ?? "devnet"}
        success="Launched."
      />
      {launched && mint ? (
        <Link
          className="button button-primary mt-4"
          href={tokenHref({
            cluster: launched.cluster,
            address: mint as SolanaAddress,
          })}
        >
          Open your token
          <ArrowUpRight size={14} />
        </Link>
      ) : (
        <div className="launch-actions">
          <Button
            type="button"
            variant={review ? "secondary" : "primary"}
            disabled={
              Boolean(blocked) ||
              !buyValid ||
              working ||
              state.phase === "running"
            }
            onClick={prepare}
          >
            <Calculator size={14} />
            {working
              ? "Preparing…"
              : review
                ? "Refresh cost"
                : "Review launch cost"}
          </Button>
          <Button
            type="button"
            disabled={
              !review ||
              Boolean(blocked) ||
              state.phase === "running" ||
              state.phase === "done"
            }
            onClick={launch}
          >
            <Rocket size={14} />
            Sign & launch
          </Button>
        </div>
      )}
    </div>
  );
}
