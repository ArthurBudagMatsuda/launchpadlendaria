import { afterEach, describe, expect, it, vi } from "vitest";
import { CLUSTERS, type SolanaConfig } from "@/config/solana";
import { parseAddress } from "@/lib/solana/address";
import {
  readMint,
  readSolana,
  readSolBalance,
  TOKEN_PROGRAM,
} from "@/lib/solana/rpc";
let sequence = 0;
const config = (): SolanaConfig => ({
  cluster: "devnet",
  rpcUrl: `https://rpc-${++sequence}.example`,
});
const owner = parseAddress("11111111111111111111111111111111")!;
function mockRpc(
  overrides: Record<string, unknown> = {},
  balance = "1500000001",
) {
  const methods: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      methods.push(body.method);
      const result =
        body.method in overrides
          ? overrides[body.method]
          : body.method === "getGenesisHash"
            ? CLUSTERS.devnet.genesis
            : null;
      const encoded =
        body.method === "getBalance"
          ? `{"context":{"slot":123},"value":${balance}}`
          : JSON.stringify(result);
      return new Response(
        `{"jsonrpc":"2.0","id":${JSON.stringify(body.id)},"result":${encoded}}`,
        { headers: { "content-type": "application/json" } },
      );
    }),
  );
  return methods;
}
afterEach(() => vi.unstubAllGlobals());
describe("verified Solana RPC reads", () => {
  it("shows zero only when a successful RPC returns zero", async () => {
    mockRpc({}, "0");
    expect((await readSolBalance(config(), owner)).lamports).toBe(0n);
  });
  it("rejects balances outside the lamport uint64 range", async () => {
    mockRpc({}, "18446744073709551616");
    await expect(readSolBalance(config(), owner)).rejects.toThrow(
      /unavailable/,
    );
  });
  it("checks the genesis and reads exact SOL without signing", async () => {
    const methods = mockRpc();
    const result = await readSolBalance(config(), owner);
    expect(result.lamports).toBe(1500000001n);
    expect(methods).toEqual(["getGenesisHash", "getBalance"]);
  });
  it("preserves values larger than Number.MAX_SAFE_INTEGER", async () => {
    mockRpc({}, "18446744073709551615");
    expect((await readSolBalance(config(), owner)).lamports).toBe(
      18446744073709551615n,
    );
  });
  it("refuses a different cluster before balance requests", async () => {
    const methods = mockRpc({
      getGenesisHash: CLUSTERS["mainnet-beta"].genesis,
    });
    await expect(readSolBalance(config(), owner)).rejects.toThrow(/cluster/);
    expect(methods).toEqual(["getGenesisHash"]);
  });
  it("bounds retries and never substitutes zero after failure", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    await expect(readSolBalance(config(), owner)).rejects.toThrow(
      /unavailable/,
    );
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(2);
  });
  it("times out reads and bounds both attempts", async () => {
    mockRpc();
    const cfg = config();
    await expect(
      readSolana(
        cfg,
        (_rpc, signal) =>
          new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () =>
              reject(new Error("timeout")),
            ),
          ),
        undefined,
        10,
      ),
    ).rejects.toThrow(/unavailable|timed out/);
  });
  it("distinguishes a missing account from a token", async () => {
    mockRpc({ getAccountInfo: { context: { slot: 1 }, value: null } });
    expect((await readMint(config(), owner)).verdict).toBe("missing");
  });
  it("validates owner, initialization, decimals and uint64 supply", async () => {
    mockRpc({
      getAccountInfo: {
        context: { slot: 1 },
        value: {
          owner: TOKEN_PROGRAM,
          lamports: 1000,
          executable: false,
          rentEpoch: 1,
          data: {
            program: "spl-token",
            space: 82,
            parsed: {
              type: "mint",
              info: {
                decimals: 9,
                supply: "1000000000000000000",
                isInitialized: true,
                mintAuthority: null,
                freezeAuthority: null,
              },
            },
          },
        },
      },
    });
    const facts = await readMint(config(), owner);
    expect(facts.verdict).toBe("token");
    expect(facts.totalSupply).toBe(1000000000000000000n);
    expect(facts.decimals).toBe(9);
  });
  it("rejects a token-looking account owned by another program", async () => {
    mockRpc({
      getAccountInfo: {
        context: { slot: 1 },
        value: {
          owner,
          lamports: 1,
          executable: false,
          rentEpoch: 1,
          data: {
            parsed: {
              type: "mint",
              info: { decimals: 9, supply: "1", isInitialized: true },
            },
          },
        },
      },
    });
    expect((await readMint(config(), owner)).verdict).toBe("not-token");
  });
});
