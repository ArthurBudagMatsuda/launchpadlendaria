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
  Flame,
  GraduationCap,
  LayoutGrid,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { LaunchStage, Token } from "@/types/token";
import { filterTokens, type TokenSort } from "@/services/token-provider";
import { tokenProvider } from "@/services/token-provider";
import { TokenAvatar, TokenCard } from "@/components/tokens/token-card";
import { DemoLabel, EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { assetPath } from "@/lib/asset-path";
import { percent, usd } from "@/lib/format";
const categories = [
  {
    id: "new",
    title: "New Creations",
    subtitle: "Fresh off the launchpad",
    icon: Sparkles,
    color: "blue",
  },
  {
    id: "graduating",
    title: "About to Graduate",
    subtitle: "The next chapter is close",
    icon: Flame,
    color: "lime",
  },
  {
    id: "graduated",
    title: "Graduated",
    subtitle: "Ready for the open market",
    icon: GraduationCap,
    color: "purple",
  },
] as const;
export function Discover({
  initialTokens,
  initialSearch,
}: {
  initialTokens: Token[];
  initialSearch: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [stage, setStage] = useState<LaunchStage | "all">("all");
  const [sort, setSort] = useState<TokenSort>("recent");
  const [filters, setFilters] = useState(false);
  const [minProgress, setMinProgress] = useState(0);
  const { data = initialTokens } = useQuery({
    queryKey: ["tokens", "demo"],
    queryFn: () => tokenProvider.list(),
    initialData: initialTokens,
    staleTime: Infinity,
  });
  const filtered = filterTokens(data, { search, stage, sort }).filter(
    (t) => t.launch.curve.progress >= minProgress,
  );
  const trending = [...data]
    .sort((a, b) => b.market.volume24h - a.market.volume24h)
    .slice(0, 5);
  return (
    <div className="discover-page">
      <div className="page-topline">
        <span>
          <span className="live-dot" />
          THE NEXT WAVE IS ON BASE
        </span>
        <DemoLabel />
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
      <section className="trending-section" aria-label="Trending demo tokens">
        <div className="trending-heading">
          <Flame size={15} />
          <strong>Trending</strong>
          <span>24h</span>
        </div>
        <div className="trending-tokens">
          {trending.map((t, i) => (
            <Link href={`/token/${t.id}`} key={t.id} className="trending-token">
              <span className="trending-rank">{i + 1}</span>
              <TokenAvatar token={t} size={27} />
              <strong>{t.metadata.symbol}</strong>
              <span
                className={t.market.change24h >= 0 ? "positive" : "negative"}
              >
                {percent(t.market.change24h)}
              </span>
              <small>{usd(t.market.volume24h)}</small>
            </Link>
          ))}
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
                onClick={() => setStage(c.id as LaunchStage | "all")}
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
                aria-label="Search by name or ticker"
                placeholder="Search name or ticker"
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
                <option value="recent">Newest</option>
                <option value="volume">Volume</option>
                <option value="marketCap">Market cap</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <button
              className={`filter-button ${minProgress ? "active" : ""}`}
              onClick={() => setFilters(true)}
            >
              <SlidersHorizontal size={14} />
              Filters
              {minProgress ? <span className="filter-count">1</span> : null}
            </button>
          </div>
        </div>
        <div
          className={`launch-board ${stage !== "all" ? "single-category" : ""}`}
        >
          {categories
            .filter((c) => stage === "all" || c.id === stage)
            .map((category) => {
              const list = filtered.filter(
                (t) => t.launch.stage === category.id,
              );
              return (
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
                        <span className="count-badge">{list.length}</span>
                      </h3>
                      <p>{category.subtitle}</p>
                    </div>
                    <span className="column-dot" />
                  </div>
                  <div className="token-grid">
                    {list.length ? (
                      list.map((t) => <TokenCard key={t.id} token={t} />)
                    ) : (
                      <EmptyState title="No tokens found">
                        Try another search or adjust your filters.
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
              );
            })}
        </div>
        <div className="board-bottom">
          <span>
            <span className="live-dot" />
            {filtered.length} demo tokens · Fixed snapshot, Oct 26, 2026
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
        description="Filter the local demo catalog."
      >
        <label className="field-label" htmlFor="progress-filter">
          Minimum bonding progress <span>{minProgress}%</span>
        </label>
        <input
          className="range-input"
          id="progress-filter"
          type="range"
          min="0"
          max="100"
          step="10"
          value={minProgress}
          onChange={(e) => setMinProgress(Number(e.target.value))}
        />
        <p className="tiny muted">Graduated tokens have 100% demo progress.</p>
        <div className="two-buttons">
          <button
            className="button button-secondary"
            onClick={() => setMinProgress(0)}
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
