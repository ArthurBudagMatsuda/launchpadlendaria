import { Discover } from "@/components/discover/discover";
import { tokenProvider } from "@/services/token-provider";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [tokens, query] = await Promise.all([
    tokenProvider.list(),
    searchParams,
  ]);
  return (
    <Discover
      key={query.q ?? ""}
      initialTokens={tokens}
      initialSearch={query.q ?? ""}
    />
  );
}
