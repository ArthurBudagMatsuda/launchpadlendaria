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
  const path = usePathname();
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
          Preview mode<span className="footer-divider">/</span>Built on Base
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
        title="A new beginning on Base."
        description="RETRY · Foundation preview"
      >
        <div className="info-box">
          <p>
            Explore fictional tokens, preview your next launch, and connect an
            EVM wallet.
          </p>
          <p>
            All market data, charts, activity and graduation progress are
            demonstrations. Trading and token launches are coming soon. No funds
            can be moved through this app.
          </p>
          <p>
            Wallet addresses and native ETH balances are read from your
            connected wallet and the selected Base network.
          </p>
        </div>
      </Modal>
    </>
  );
}
