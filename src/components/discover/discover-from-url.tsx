"use client";
import { useSearchParams } from "next/navigation";
import { Discover } from "./discover";
// Query strings are browser state, so search also works on static GitHub Pages.
export function DiscoverFromUrl() {
  const query = useSearchParams().get("q") ?? "";
  return <Discover key={query} initialSearch={query} />;
}
