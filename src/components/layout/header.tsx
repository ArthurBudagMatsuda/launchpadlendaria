"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Compass,
  Menu,
  Plus,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { useConnection } from "wagmi";
import { Brand } from "./brand";
import { WalletButton, WalletMenu } from "@/components/wallet/wallet-button";
import { useApp } from "@/components/providers";
import { useMounted } from "@/hooks/use-mounted";
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
  const { setWalletOpen, selectedChainId } = useApp();
  const { chainId, isConnected } = useConnection();
  const mounted = useMounted();
  const networkId = mounted && isConnected ? chainId : selectedChainId;
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
            placeholder="Search tokens…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>↵</kbd>
        </form>
        <button
          className="network-button"
          aria-label={`Network: ${networkId === 8453 ? "Base" : networkId === 84532 ? "Base Sepolia" : "Unsupported network"}. Open wallet menu`}
          onClick={() => setWalletOpen(true)}
        >
          <span className="base-mark" />
          <span>
            {networkId === 8453
              ? "Base"
              : networkId === 84532
                ? "Base Sepolia"
                : "Wrong network"}
          </span>
          <ChevronDown size={13} />
        </button>
        <WalletButton />
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
      <WalletMenu />
    </>
  );
}
