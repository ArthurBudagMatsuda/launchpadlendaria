"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  Compass,
  HelpCircle,
  Plus,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Header } from "./header";
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/\/$/, "") || "/";
  const [help, setHelp] = useState(false);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <aside className="rail" aria-label="Quick navigation">
        <div className="rail-top">
          {[
            { href: "/", label: "Discover", icon: Compass },
            { href: "/create", label: "Create token", icon: Plus },
            { href: "/portfolio", label: "Portfolio", icon: Wallet },
          ].map((l) => (
            <Link
              key={l.href}
              className={`rail-link ${path === l.href ? "active" : ""}`}
              href={l.href}
              aria-label={l.label}
              title={l.label}
            >
              <l.icon size={21} />
            </Link>
          ))}
        </div>
        <button
          className="rail-link"
          onClick={() => setHelp(true)}
          aria-label="About this preview"
          title="About this preview"
        >
          <HelpCircle size={21} />
        </button>
      </aside>
      <main id="main" className="main">
        {children}
      </main>
      <footer className="footer">
        <span className="footer-status">
          <i />
          Preview mode<span className="footer-divider">/</span>Built on Solana
        </span>
        <span>Every new beginning starts with a retry.</span>
        <button onClick={() => setHelp(true)}>
          About RETRY
          <ChartNoAxesCombined size={13} />
        </button>
      </footer>
      <Modal
        open={help}
        onOpenChange={setHelp}
        title="A new beginning on Solana."
        description="RETRY · Foundation preview"
      >
        <div className="info-box">
          <p>
            Discover tokens on Solana, preview your next launch, and connect a
            Solana wallet.
          </p>
          <p>
            Prices, charts, pools and market activity come from public market
            data (GeckoTerminal, with DEX Screener as a fallback) and token
            identities from Solana RPC. Each figure shows its source and update
            time. Tracked tokens are external: none was launched on RETRY.
          </p>
          <p>
            Trading and token launches are coming soon. No funds can be moved
            through this app.
          </p>
          <p>
            Public keys and native SOL balances are read on the application’s
            selected Solana cluster. Connecting never asks for a signature or a
            transaction.
          </p>
        </div>
      </Modal>
    </>
  );
}
