"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  GraduationCap,
  LayoutGrid,
  Plus,
  Radar,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { isAddress } from "viem";
import { usePublicClient } from "wagmi";
import { FEATURED_ASSET, TRACKED_ASSETS } from "@/config/featured-assets";
import { onchainTokenQuery, tokenMarketQuery } from "@/hooks/use-market";
import { compareDecimal, parseDecimal } from "@/lib/market/decimal";
import { MARKET_CHAIN_ID } from "@/lib/market/networks";
import {
  matchesSearch,
  sortRows,
  type TokenRow,
  type TokenSort,
} from "@/lib/market/token-search";
import { TrackedTokenCard } from "@/components/tokens/token-card";
import { FeaturedToken } from "@/components/market/featured-token";
import { EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { assetPath } from "@/lib/asset-path";
import { shorten } from "@/lib/format";
const categories = [
  {
    id: "tracked",
    title: "Tracked on Base",
    subtitle: "External tokens with live markets",
    icon: Radar,
    color: "blue",
  },
  {
    id: "new",
    title: "New on RETRY",
    subtitle: "Fresh off the launchpad",
    icon: Sparkles,
    color: "lime",
  },
  {
    id: "graduated",
    title: "Graduated",
    subtitle: "Completed a RETRY curve",
    icon: GraduationCap,
    color: "purple",
  },
] as const;
type Category = (typeof categories)[number]["id"];
const LIQUIDITY_STEPS = [0, 10_000, 50_000, 100_000, 500_000];

export function Discover({ initialSearch }: { initialSearch: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [stage, setStage] = useState<Category | "all">("all");
  const [sort, setSort] = useState<TokenSort>("liquidity");
  const [filters, setFilters] = useState(false);
  const [minLiquidity, setMinLiquidity] = useState(0);
  const client = usePublicClient({ chainId: MARKET_CHAIN_ID });
  const active = TRACKED_ASSETS.filter((asset) => asset.status === "active");
  const onchain = useQueries({
    queries: active.map((asset) =>
      onchainTokenQuery(client, {
        chainId: asset.chainId,
        address: asset.address,
      }),
    ),
  });
  const markets = useQueries({
    queries: active.map((asset) =>
      tokenMarketQuery(
        { chainId: asset.chainId, address: asset.address },
        asset.primaryPool?.id,
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
    isAddress(term, { strict: false }) &&
    !active.some((a) => a.address.toLowerCase() === term.toLowerCase())
      ? term
      : null;
  return (
    <div className="discover-page">
      <div className="page-topline">
        <span>
          <span className="live-dot" />
          THE NEXT WAVE IS ON BASE
        </span>
        <span className="data-label">
          <span />
          Real Base data · Read-only
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
            <span className="base-mark" />A fresh start. Onchain.
          </div>
          <h1>
            Your next token
            <br />
            starts <span>here.</span>
          </h1>
          <p>Discover, launch and trade the next wave on Base.</p>
          <Link href="/create" className="button button-primary">
            Create Token
            <Plus size={16} />
          </Link>
        </div>
      </section>
      {FEATURED_ASSET ? <FeaturedToken asset={FEATURED_ASSET} /> : null}
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
                aria-label="Search by name, ticker or contract address"
                placeholder="Search name, ticker or 0x…"
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
              <select
                aria-label="Sort tokens"
                value={sort}
                onChange={(e) => setSort(e.target.value as TokenSort)}
              >
                <option value="liquidity">Liquidity</option>
                <option value="volume">Volume 24h</option>
              </select>
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
                        {category.id === "tracked" ? filtered.length : 0}
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
                          href={`/token/?address=${lookup}`}
                          className="token-card lookup-card"
                        >
                          <strong>Not tracked on RETRY</strong>
                          <span>
                            Inspect {shorten(lookup)} on Base: contract check
                            and public market data.
                          </span>
                          <span className="lookup-cta">
                            Inspect address
                            <ArrowUpRight size={13} />
                          </span>
                        </Link>
                      ) : null}
                      {!filtered.length && !lookup ? (
                        <EmptyState title="No tokens found">
                          Try another name, ticker or contract address, or lower
                          the liquidity filter.
                        </EmptyState>
                      ) : null}
                    </>
                  ) : category.id === "new" ? (
                    <EmptyState title="No RETRY launches yet">
                      The RETRY token factory is not deployed. New launches will
                      appear here once it is.
                    </EmptyState>
                  ) : (
                    <EmptyState title="Nothing has graduated yet">
                      Tokens that complete a RETRY bonding curve will be listed
                      here.
                    </EmptyState>
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
            {filtered.length} tracked token{filtered.length === 1 ? "" : "s"} on
            Base · Market data: GeckoTerminal, DEX Screener fallback
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
