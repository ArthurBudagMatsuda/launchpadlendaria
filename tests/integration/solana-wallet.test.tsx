// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { getAddressEncoder } from "@solana/kit";
import {
  RetrySolanaProvider,
  useSolBalance,
  useSolanaWallet,
} from "@/components/wallet/solana-provider";
import { CLUSTERS } from "@/config/solana";
import { parseAddress } from "@/lib/solana/address";
const A = "11111111111111111111111111111111";
const B = "So11111111111111111111111111111111111111112";
const account = (address = A): WalletAccount => ({
  address,
  publicKey: new Uint8Array(getAddressEncoder().encode(parseAddress(address)!)),
  chains: ["solana:devnet", "solana:mainnet"],
  features: [],
});
let unregister: (() => void) | undefined;
function fixture(
  name = "Phantom",
  connect = vi.fn(async () => ({ accounts: [account()] })),
) {
  const listeners = new Set<
    (event: { accounts: readonly WalletAccount[] }) => void
  >();
  const disconnect = vi.fn(async () => {});
  const wallet: Wallet = {
    version: "1.0.0",
    name,
    icon: "data:image/png;base64,AA==",
    chains: ["solana:devnet", "solana:mainnet"],
    accounts: [],
    features: {
      "standard:connect": { version: "1.0.0", connect },
      "standard:disconnect": { version: "1.0.0", disconnect },
      "standard:events": {
        version: "1.0.0",
        on: (
          _event: string,
          listener: (event: { accounts: readonly WalletAccount[] }) => void,
        ) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    },
  };
  unregister = getWallets().register(wallet);
  return {
    connect,
    disconnect,
    change: (accounts: WalletAccount[]) =>
      listeners.forEach((listener) => listener({ accounts })),
  };
}
function Probe() {
  const w = useSolanaWallet(),
    b = useSolBalance();
  return (
    <>
      <output data-testid="identity">
        {w.status}:{w.address ?? "none"}
      </output>
      <output data-testid="balance">
        {b.available
          ? `${b.display} SOL`
          : b.isError
            ? "Balance unavailable"
            : "Pending"}
      </output>
      <output data-testid="error">{w.error}</output>
      <output data-testid="cluster">{w.config?.cluster}</output>
      {w.wallets.map((wallet) => (
        <button key={wallet.name} onClick={() => w.connect(wallet)}>
          {wallet.name}
        </button>
      ))}
      <button onClick={w.disconnect}>Disconnect</button>
      <button onClick={w.cancel}>Cancel</button>
      <button onClick={() => w.selectCluster("mainnet-beta")}>Mainnet</button>
    </>
  );
}
function mount() {
  return render(
    <StrictMode>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: 0 } },
          })
        }
      >
        <RetrySolanaProvider
          initialConfig={{
            cluster: "devnet",
            rpcUrl: "https://wallet-tests.example",
          }}
        >
          <Probe />
        </RetrySolanaProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
function rpc(fail = false) {
  return vi.fn(async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (fail) throw new Error("offline");
    const result =
      body.method === "getGenesisHash"
        ? CLUSTERS.devnet.genesis
        : { context: { slot: 1 }, value: 2500000001 };
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
      { headers: { "content-type": "application/json" } },
    );
  });
}
afterEach(() => {
  cleanup();
  unregister?.();
  unregister = undefined;
  localStorage.clear();
  vi.unstubAllGlobals();
});
describe("single Solana context with Wallet Standard", () => {
  it.each(["Phantom", "Solflare", "Backpack"])(
    "connects %s, reads lamports, handles account changes and disconnects",
    async (name) => {
      vi.stubGlobal("fetch", rpc());
      const f = fixture(name);
      mount();
      fireEvent.click(screen.getByText(name));
      await waitFor(() =>
        expect(screen.getByTestId("identity").textContent).toBe(
          `connected:${A}`,
        ),
      );
      await waitFor(() =>
        expect(screen.getByTestId("balance").textContent).toBe(
          "2.500000001 SOL",
        ),
      );
      act(() => f.change([account(B)]));
      await waitFor(() =>
        expect(screen.getByTestId("identity").textContent).toBe(
          `connected:${B}`,
        ),
      );
      fireEvent.click(screen.getByText("Disconnect"));
      await waitFor(() =>
        expect(screen.getByTestId("identity").textContent).toBe(
          "disconnected:none",
        ),
      );
      expect(f.disconnect).toHaveBeenCalledOnce();
      act(() => f.change([account()]));
      expect(screen.getByTestId("identity").textContent).toBe(
        "disconnected:none",
      );
    },
  );
  it("handles rejection without a false account", async () => {
    const f = fixture(
      "Phantom",
      vi.fn().mockRejectedValue(new Error("rejected")),
    );
    mount();
    fireEvent.click(screen.getByText("Phantom"));
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toMatch(/rejected/),
    );
    expect(f.connect).toHaveBeenCalledOnce();
    expect(screen.getByTestId("identity").textContent).toBe(
      "disconnected:none",
    );
  });
  it("ignores late connection after cancellation", async () => {
    let resolve!: (value: { accounts: WalletAccount[] }) => void;
    fixture(
      "Phantom",
      vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      ),
    );
    mount();
    fireEvent.click(screen.getByText("Phantom"));
    fireEvent.click(screen.getByText("Cancel"));
    await act(async () => resolve({ accounts: [account()] }));
    expect(screen.getByTestId("identity").textContent).toBe(
      "disconnected:none",
    );
  });
  it("restores only a previous wallet silently under StrictMode", async () => {
    localStorage.setItem("retry:solana:last-wallet:v1", "Phantom");
    const f = fixture();
    vi.stubGlobal("fetch", rpc());
    mount();
    await waitFor(() =>
      expect(screen.getByTestId("identity").textContent).toBe(`connected:${A}`),
    );
    expect(f.connect).toHaveBeenCalledWith({ silent: true });
  });
  it("clears disconnected accounts and unregistering wallets", async () => {
    const f = fixture();
    vi.stubGlobal("fetch", rpc());
    mount();
    fireEvent.click(screen.getByText("Phantom"));
    await waitFor(() =>
      expect(screen.getByTestId("identity").textContent).toBe(`connected:${A}`),
    );
    act(() => f.change([]));
    await waitFor(() =>
      expect(screen.getByTestId("identity").textContent).toBe(
        "disconnected:none",
      ),
    );
    fireEvent.click(screen.getByText("Phantom"));
    await waitFor(() =>
      expect(screen.getByTestId("identity").textContent).toBe(`connected:${A}`),
    );
    act(() => unregister?.());
    await waitFor(() =>
      expect(screen.getByTestId("identity").textContent).toBe(
        "disconnected:none",
      ),
    );
  });
  it("reports RPC failure without zero or signing", async () => {
    vi.stubGlobal("fetch", rpc(true));
    fixture();
    mount();
    fireEvent.click(screen.getByText("Phantom"));
    await waitFor(() =>
      expect(screen.getByTestId("balance").textContent).toBe(
        "Balance unavailable",
      ),
    );
  });
  it("changes the application cluster without requesting a wallet network switch", async () => {
    const f = fixture();
    vi.stubGlobal("fetch", rpc());
    mount();
    fireEvent.click(screen.getByText("Phantom"));
    await waitFor(() =>
      expect(screen.getByTestId("identity").textContent).toBe(`connected:${A}`),
    );
    fireEvent.click(screen.getByText("Mainnet"));
    expect(screen.getByTestId("cluster").textContent).toBe("mainnet-beta");
    expect(f.connect).toHaveBeenCalledOnce();
  });
});
