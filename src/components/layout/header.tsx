"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  Compass,
  Menu,
  Plus,
  Search,
  Wallet,
  X,
} from "lucide-react";
import {
  ConnectWalletButton,
  NetworkIndicator,
} from "@/components/wallet/solana-wallet";
import { Brand } from "./brand";
const links = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/create", label: "Create", icon: Plus },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
];
export function Header() {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  return (
    <>
      <header className="header">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((l) => (
            <Link
              className={pathname === l.href ? "active" : ""}
              href={l.href}
              key={l.href}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <form
          className="header-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/?q=${encodeURIComponent(search)}`);
          }}
        >
          <Search size={16} />
          <input
            aria-label="Search tokens globally"
            placeholder="Name, ticker or mint…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>↵</kbd>
        </form>
        <NetworkIndicator className="network-button" />
        <ConnectWalletButton className="wallet-button" />
        <button
          className="icon-button mobile-toggle"
          aria-label={menu ? "Close navigation" : "Open navigation"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        {menu ? (
          <nav className="mobile-menu" aria-label="Mobile navigation">
            {links.map((l) => (
              <Link
                className={pathname === l.href ? "active" : ""}
                href={l.href}
                key={l.href}
                onClick={() => setMenu(false)}
              >
                <l.icon size={18} />
                {l.label}
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
    </>
  );
}
