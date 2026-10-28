import { Suspense } from "react";
import { DiscoverFromUrl } from "@/components/discover/discover-from-url";
import { LoadingSkeleton } from "@/components/ui/feedback";
// Market data is fetched in the browser (static hosting has no server), so
// the exported HTML never carries a price that could be stale or invented.
export default function Home() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DiscoverFromUrl />
    </Suspense>
  );
}
