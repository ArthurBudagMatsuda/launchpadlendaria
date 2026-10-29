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
          Devnet · Mainnet locked<span className="footer-divider">/</span>Built
          on Solana
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
        description="RETRY · Devnet MVP"
      >
        <div className="info-box">
          <p>
            Launch a token on a Meteora Dynamic Bonding Curve, trade it on the
            curve, and watch it graduate to Meteora DAMM v2 with its liquidity
            locked for good.
          </p>
          <p>
            Launching and trading work on Solana Devnet with free test SOL.
            Mainnet is locked in code until the economics and a security review
            are approved.
          </p>
          <p>
            RETRY never holds your funds or keys. Every launch, trade and claim
            is simulated first and needs your approval in the wallet.
          </p>
          <p>
            External mints and their public market data (GeckoTerminal, DEX
            Screener fallback) stay read-only. Each figure shows its source.
          </p>
        </div>
      </Modal>
    </>
  );
}
