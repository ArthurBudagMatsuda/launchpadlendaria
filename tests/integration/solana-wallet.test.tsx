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
  compatibleWallet,
  selectAccount,
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
const unregisterAll: (() => void)[] = [];
function fixture(
  name = "Phantom",
  connect = vi.fn(async () => ({ accounts: [account()] })),
  disconnect = vi.fn(async () => {}),
) {
  const listeners = new Set<
    (event: { accounts: readonly WalletAccount[] }) => void
  >();
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
  unregisterAll.push(unregister);
  return {
    wallet,
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
      <output data-testid="rpc">{w.config?.rpcUrl}</output>
      {w.wallets.map((wallet) => (
        <button key={wallet.name} onClick={() => w.connect(wallet)}>
          {wallet.name}
        </button>
      ))}
      <button onClick={w.disconnect}>Disconnect</button>
      <button onClick={w.cancel}>Cancel</button>
      <button onClick={() => w.selectCluster("mainnet-beta")}>Mainnet</button>
      <button onClick={() => w.selectCluster("devnet")}>Devnet</button>
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
  vi.useRealTimers();
  cleanup();
  unregister?.();
  unregisterAll.splice(0).forEach((off) => off());
  unregister = undefined;
  localStorage.clear();
  vi.unstubAllGlobals();
});
describe("single Solana context with Wallet Standard", () => {
  it("bounds a wallet disconnect that never answers", async () => {
    vi.stubGlobal("fetch", rpc());
    fixture(
      "Phantom",
      vi.fn(async () => ({ accounts: [account()] })),
      vi.fn(() => new Promise<void>(() => {})),
    );
    mount();
    fireEvent.click(screen.getByText("Phantom"));
    await waitFor(() =>
      expect(screen.getByTestId("identity").textContent).toBe(`connected:${A}`),
    );
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Disconnect"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_001);
    });
    expect(screen.getByTestId("identity").textContent).toBe(
      "disconnected:none",
    );
    expect(screen.getByTestId("error").textContent).toContain(
      "could not revoke",
    );
  });
  it("contains a wallet subscription failure instead of crashing the app", async () => {
    const f = fixture();
    Object.assign(f.wallet.features["standard:events"] as object, {
      on: () => {
        throw new Error("unavailable");
      },
    });
    vi.stubGlobal("fetch", rpc());
    mount();
    fireEvent.click(screen.getByText("Phantom"));
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toContain(
        "account updates unavailable",
      ),
    );
    expect(screen.getByTestId("identity").textContent).toBe(
      "disconnected:none",
    );
  });
  it("refuses an EVM account or a mismatched public key", () => {
    expect(
      selectAccount(
        [
          {
            ...account(),
            address: "0x1111111111111111111111111111111111111111",
            chains: ["eip155:8453"],
          },
        ],
        "solana:devnet",
      ),
    ).toBeUndefined();
    expect(
      selectAccount(
        [{ ...account(B), publicKey: new Uint8Array(32) }],
        "solana:devnet",
      ),
    ).toBeUndefined();
  });
  it("preserves a configured RPC after a cluster round trip", () => {
    mount();
    fireEvent.click(screen.getByText("Mainnet"));
    fireEvent.click(screen.getByText("Devnet"));
    expect(screen.getByTestId("rpc").textContent).toBe(
      "https://wallet-tests.example",
    );
  });
  it("does not let a late disconnect error overwrite a reconnected session", async () => {
    let rejectDisconnect!: (cause: Error) => void;
    fixture(
      "Phantom",
      vi.fn(async () => ({ accounts: [account()] })),
      vi.fn(
        () =>
          new Promise<void>((_done, reject) => {
            rejectDisconnect = reject;
          }),
      ),
    );
    fixture("Solflare");
    vi.stubGlobal("fetch", rpc());
    mount();
    fireEvent.click(screen.getByText("Phantom"));
    await waitFor(() =>
      expect(screen.getByTestId("identity").textContent).toBe(`connected:${A}`),
    );
    fireEvent.click(screen.getByText("Disconnect"));
    fireEvent.click(screen.getByText("Solflare"));
    await waitFor(() =>
      expect(screen.getByTestId("identity").textContent).toBe(`connected:${A}`),
    );
    await act(async () => rejectDisconnect(new Error("old rejection")));
    expect(screen.getByTestId("error").textContent).toBe("");
  });
  it("rejects incomplete wallet lifecycle features", () => {
    const f = fixture();
    expect(
      compatibleWallet({
        ...f.wallet,
        features: {
          "standard:connect": f.wallet.features["standard:connect"],
          "standard:events": { version: "1.0.0" },
        },
      }),
    ).toBe(false);
  });
  it("does not throw on malformed account events", () => {
    expect(() =>
      selectAccount(null as unknown as WalletAccount[], "solana:devnet"),
    ).not.toThrow();
    expect(
      selectAccount([{} as WalletAccount], "solana:devnet"),
    ).toBeUndefined();
  });
  it("shows one option for repeated registrations of the same wallet brand", () => {
    fixture("Phantom");
    fixture("Phantom");
    mount();
    expect(screen.getAllByText("Phantom")).toHaveLength(1);
  });
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
