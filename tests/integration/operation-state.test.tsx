// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useExecute, type ExecuteRequest } from "@/hooks/use-retry";

vi.mock("@/components/wallet/solana-provider", () => ({
  useSolanaWallet: () => ({
    status: "connected",
    config: { cluster: "devnet" },
    wallet: {},
    account: {},
  }),
}));
vi.mock("@/lib/meteora/client", () => ({
  meteoraContext: () => ({ cluster: "devnet" }),
}));
vi.mock("@/lib/meteora/wallet-signer", async () => {
  const { PublicKey } = await import("@solana/web3.js");
  return {
    supportsSigning: () => true,
    walletSigner: () => ({
      publicKey: new PublicKey("11111111111111111111111111111111"),
    }),
  };
});
vi.mock("@/lib/meteora/transactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/meteora/transactions")>()),
  execute: async () => ({
    signature: "test-only",
    result: { status: "confirmed", slot: 1 },
  }),
}));
afterEach(cleanup);

it("keeps execution running through reconciliation, including input resets", async () => {
  const client = new QueryClient();
  let finish!: () => void;
  const invalidate = vi
    .spyOn(client, "invalidateQueries")
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const { result } = renderHook(() => useExecute("trade-curve"), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  let pending: ReturnType<typeof result.current.run>;
  act(() => {
    pending = result.current.run({} as ExecuteRequest);
  });
  await waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
  expect(result.current.state.phase).toBe("running");
  act(() => result.current.reset());
  expect(result.current.state.phase).toBe("running");
  await act(async () => {
    finish();
    await pending;
  });
  expect(result.current.state.phase).toBe("done");
  act(() => result.current.reset());
  expect(result.current.state.phase).toBe("idle");
  expect(invalidate).toHaveBeenCalledTimes(2);
  client.clear();
});
