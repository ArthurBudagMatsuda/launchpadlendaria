import { describe, expect, it } from "vitest";
import {
  createPublicClient,
  custom,
  encodeAbiParameters,
  encodeFunctionResult,
  erc20Abi,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import {
  b20VariantFromAddress,
  OnchainReadError,
  readOnchainTokenFacts,
} from "@/lib/market/onchain";
import { answerTokenMulticall, WORTH } from "./fixtures/market-responses";

const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11";

/** A viem client over an in-memory Base RPC; `override` replaces answers. */
function rpcClient(
  override: (method: string, params: unknown) => unknown = () => undefined,
) {
  return createPublicClient({
    chain: base,
    transport: custom(
      {
        async request({
          method,
          params,
        }: {
          method: string;
          params?: unknown;
        }) {
          const custom = override(method, params);
          if (custom instanceof Error) throw custom;
          if (custom !== undefined) return custom;
          if (method === "eth_chainId") return "0x2105";
          if (method === "eth_getCode")
            return (params as [Address])[0].toLowerCase() ===
              WORTH.toLowerCase()
              ? "0xef"
              : "0x";
          if (method === "eth_call") {
            const [{ to, data }] = params as [{ to: Address; data: Hex }];
            if (to.toLowerCase() === MULTICALL3)
              return answerTokenMulticall(data);
          }
          throw new Error(`unexpected ${method}`);
        },
      },
      { retryCount: 0 },
    ),
  });
}

/** A reader whose aggregate3 answers are given directly (per call). */
function fakeReader(
  code: Hex,
  answers: { success: boolean; returnData: Hex }[],
) {
  return {
    getChainId: async () => 8453,
    getCode: async () => code,
    readContract: async () => answers,
  } as never;
}
const ok = (
  functionName: "name" | "symbol" | "decimals" | "totalSupply",
  result: unknown,
) => ({
  success: true,
  returnData: encodeFunctionResult({
    abi: erc20Abi,
    functionName,
    result: result as never,
  }),
});
const reverted = { success: false, returnData: "0x" as Hex };
const bool = (value: boolean) => ({
  success: true,
  returnData: encodeAbiParameters([{ type: "bool" }], [value]),
});

describe("on-chain token verification", () => {
  it("recognises the featured token as a B20 asset with ERC-20 metadata", async () => {
    const facts = await readOnchainTokenFacts(rpcClient(), {
      chainId: 8453,
      address: WORTH,
    });
    expect(facts).toMatchObject({
      verdict: "token",
      standard: "b20",
      b20Variant: "asset",
      codeBytes: 1,
      name: "one life, its worth an attempt",
      symbol: "worth",
      decimals: 18,
      totalSupply: 10n ** 27n,
      missing: [],
      issues: [],
      rpcChainId: 8453,
    });
  });

  it("reports an address with no bytecode and no B20 entry as no contract", async () => {
    const empty = "0x1111111111111111111111111111111111111111";
    const facts = await readOnchainTokenFacts(rpcClient(), {
      chainId: 8453,
      address: empty,
    });
    expect(facts.verdict).toBe("no-code");
    expect(facts.standard).toBeNull();
  });

  it("reports a contract without ERC-20 methods as not a token", async () => {
    const contract = "0x2222222222222222222222222222222222222222";
    const facts = await readOnchainTokenFacts(
      rpcClient((method) =>
        method === "eth_getCode" ? "0x6080604052" : undefined,
      ),
      { chainId: 8453, address: contract },
    );
    expect(facts.verdict).toBe("not-erc20");
    expect(facts.missing).toEqual([
      "name",
      "symbol",
      "decimals",
      "totalSupply",
    ]);
    expect(facts.name).toBeNull();
  });

  it("refuses data from an RPC on another chain", async () => {
    const facts = await readOnchainTokenFacts(
      rpcClient((method) => (method === "eth_chainId" ? "0x1" : undefined)),
      { chainId: 8453, address: WORTH },
    );
    expect(facts.verdict).toBe("wrong-chain");
    expect(facts.rpcChainId).toBe(1);
    expect(facts.name).toBeNull();
  });

  it("flags decimals outside the B20 range instead of using them", async () => {
    const facts = await readOnchainTokenFacts(
      fakeReader("0xef", [
        ok("name", "Odd"),
        ok("symbol", "ODD"),
        ok("decimals", 40),
        ok("totalSupply", 5n),
        bool(true),
      ]),
      { chainId: 8453, address: WORTH },
    );
    expect(facts.issues).toContain("UNEXPECTED_DECIMALS");
    expect(facts.decimals).toBeNull();
  });

  it("strips control characters from on-chain names", async () => {
    const facts = await readOnchainTokenFacts(
      fakeReader("0x60", [
        ok("name", "Fake\u202e\u0000Coin"),
        reverted,
        ok("decimals", 18),
        ok("totalSupply", 1n),
        reverted,
      ]),
      { chainId: 8453, address: WORTH },
    );
    expect(facts.name).toBe("FakeCoin");
    expect(facts.missing).toEqual(["symbol"]);
    expect(facts.issues).toEqual(["PARTIAL_ERC20"]);
    expect(facts.standard).toBe("erc20");
  });

  it("raises an RPC error on timeouts and failures, never a guess", async () => {
    const error = await readOnchainTokenFacts(
      rpcClient((method) =>
        method === "eth_chainId" ? new Error("timeout") : undefined,
      ),
      { chainId: 8453, address: WORTH },
    ).catch((e) => e);
    expect(error).toBeInstanceOf(OnchainReadError);
    expect(error.code).toBe("RPC_FAILED");
    const failed = await readOnchainTokenFacts(
      rpcClient((method) =>
        method === "eth_call" ? new Error("HTTP 503") : undefined,
      ),
      { chainId: 8453, address: WORTH },
    ).catch((e) => e);
    expect(failed.code).toBe("RPC_FAILED");
  });

  it("rejects an invalid address before any request", async () => {
    let requests = 0;
    const error = await readOnchainTokenFacts(
      rpcClient(() => {
        requests += 1;
        return undefined;
      }),
      { chainId: 8453, address: "0x123" as Address },
    ).catch((e) => e);
    expect(error.code).toBe("INVALID_ADDRESS");
    expect(requests).toBe(0);
  });

  it("decodes the B20 variant from byte 10 of the address", () => {
    expect(b20VariantFromAddress(WORTH)).toBe("asset");
    expect(
      b20VariantFromAddress("0xB200000000000000000001585fd80C20af698f01"),
    ).toBe("stablecoin");
  });
});
