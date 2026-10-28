import type { Metadata } from "next";
import { Portfolio } from "@/components/portfolio/solana-portfolio";
export const metadata: Metadata = { title: "Portfolio" };
export default function PortfolioPage() {
  return <Portfolio />;
}
