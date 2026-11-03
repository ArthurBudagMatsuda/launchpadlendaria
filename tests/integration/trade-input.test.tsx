// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Transaction } from "@solana/web3.js";
import {
  TradeForm,
  type TradeVenue,
} from "@/components/launch/retry-trade-panel";
import type { TradeQuote } from "@/lib/meteora/quotes";
import type { RetryPool } from "@/lib/meteora/pools";
import type { TxExpectation } from "@/lib/meteora/transactions";
const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/hooks/use-retry", () => ({
  useMeteora: () => ({
    wallet: {
      status: "connected",
      address: "11111111111111111111111111111111",
    },
    context: {},
    policy: { enabled: true },
  }),
  useExecute: () => ({
    state: { phase: "idle" },
    run,
    reset: () => {},
    canSign: true,
  }),
  userMessage: () => "test error",
}));
vi.mock("@/components/wallet/solana-provider", () => ({
  useSolBalance: () => ({ data: { lamports: 1000000000n }, display: "1 SOL" }),
}));
vi.mock("@/components/wallet/solana-status", () => ({
  WalletStatus: () => null,
}));
vi.mock("@/components/launch/launch-ui", () => ({
  OperationState: () => null,
  PolicyNotice: () => null,
}));
vi.mock("@/lib/meteora/trade", () => ({
  tokenBalance: async () => 100000000000n,
  wrappedSolBalance: async () => 0n,
}));
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
afterEach(() => {
  cleanup();
  client.clear();
  run.mockReset();
});

it("does not erase a new sell amount when a preceding buy finishes reconciling", async () => {
  let finish!: (value: unknown) => void;
  run.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pool = {
    cluster: "devnet",
    baseMint: "11111111111111111111111111111111",
    address: "test-pool",
  } as RetryPool;
  const venue: TradeVenue = {
    feature: "trade-curve",
    address: "test-pool",
    slot: 1,
    tradable: true,
    notice: null,
    feeLabel: "Fee",
    feeDetail: () => "test fee",
    footnote: "Simulated test quotes",
    quote: async (side, amountIn, slippageBps): Promise<TradeQuote> => ({
      venue: "dbc",
      side,
      pool: "test-pool",
      amountIn,
      amountInUsed: amountIn,
      amountLeft: 0n,
      amountOut: 1000000n,
      minimumAmountOut: 990000n,
      slippageBps,
      fee: 1n,
      protocolFee: 0n,
      spotPriceSol: "0.01",
      executionPriceSol: "0.01",
      priceImpactPct: "0",
      completesCurve: false,
      slot: 1,
      quotedAt: Date.now(),
    }),
    prepare: async () => ({
      tx: {} as Transaction,
      expect: {} as TxExpectation,
    }),
  };
  render(
    <QueryClientProvider client={client}>
      <TradeForm pool={pool} symbol="TEST" venue={venue} />
    </QueryClientProvider>,
  );
  const amount = screen.getByRole("textbox");
  fireEvent.change(amount, { target: { value: "0.1" } });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Buy TEST" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Buy TEST" }));
  await waitFor(() => expect(run).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: /^Sell$/ }));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "50%" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "50%" }));
  expect((amount as HTMLInputElement).value).toBe("50");
  await act(async () => {
    finish({ signature: "test-only" });
  });
  expect((amount as HTMLInputElement).value).toBe("50");
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Sell TEST" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
});
