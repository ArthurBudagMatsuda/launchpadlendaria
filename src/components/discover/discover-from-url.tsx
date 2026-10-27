"use client";
import { useSearchParams } from "next/navigation";
import type { Token } from "@/types/token";
import { Discover } from "./discover";
// Query strings are browser state, so search also works on static GitHub Pages.
export function DiscoverFromUrl({ initialTokens }: { initialTokens: Token[] }) {
  const query = useSearchParams().get("q") ?? "";
  return (
    <Discover key={query} initialTokens={initialTokens} initialSearch={query} />
  );
}
