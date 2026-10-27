import { Suspense } from "react";
import { DiscoverFromUrl } from "@/components/discover/discover-from-url";
import { LoadingSkeleton } from "@/components/ui/feedback";
import { tokenProvider } from "@/services/token-provider";
export default async function Home() {
  const tokens = await tokenProvider.list();
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DiscoverFromUrl initialTokens={tokens} />
    </Suspense>
  );
}
