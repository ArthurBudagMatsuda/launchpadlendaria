import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tokenProvider } from "@/services/token-provider";
import { Terminal } from "@/components/trade/terminal";
// The demo catalog is finite. Unknown IDs must return a real HTTP 404.
export const dynamicParams = false;
export async function generateStaticParams() {
  return (await tokenProvider.list()).map((token) => ({ id: token.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const token = await tokenProvider.get((await params).id);
  return {
    title: token
      ? `${token.metadata.name} (${token.metadata.symbol}) — Demo Trade`
      : "Token not found",
  };
}
export default async function TokenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [token, history, trades] = await Promise.all([
    tokenProvider.get(id),
    tokenProvider.history(id, "1H"),
    tokenProvider.trades(id),
  ]);
  if (!token) notFound();
  return <Terminal token={token} initialHistory={history} trades={trades} />;
}
