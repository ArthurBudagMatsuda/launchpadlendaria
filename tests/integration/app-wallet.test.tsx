// @vitest-environment jsdom
// The real RETRY provider composition (Providers → RetryWeb3Provider →
// wagmi + TanStack Query) and the real Shell, Header, Discover, Portfolio and
// trade panel, wired to the module's mock EIP-1193 wallet and an in-memory
// Base RPC. Next.js routing is replaced by a small store so a "navigation"
// swaps the page under the same providers, like the App Router layout does.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  multicall3Abi,
  numberToHex,
  type Address,
  type Hex,
} from "viem";
import { createRetryWeb3Config } from "@retry/web3/config";
import {
  createMockEip1193Provider,
  MOCK_WALLET_ACCOUNTS,
  mockWalletConnector,
} from "@retry/web3/testing";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/layout/shell";
import { DiscoverFromUrl } from "@/components/discover/discover-from-url";
import { Portfolio } from "@/components/portfolio/portfolio";
import { TradePanel } from "@/components/trade/trade-panel";
import {
  answerTokenCall,
  marketFetch,
  WORTH,
} from "../fixtures/market-responses";

const route = vi.hoisted(() => {
  let path = "/";
  const listeners = new Set<() => void>();
  return {
    get: () => path,
    go(next: string) {
      path = next.split("?")[0] || "/";
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => useSyncExternalStore(route.subscribe, route.get),
  useRouter: () => ({ push: route.go, replace: route.go, prefetch() {} }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string;
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
        route.go(href);
      }}
    >
      {children}
    </a>
  ),
}));

const [ALICE, BOB] = MOCK_WALLET_ACCOUNTS;
const short = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;
const balances: Record<number, Record<string, bigint>> = {
  84532: {
    [ALICE.toLowerCase()]: 23_400_000_000_000_000n,
    [BOB.toLowerCase()]: 2n * 10n ** 18n,
  },
  8453: { [ALICE.toLowerCase()]: 5n * 10n ** 18n },
};

const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11";

// wagmi reads native balances through Multicall3 (getEthBalance); the token
// identity reads (ERC-20 metadata, B20 factory) go through aggregate3 too.
function answerMulticall(data: Hex, balanceOf: (a: Address) => bigint): Hex {
  const decoded = decodeFunctionData({ abi: multicall3Abi, data });
  if (decoded.functionName === "getEthBalance") {
    const [address] = decoded.args as readonly [Address];
    return encodeFunctionResult({
      abi: multicall3Abi,
      functionName: "getEthBalance",
      result: balanceOf(address),
    });
  }
  const [calls] = decoded.args as readonly [
    readonly { target: Address; callData: Hex }[],
  ];
  return encodeFunctionResult({
    abi: multicall3Abi,
    functionName: "aggregate3",
    result: calls.map(({ target, callData }) =>
      target.toLowerCase() === MULTICALL3
        ? { success: true, returnData: answerMulticall(callData, balanceOf) }
        : answerTokenCall(target, callData),
    ),
  });
}

function setup() {
  const market = marketFetch();
  vi.stubGlobal("fetch", market.fetch);
  const wallet = createMockEip1193Provider();
  const rpcCalls: { chainId: number; method: string }[] = [];
  const transport = (chainId: number) =>
    custom(
      {
        async request({
          method,
          params,
        }: {
          method: string;
          params?: unknown;
        }) {
          rpcCalls.push({ chainId, method });
          const balanceOf = (address: Address) =>
            balances[chainId]?.[address.toLowerCase()] ?? 0n;
          switch (method) {
            case "eth_chainId":
              return numberToHex(chainId);
            case "eth_blockNumber":
              return "0x10";
            case "eth_getBalance":
              return numberToHex(balanceOf((params as [Address])[0]));
            case "eth_getCode":
              // Base B20 tokens are precompiles: a one-byte 0xef marker.
              return chainId === 8453 &&
                (params as [Address])[0].toLowerCase() === WORTH.toLowerCase()
                ? "0xef"
                : "0x";
            case "eth_call": {
              const [{ to, data }] = params as [{ to: Address; data: Hex }];
              if (to.toLowerCase() === MULTICALL3)
                return answerMulticall(data, balanceOf);
              const answer = answerTokenCall(to, data);
              if (!answer.success) throw new Error("execution reverted");
              return answer.returnData;
            }
            default:
              throw new Error(`unexpected RPC method ${method}`);
          }
        },
      },
      { retryCount: 0 },
    );
  const config = createRetryWeb3Config({
    env: { defaultChain: "base-sepolia" },
    connectors: [mockWalletConnector(wallet)],
    transports: { 8453: transport(8453), 84532: transport(84532) },
    storage: "none",
    multiInjectedProviderDiscovery: false,
  });
  const clients = new Set<unknown>();
  function QueryClientProbe() {
    clients.add(useQueryClient());
    return null;
  }
  function Page() {
    const path = useSyncExternalStore(route.subscribe, route.get);
    if (path === "/portfolio") return <Portfolio />;
    if (path === "/token/base/worth")
      return (
        <TradePanel
          symbol="worth"
          token={{ chainId: 8453, address: WORTH }}
          decimals={18}
        />
      );
    return <DiscoverFromUrl />;
  }
  route.go("/");
  render(
    <Providers config={config}>
      <QueryClientProbe />
      <Shell>
        <Page />
      </Shell>
    </Providers>,
  );
  return { wallet, config, rpcCalls, clients, market };
}

const banner = () => within(screen.getByRole("banner"));
const nav = () =>
  within(screen.getByRole("navigation", { name: "Main navigation" }));
const requests = (
  wallet: ReturnType<typeof createMockEip1193Provider>,
  pattern: RegExp,
) => wallet.calls.filter((call) => pattern.test(call.method));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RETRY app wallet integration", () => {
  it("connects once in the header and keeps the wallet across pages, account and network changes", async () => {
    const { wallet, config, rpcCalls, clients, market } = setup();

    // 1. Disconnected app.
    expect(
      banner().getByRole("button", { name: "Connect Wallet" }),
    ).toBeTruthy();
    expect(screen.getByTestId("rw3-network-indicator").textContent).toContain(
      "Base Sepolia",
    );
    // Discover's featured token renders through the shared QueryClient, with
    // its identity from Base RPC and its market from the provider.
    await screen.findByText("Featured token");
    await waitFor(() =>
      expect(
        screen.getAllByText("one life, its worth an attempt").length,
      ).toBeGreaterThan(0),
    );
    await screen.findAllByText("$0.001826");
    expect(document.body.textContent).not.toMatch(/Demo Data|Orbit Cat/);

    // 2–3. Open the picker and connect with the mock EIP-1193 wallet.
    fireEvent.click(banner().getByRole("button", { name: "Connect Wallet" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Connect Wallet",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Mock Wallet/ }),
    );

    // 4–5. Address and chain in the header.
    await banner().findByRole("button", { name: short(ALICE) });
    expect(screen.getByTestId("rw3-network-indicator").textContent).toContain(
      "Base Sepolia",
    );

    // 6. Balance from the mocked Base Sepolia RPC, in the account menu.
    fireEvent.click(banner().getByRole("button", { name: short(ALICE) }));
    const menu = await screen.findByTestId("rw3-wallet-menu");
    await within(menu).findByText(/0\.0234 ETH/);
    expect(within(menu).getByTestId("rw3-full-address").textContent).toBe(
      ALICE,
    );
    fireEvent.keyDown(document, { key: "Escape" });

    // 7–8. Portfolio keeps the session and reads the same wallet.
    fireEvent.click(nav().getByRole("link", { name: "Portfolio" }));
    await screen.findByText("Connected wallet");
    const overview = () =>
      document.querySelector(".portfolio-overview") as HTMLElement;
    expect(overview().textContent).toContain(ALICE);
    await waitFor(() => expect(overview().textContent).toContain("0.0234 ETH"));
    expect(overview().textContent).toContain("Base Sepolia");
    expect(overview().textContent).toContain("Connected with Mock Wallet");

    // 9–10. Back to Discover, still connected.
    fireEvent.click(nav().getByRole("link", { name: "Discover" }));
    await waitFor(() =>
      expect(document.querySelector(".portfolio-overview")).toBeNull(),
    );
    expect(banner().getByRole("button", { name: short(ALICE) })).toBeTruthy();

    // The trade panel reads the same wallet and balance.
    act(() => route.go("/token/base/worth"));
    const trade = await screen.findByRole("region", { name: "Trade preview" });
    await within(trade).findByText("Balance: 0.0234 ETH");
    expect(trade.querySelector(".wallet-status")?.textContent).toContain(
      short(ALICE),
    );

    // Navigation never reconnected the wallet.
    expect(
      requests(wallet, /^(eth_requestAccounts|wallet_requestPermissions)$/),
    ).toHaveLength(1);

    // 11–12. Account change in the wallet.
    act(() => wallet.changeAccounts([BOB]));
    await banner().findByRole("button", { name: short(BOB) });
    await within(trade).findByText("Balance: 2 ETH");

    // 13–14. Chain change to an unsupported network.
    act(() => wallet.changeChain(1));
    await banner().findByRole("button", { name: "Wrong Network" });
    expect(screen.getByTestId("rw3-network-indicator").textContent).toBe(
      "Wrong Network",
    );
    expect(
      trade.querySelector(".wallet-status")?.getAttribute("data-state"),
    ).toBe("wrong-network");
    expect(trade.textContent).not.toContain("2 ETH");

    // The user switches back from the trade panel.
    fireEvent.click(
      within(trade).getByRole("button", { name: "Switch to Base Sepolia" }),
    );
    await banner().findByRole("button", { name: short(BOB) });

    // 15–16. Disconnect from the header menu.
    fireEvent.click(banner().getByRole("button", { name: short(BOB) }));
    const reopened = await screen.findByTestId("rw3-wallet-menu");
    fireEvent.click(
      within(reopened).getByRole("button", { name: "Disconnect" }),
    );
    await banner().findByRole("button", { name: "Connect Wallet" });
    expect(
      trade.querySelector(".wallet-status")?.getAttribute("data-state"),
    ).toBe("disconnected");

    // One QueryClient for the app and wagmi. Wallet balances were read on Base
    // Sepolia (the wallet's network); Base mainnet was only used for the
    // tracked token's identity and balance, never for the wallet's ETH.
    expect(clients.size).toBe(1);
    const [client] = [...clients] as {
      getQueryCache(): { findAll(): { queryKey: unknown[] }[] };
    }[];
    expect(
      client
        .getQueryCache()
        .findAll()
        .some((query) => query.queryKey[0] === "balance"),
    ).toBe(true);
    expect(config.settings.financialOperationsEnabled).toBe(false);
    expect(rpcCalls.filter((call) => call.method === "eth_getBalance")).toEqual(
      rpcCalls
        .filter((call) => call.method === "eth_getBalance")
        .map(() => expect.objectContaining({ chainId: 84532 })),
    );
    expect(
      rpcCalls
        .filter((call) => call.chainId === 8453)
        .every((call) =>
          ["eth_chainId", "eth_getCode", "eth_call"].includes(call.method),
        ),
    ).toBe(true);
    // Market data came only from the allowlisted providers.
    expect(
      market.calls.every((url) =>
        ["api.geckoterminal.com", "api.dexscreener.com"].includes(
          new URL(url).hostname,
        ),
      ),
    ).toBe(true);
    // Read-only: nothing was signed, sent or approved.
    expect(requests(wallet, /sign|send|approve/i)).toEqual([]);
  });

  it("shows Portfolio's empty state without inventing a wallet", async () => {
    setup();
    act(() => route.go("/portfolio"));
    await screen.findByText("A home for your next chapter.");
    expect(document.querySelector(".portfolio-overview")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d ETH/);
  });
});
