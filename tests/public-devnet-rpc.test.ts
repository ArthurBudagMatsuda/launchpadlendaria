import { describe, expect, it } from "vitest";
import { publicRpcTransport } from "./chain/public-rpc";

const request = (method: string) => ({
  method: "POST",
  body: JSON.stringify({ method }),
});
describe("public Devnet test transport", () => {
  it("bounds the queue and recovers the slot after a rejected request", async () => {
    let finish!: (value: Response) => void;
    const transport = publicRpcTransport({
      maxQueue: 1,
      pause: async () => {},
      fetcher: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const first = transport(
      "https://api.devnet.solana.com",
      request("getBalance"),
    );
    await Promise.resolve();
    await expect(
      transport("https://api.devnet.solana.com", request("getBalance")),
    ).rejects.toThrow(/busy/);
    finish(new Response("{}"));
    expect((await first).ok).toBe(true);
  });
  it("times out a hung send without retrying even if a transport ignores abort", async () => {
    let calls = 0;
    const transport = publicRpcTransport({
      timeoutMs: 10,
      pause: async () => {},
      fetcher: async () => {
        calls++;
        return new Promise(() => {});
      },
    });
    await expect(
      transport("https://api.devnet.solana.com", request("sendTransaction")),
    ).rejects.toThrow(/timed out/);
    expect(calls).toBe(1);
  });
  it("does not retry sooner than a server limit longer than the retry budget", async () => {
    let calls = 0;
    const transport = publicRpcTransport({
      fetcher: async () => {
        calls++;
        return new Response("limited", {
          status: 429,
          headers: { "retry-after": "120" },
        });
      },
      pause: async () => {},
    });
    expect(
      (await transport("https://api.devnet.solana.com", request("getBalance")))
        .status,
    ).toBe(429);
    expect(calls).toBe(1);
  });
  it("serializes concurrent RPC requests with a spacing boundary", async () => {
    const events: string[] = [];
    const transport = publicRpcTransport({
      fetcher: async (_input, init) => {
        events.push(JSON.parse(String(init?.body)).method);
        return new Response("{}");
      },
      pause: async (ms) => {
        events.push(`pause:${ms}`);
      },
      spacingMs: 700,
    });
    await Promise.all([
      transport("https://api.devnet.solana.com", request("getBalance")),
      transport("https://api.devnet.solana.com", request("getAccountInfo")),
    ]);
    expect(events).toEqual([
      "getBalance",
      "pause:700",
      "getAccountInfo",
      "pause:700",
    ]);
  });
  it("honors bounded Retry-After only for reads", async () => {
    let calls = 0;
    const pauses: number[] = [];
    const transport = publicRpcTransport({
      fetcher: async () =>
        ++calls === 1
          ? new Response("limited", {
              status: 429,
              headers: { "retry-after": "2" },
            })
          : new Response("{}"),
      pause: async (ms) => {
        pauses.push(ms);
      },
    });
    expect(
      (
        await transport(
          "https://api.devnet.solana.com",
          request("getAccountInfo"),
        )
      ).ok,
    ).toBe(true);
    expect(calls).toBe(2);
    expect(pauses).toEqual([2000, 700]);
  });
  it("does not transport-retry sends and releases the queue after a failed read", async () => {
    let calls = 0;
    const transport = publicRpcTransport({
      fetcher: async () => {
        calls++;
        throw new Error("network unavailable");
      },
      pause: async () => {},
    });
    await expect(
      transport("https://api.devnet.solana.com", request("sendTransaction")),
    ).rejects.toThrow(/network unavailable/);
    expect(calls).toBe(1);
    await expect(
      transport("https://api.devnet.solana.com", request("getBalance")),
    ).rejects.toThrow(/network unavailable/);
    expect(calls).toBe(4);
  });
});
