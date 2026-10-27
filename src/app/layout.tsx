import type { Metadata } from "next";
import { assetPath } from "@/lib/asset-path";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/layout/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "RETRY — A new beginning on Base", template: "%s | RETRY" },
  description:
    "Discover your next beginning. RETRY is a Base-native memecoin launchpad. Foundation preview with clearly labeled demo markets.",
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
