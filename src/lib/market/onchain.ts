import {
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  multicall3Abi,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import type { TokenRef } from "./types";
import { asLabel } from "./validate";

/**
 * Read-only checks that an address is a token on the expected chain, through
 * the app's own RPC transports (never the wallet). Base B20 tokens (Beryl
 * upgrade) are Rust precompiles: eth_getCode returns the single byte 0xef, so
 * the B20 factory's isB20/isB20Initialized answer is checked before treating
 * missing bytecode as "no contract".
 */
export const B20_FACTORY: Address =
  "0xB20f000000000000000000000000000000000000";
export const B20_CHAIN_IDS: readonly number[] = [8453, 84532];
export const b20FactoryAbi = parseAbi([
  "function isB20(address token) view returns (bool)",
  "function isB20Initialized(address token) view returns (bool)",
]);

/** Multicall3, deployed at the same address on Base and Base Sepolia. */
export const MULTICALL3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

export type OnchainReader = Pick<
  PublicClient,
  "getChainId" | "getCode" | "readContract"
>;

export type OnchainVerdict = "token" | "no-code" | "not-erc20" | "wrong-chain";
type Erc20Field = "name" | "symbol" | "decimals" | "totalSupply";

export interface OnchainTokenFacts {
  token: TokenRef;
  verdict: OnchainVerdict;
  /** The chain the RPC endpoint reported. */
  rpcChainId: number;
  standard: "b20" | "erc20" | null;
  b20Variant: "asset" | "stablecoin" | "unknown" | null;
  codeBytes: number;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: bigint | null;
  /** ERC-20 reads that reverted or returned malformed values. */
  missing: Erc20Field[];
  issues: ("UNEXPECTED_DECIMALS" | "PARTIAL_ERC20")[];
  retrievedAt: number;
}

export class OnchainReadError extends Error {
  readonly code: "INVALID_ADDRESS" | "RPC_FAILED";
  constructor(code: OnchainReadError["code"], cause?: unknown) {
    super(
      code === "INVALID_ADDRESS"
        ? "Not a valid EVM address."
        : "The Base RPC request failed. No token data is shown.",
      { cause },
    );
    this.name = "OnchainReadError";
    this.code = code;
  }
}

/** Byte 10 of a B20 address encodes the variant (Base B20 spec). */
export function b20VariantFromAddress(address: Address) {
  const byte = address.slice(22, 24).toLowerCase();
  return byte === "00" ? "asset" : byte === "01" ? "stablecoin" : "unknown";
}

export async function readOnchainTokenFacts(
  client: OnchainReader,
  token: TokenRef,
): Promise<OnchainTokenFacts> {
  if (!isAddress(token.address, { strict: false }))
    throw new OnchainReadError("INVALID_ADDRESS");
  const address = getAddress(token.address);
  const base = {
    token: { chainId: token.chainId, address },
    standard: null,
    b20Variant: null,
    codeBytes: 0,
    name: null,
    symbol: null,
    decimals: null,
    totalSupply: null,
    missing: [] as Erc20Field[],
    issues: [] as OnchainTokenFacts["issues"],
  } satisfies Partial<OnchainTokenFacts>;
  let rpcChainId: number;
  try {
    rpcChainId = await client.getChainId();
  } catch (error) {
    throw new OnchainReadError("RPC_FAILED", error);
  }
  if (rpcChainId !== token.chainId)
    return {
      ...base,
      verdict: "wrong-chain",
      rpcChainId,
      retrievedAt: Date.now(),
    };

  // One Multicall3 aggregate3 request with per-call failure allowed: a
  // reverting read means "not implemented", while a failed request means the
  // RPC is down. (viem's multicall helper folds both into per-call failures.)
  // On chains without B20 the factory call simply reverts.
  const withB20 = B20_CHAIN_IDS.includes(token.chainId);
  const calls = [
    { target: address, abi: erc20Abi, functionName: "name" },
    { target: address, abi: erc20Abi, functionName: "symbol" },
    { target: address, abi: erc20Abi, functionName: "decimals" },
    { target: address, abi: erc20Abi, functionName: "totalSupply" },
    {
      target: B20_FACTORY,
      abi: b20FactoryAbi,
      functionName: "isB20Initialized",
      args: [address],
    },
  ] as const;
  let code: Hex | undefined;
  let answers: readonly { success: boolean; returnData: Hex }[];
  try {
    [code, answers] = await Promise.all([
      client.getCode({ address }),
      client.readContract({
        address: MULTICALL3,
        abi: multicall3Abi,
        functionName: "aggregate3",
        args: [
          calls.map((call) => ({
            target: call.target,
            allowFailure: true,
            callData: encodeFunctionData(call as never),
          })),
        ],
      }),
    ]);
  } catch (error) {
    throw new OnchainReadError("RPC_FAILED", error);
  }
  const codeBytes = code && code !== "0x" ? (code.length - 2) / 2 : 0;
  const value = (i: number): unknown => {
    const answer = answers[i];
    if (!answer?.success || answer.returnData === "0x") return undefined;
    try {
      return decodeFunctionResult({
        abi: calls[i].abi,
        functionName: calls[i].functionName,
        data: answer.returnData,
      } as never);
    } catch {
      return undefined;
    }
  };
  const isB20 = withB20 && value(4) === true;

  const name = asLabel(value(0), 80);
  const symbol = asLabel(value(1), 24);
  const rawDecimals = value(2);
  const decimals =
    typeof rawDecimals === "number" && Number.isInteger(rawDecimals)
      ? rawDecimals
      : null;
  const supply = value(3);
  const totalSupply =
    typeof supply === "bigint" && supply >= 0n ? supply : null;
  const missing: Erc20Field[] = [];
  if (!name) missing.push("name");
  if (!symbol) missing.push("symbol");
  if (decimals === null) missing.push("decimals");
  if (totalSupply === null) missing.push("totalSupply");
  const issues: OnchainTokenFacts["issues"] = [];
  // B20 allows 6–18; anything above 36 cannot be a sane ERC-20.
  const decimalsOk =
    decimals !== null &&
    decimals <= 36 &&
    (!isB20 || (decimals >= 6 && decimals <= 18));
  if (decimals !== null && !decimalsOk) issues.push("UNEXPECTED_DECIMALS");
  if (missing.length > 0 && missing.length < 4) issues.push("PARTIAL_ERC20");

  const verdict: OnchainVerdict =
    codeBytes === 0 && !isB20
      ? "no-code"
      : missing.length === 4
        ? "not-erc20"
        : "token";
  return {
    ...base,
    verdict,
    rpcChainId,
    standard: verdict !== "token" ? null : isB20 ? "b20" : "erc20",
    b20Variant: isB20 ? b20VariantFromAddress(address) : null,
    codeBytes,
    name,
    symbol,
    decimals: decimalsOk ? decimals : null,
    totalSupply,
    missing,
    issues,
    retrievedAt: Date.now(),
  };
}
