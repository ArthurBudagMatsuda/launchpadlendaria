import type { Metadata } from "next";
import { Suspense } from "react";
import { TokenLookup } from "@/components/market/token-lookup";
import { LoadingSkeleton } from "@/components/ui/feedback";
export const metadata: Metadata = { title: "Inspect a Base token" };
// The address lives in the query string (?address=0x…), which a static
// export can serve for any token without pre-generating a page.
export default function TokenLookupPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <TokenLookup />
    </Suspense>
  );
}
