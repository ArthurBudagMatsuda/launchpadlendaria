"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  GraduationCap,
  LayoutGrid,
  Plus,
  Radar,
  Rocket,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { parseAddress } from "@/lib/solana/address";
import { useSolanaWallet } from "@/components/wallet/solana-provider";
import { TRACKED_ASSETS } from "@/config/tracked-mints";
import { onchainTokenQuery, tokenMarketQuery } from "@/hooks/use-solana-market";
import { compareDecimal, parseDecimal } from "@/lib/market/decimal";
import {
  matchesSearch,
  sortRows,
  type TokenRow,
  type TokenSort,
} from "@/lib/market/solana-token-search";
import { TrackedTokenCard } from "@/components/tokens/token-card";
import { LaunchCard } from "@/components/launch/launch-card";
import {
  useMeteora,
  useRetryLaunches,
  type RetryLaunch,
} from "@/hooks/use-retry";
import { namingFlags } from "@/lib/meteora/naming";
import { discoverCategory, type DiscoverCategory } from "@/lib/meteora/pools";
import { POLICY_MESSAGES } from "@/config/retry-protocol";
import { EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { assetPath } from "@/lib/asset-path";
import { shorten } from "@/lib/format";
const categories = [
  {
    id: "new",
    title: "New on RETRY",
    subtitle: "Launched in the last 24 hours",
    icon: Sparkles,
    color: "lime",
  },
  {
    id: "active",
    title: "Active",
    subtitle: "Trading on the bonding curve",
    icon: Activity,
    color: "blue",
  },
  {
    id: "near-graduation",
    title: "Near graduation",
    subtitle: "80% of the curve or more",
    icon: Rocket,
    color: "blue",
  },
  {
    id: "graduated",
    title: "Graduated",
    subtitle: "Trading on Meteora DAMM v2",
    icon: GraduationCap,
    color: "purple",
  },
  {
    id: "tracked",
    title: "Tracked on Solana",
    subtitle: "External tokens with live markets",
    icon: Radar,
    color: "blue",
  },
] as const;
type LaunchSort = "newest" | "progress" | "fdv";
/** Cards per column before "Show more". */
const COLUMN_PAGE = 12;
function matchesLaunch(launch: RetryLaunch, term: string) {
  const query = term.trim().toLowerCase();
  if (!query) return true;
  return (
    launch.pool.baseMint === term.trim() ||
    Boolean(launch.metadata?.name.toLowerCase().includes(query)) ||
    Boolean(launch.metadata?.symbol.toLowerCase().includes(query))
  );
}
function sortLaunches(launches: RetryLaunch[], sort: LaunchSort) {
  return [...launches].sort((a, b) =>
    sort === "progress"
      ? b.pool.progressBps - a.pool.progressBps
      : sort === "fdv"
        ? Number(b.pool.fdvSol) - Number(a.pool.fdvSol)
        : Number(b.pool.activationPoint - a.pool.activationPoint),
  );
}
type Category = (typeof categories)[number]["id"];
const LIQUIDITY_STEPS = [0, 10_000, 50_000, 100_000, 500_000];

export function Discover({ initialSearch }: { initialSearch: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [stage, setStage] = useState<Category | "all">("all");
  const [sort, setSort] = useState<TokenSort>("liquidity");
  const [launchSort, setLaunchSort] = useState<LaunchSort>("newest");
  const { policy } = useMeteora("create");
  const launches = useRetryLaunches();
  const [pages, setPages] = useState<Partial<Record<Category, number>>>({});
  const visibleLaunches = sortLaunches(
    (launches.data ?? []).filter((launch) => matchesLaunch(launch, search)),
    launchSort,
  );
  // Columns are recomputed with each read of the pools (every 20 s).
  const now = Math.floor((launches.dataUpdatedAt || 0) / 1000);
  const naming = useMemo(
    () => namingFlags(launches.data ?? []),
    [launches.data],
  );
  const launchesIn = (column: DiscoverCategory) =>
    visibleLaunches.filter(
      (launch) => discoverCategory(launch.pool, now) === column,
    );
  const [filters, setFilters] = useState(false);
  const [minLiquidity, setMinLiquidity] = useState(0);
  const { config: client } = useSolanaWallet();
  const active = TRACKED_ASSETS.filter(
    (asset) => asset.status === "active" && asset.cluster === client?.cluster,
  );
  const onchain = useQueries({
    queries: active.map((asset) =>
      onchainTokenQuery(client, {
        cluster: asset.cluster,
        address: asset.address,
      }),
    ),
  });
  const markets = useQueries({
    queries: active.map((asset, index) =>
      tokenMarketQuery(
        { cluster: asset.cluster, address: asset.address },
        asset.primaryPool?.id,
        onchain[index]?.data?.verdict === "token",
      ),
    ),
  });
  const rows: TokenRow[] = active.map((asset, i) => ({
    asset,
    facts: onchain[i]?.data,
    market: markets[i]?.data,
  }));
  const minimum = parseDecimal(String(minLiquidity))!;
  const filtered = sortRows(
    rows.filter((row) => {
      if (!matchesSearch(row, search)) return false;
      if (!minLiquidity) return true;
      const liquidity = parseDecimal(
        row.market?.selection.primary?.liquidityUsd,
      );
      return liquidity !== null && compareDecimal(liquidity, minimum) >= 0;
    }),
    sort,
  );
  const term = search.trim();
  const lookup =
    parseAddress(term) && !active.some((a) => a.address === term) ? term : null;
  return (
    <div className="discover-page">
      <div className="page-topline">
        <span>
          <span className="live-dot" />
          THE NEXT WAVE IS ON SOLANA
        </span>
        <span className="data-label">
          <span />
          {policy?.enabled
            ? `Solana ${client?.cluster} · Live`
            : "Solana · Read-only"}
        </span>
      </div>
      <section className="discovery-hero">
        <div className="hero-art" aria-hidden="true">
          <Image
            className="hero-backdrop"
            src={assetPath("/brand/retry-hero-bg.webp")}
            alt=""
            fill
            sizes="(max-width: 760px) 720px, 1600px"
            preload
            unoptimized
          />
          <span className="hero-shadow" />
          <Image
            className="hero-logo"
            src={assetPath("/brand/retry-logo-3d.webp")}
            alt=""
            width={474}
            height={480}
            loading="eager"
            unoptimized
          />
        </div>
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="solana-mark" />A fresh start. Onchain.
          </div>
          <h1>
            Your next token
            <br />
            starts <span>here.</span>
          </h1>
          <p>Discover, launch and trade the next wave on Solana.</p>
          <Link href="/create" className="button button-primary">
            Create Token
            <Plus size={16} />
          </Link>
        </div>
      </section>
      <section className="featured-section">
        <div className="trending-heading">
          <Radar size={15} />
          <strong>No featured token yet</strong>
          <span>Discover tokens on Solana</span>
        </div>
      </section>
      <section className="board-section" aria-labelledby="discover-title">
        <div className="board-title-row">
          <div>
            <h2 id="discover-title">
              Discover<span className="heading-dot">.</span>
            </h2>
            <p>Find your next beginning.</p>
          </div>
          <span className="board-caption">
            <LayoutGrid size={14} />
            The launchpad, at a glance
          </span>
        </div>
        <div className="filter-bar">
          <div className="category-tabs" aria-label="Filter launch category">
            {[{ id: "all", title: "All tokens" }, ...categories].map((c) => (
              <button
                key={c.id}
                aria-pressed={stage === c.id}
                onClick={() => setStage(c.id as Category | "all")}
                className={stage === c.id ? "active" : ""}
              >
                {c.id === "all" ? <Star size={13} /> : null}
                {c.title}
              </button>
            ))}
          </div>
          <div className="filter-controls">
            <label className="search-input">
              <Search size={15} />
              <input
                aria-label="Search by name, ticker or mint address"
                placeholder="Search name, ticker or mint…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button aria-label="Clear search" onClick={() => setSearch("")}>
                  <X size={13} />
                </button>
              ) : null}
            </label>
            <label className="sort-select">
              <ArrowDownUp size={14} />
              {stage === "tracked" ? (
                <select
                  aria-label="Sort tokens"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as TokenSort)}
                >
                  <option value="liquidity">Liquidity</option>
                  <option value="volume">Volume 24h</option>
                </select>
              ) : (
                <select
                  aria-label="Sort launches"
                  value={launchSort}
                  onChange={(e) => setLaunchSort(e.target.value as LaunchSort)}
                >
                  <option value="newest">Newest</option>
                  <option value="progress">Curve progress</option>
                  <option value="fdv">FDV</option>
                </select>
              )}
              <ChevronDown size={12} />
            </label>
            <button
              className={`filter-button ${minLiquidity ? "active" : ""}`}
              onClick={() => setFilters(true)}
            >
              <SlidersHorizontal size={14} />
              Filters
              {minLiquidity ? <span className="filter-count">1</span> : null}
            </button>
          </div>
        </div>
        <div
          className={`launch-board ${stage !== "all" ? "single-category" : ""}`}
        >
          {categories
            .filter((c) => stage === "all" || c.id === stage)
            .filter(
              (c) =>
                c.id !== "tracked" || active.length > 0 || stage === "tracked",
            )
            .map((category) => (
              <section
                className={`launch-column ${category.color}`}
                key={category.id}
              >
                <div className="column-heading">
                  <span className="column-icon">
                    <category.icon size={17} />
                  </span>
                  <div>
                    <h3>
                      {category.title}
                      <span className="count-badge">
                        {category.id === "tracked"
                          ? filtered.length
                          : launchesIn(category.id).length}
                      </span>
                    </h3>
                    <p>{category.subtitle}</p>
                  </div>
                  <span className="column-dot" />
                </div>
                <div className="token-grid">
                  {category.id === "tracked" ? (
                    <>
                      {filtered.map((row) => (
                        <TrackedTokenCard
                          key={row.asset.slug}
                          asset={row.asset}
                        />
                      ))}
                      {lookup ? (
                        <Link
                          href={`/token/?cluster=${client?.cluster}&mint=${lookup}`}
                          className="token-card lookup-card"
                        >
                          <strong>Not tracked on RETRY</strong>
                          <span>
                            Inspect {shorten(lookup)} on Solana: mint
                            verification and public market data.
                          </span>
                          <span className="lookup-cta">
                            Inspect address
                            <ArrowUpRight size={13} />
                          </span>
                        </Link>
                      ) : null}
                      {!filtered.length && !lookup ? (
                        <EmptyState title="No tokens found">
                          Try another name, ticker or mint address, or lower the
                          liquidity filter.
                        </EmptyState>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {category.id === "new" && lookup && !active.length ? (
                        <Link
                          href={`/token/?cluster=${client?.cluster}&mint=${lookup}`}
                          className="token-card lookup-card"
                        >
                          <strong>Look up this mint</strong>
                          <span>
                            Open {shorten(lookup)}: a RETRY launch shows its
                            curve; any other mint shows a read-only lookup.
                          </span>
                          <span className="lookup-cta">
                            Inspect address
                            <ArrowUpRight size={13} />
                          </span>
                        </Link>
                      ) : null}
                      {launchesIn(category.id)
                        .slice(0, pages[category.id] ?? COLUMN_PAGE)
                        .map((launch) => (
                          <LaunchCard
                            key={launch.pool.address}
                            launch={launch}
                            naming={naming.get(launch.pool.address)}
                          />
                        ))}
                      {launchesIn(category.id).length >
                      (pages[category.id] ?? COLUMN_PAGE) ? (
                        <button
                          className="button button-secondary"
                          onClick={() =>
                            setPages({
                              ...pages,
                              [category.id]:
                                (pages[category.id] ?? COLUMN_PAGE) +
                                COLUMN_PAGE,
                            })
                          }
                        >
                          Show more (
                          {launchesIn(category.id).length -
                            (pages[category.id] ?? COLUMN_PAGE)}
                          )
                        </button>
                      ) : null}
                      {launches.isPending && launches.fetchStatus !== "idle" ? (
                        <div className="skeleton" />
                      ) : !launchesIn(category.id).length ? (
                        <EmptyState
                          title={
                            launches.isError
                              ? "Launches unavailable"
                              : category.id === "new"
                                ? "Nothing launched today"
                                : category.id === "active"
                                  ? "No older launches on the curve"
                                  : category.id === "near-graduation"
                                    ? "Nothing close to graduating"
                                    : "Nothing has graduated yet"
                          }
                        >
                          {launches.isError
                            ? "Solana RPC did not answer. Nothing is shown rather than guessed."
                            : policy && !policy.enabled
                              ? POLICY_MESSAGES[policy.reason]
                              : category.id === "new"
                                ? "Tokens launched in the last 24 hours appear here."
                                : category.id === "active"
                                  ? "Launches older than a day that are still on their curve appear here."
                                  : category.id === "near-graduation"
                                    ? "Tokens at 80% of the graduation threshold or more, or waiting for their migration, appear here."
                                    : "Tokens that complete their curve and move to Meteora DAMM v2 appear here."}
                        </EmptyState>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="column-end">
                  <span />
                  You’re all caught up
                  <Check size={12} />
                  <span />
                </div>
              </section>
            ))}
        </div>
        <div className="board-bottom">
          <span>
            <span className="live-dot" />
            {launches.data?.length ?? 0} RETRY launch
            {launches.data?.length === 1 ? "" : "es"} on{" "}
            {client?.cluster ?? "Solana"} · read from the Meteora DBC program
          </span>
          <Link href="/create">
            Got an idea? Bring it to life
            <ArrowRight size={13} />
          </Link>
        </div>
      </section>
      <div className="discover-callout">
        <span className="callout-icon">
          <Sparkles size={20} />
        </span>
        <div>
          <strong>Big ideas start with a small retry.</strong>
          <p>Your community. Your token. A new beginning.</p>
        </div>
        <Link href="/create">
          Start creating
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <Modal
        open={filters}
        onOpenChange={setFilters}
        title="Refine your discovery"
        description="Filter tracked tokens by their primary pool's liquidity."
      >
        <label className="field-label" htmlFor="liquidity-filter">
          Minimum liquidity{" "}
          <span>
            {minLiquidity ? `$${minLiquidity.toLocaleString("en-US")}` : "Any"}
          </span>
        </label>
        <input
          className="range-input"
          id="liquidity-filter"
          type="range"
          min="0"
          max={LIQUIDITY_STEPS.length - 1}
          step="1"
          value={LIQUIDITY_STEPS.indexOf(minLiquidity)}
          onChange={(e) =>
            setMinLiquidity(LIQUIDITY_STEPS[Number(e.target.value)] ?? 0)
          }
        />
        <p className="tiny muted">
          Provider-reported liquidity of each token’s primary pool. Tokens
          without a reported value are hidden while a minimum is set.
        </p>
        <div className="two-buttons">
          <button
            className="button button-secondary"
            onClick={() => setMinLiquidity(0)}
          >
            Reset filters
          </button>
          <button
            className="button button-primary"
            onClick={() => setFilters(false)}
          >
            Show results
            <ArrowRight size={15} />
          </button>
        </div>
      </Modal>
    </div>
  );
}
