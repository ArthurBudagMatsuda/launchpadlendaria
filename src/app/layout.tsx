import type { Metadata } from "next";
import { assetPath } from "@/lib/asset-path";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/layout/shell";
import "@/components/wallet/solana.css";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "RETRY — A new beginning on Solana",
    template: "%s | RETRY",
  },
  description:
    "Discover your next beginning. RETRY is a Solana-native memecoin launchpad. Read-only wallet and mint inspection; trading and launches are not enabled yet.",
  icons: { icon: assetPath("/brand/retry-symbol.svg") },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
