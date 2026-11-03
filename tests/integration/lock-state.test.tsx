// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useLockVerification } from "@/hooks/use-retry";
const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("@/components/wallet/solana-provider", () => ({
  useSolanaWallet: () => ({ config: { cluster: "devnet" } }),
}));
vi.mock("@/lib/meteora/client", () => ({
  meteoraContext: () => ({ cluster: "devnet" }),
}));
vi.mock("@/lib/meteora/damm-v2", () => ({ verifyLockedLiquidity: verify }));
afterEach(() => {
  cleanup();
  verify.mockReset();
});

it("never carries a successful lock proof to another pool while its own RPC read is pending or fails", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  verify.mockResolvedValueOnce({ verified: true, fullyLocked: true });
  type Damm = NonNullable<Parameters<typeof useLockVerification>[0]>;
  const first = { pool: { address: "first-pool", slot: 1 }, state: {} } as Damm;
  const second = {
    pool: { address: "second-pool", slot: 2 },
    state: {},
  } as Damm;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(({ damm }) => useLockVerification(damm), {
    initialProps: { damm: first },
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.data?.verified).toBe(true));
  verify.mockRejectedValue(new Error("RPC unavailable"));
  hook.rerender({ damm: second });
  expect(hook.result.current.data).toBeUndefined();
  await waitFor(() => expect(hook.result.current.isError).toBe(true), {
    timeout: 4000,
  });
  expect(hook.result.current.data).toBeUndefined();
  client.clear();
});
