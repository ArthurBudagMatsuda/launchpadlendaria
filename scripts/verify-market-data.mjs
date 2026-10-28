// Live, read-only evidence for the featured token: chain ID, deployed
// bytecode, ERC-20 metadata, proxy slots and what the public market-data
// providers know about it. It only sends eth_* reads and HTTP GETs; it never
// signs or sends anything. Run by .github/workflows/market-data-verify.yml
// (GitHub runners can reach Base RPC and the providers) or locally:
//   node scripts/verify-market-data.mjs [address]
// Writes the evidence to market-data-verification.json and prints it.
import { writeFile } from "node:fs/promises";
import {
  createPublicClient,
  erc20Abi,
  getAddress,
  hexToBigInt,
  http,
  isAddress,
  keccak256,
  parseAbi,
  toHex,
} from "viem";
import { base, baseSepolia } from "viem/chains";

const input =
  process.argv[2] ??
  process.env.RETRY_VERIFY_ADDRESS ??
  "0xb200000000000000000000585fd80c20af698f01";
const ORIGIN = "https://arthurbudagmatsuda.github.io";
const report = {
  input,
  startedAt: new Date().toISOString(),
  address: {},
  chains: {},
  providers: {},
};

function safe(value) {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}
async function attempt(fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.shortMessage ?? error?.message ?? error).slice(
        0,
        400,
      ),
    };
  }
}

report.address.syntaxValid = isAddress(input, { strict: false });
report.address.checksummed = report.address.syntaxValid
  ? getAddress(input)
  : null;
if (!report.address.syntaxValid) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
const address = getAddress(input);

const EIP1967_IMPLEMENTATION =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const EIP1967_ADMIN =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const EIP1967_BEACON =
  "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const slotAddress = (word) =>
  word && hexToBigInt(word) !== 0n ? getAddress(`0x${word.slice(-40)}`) : null;

async function inspectChain(chain, rpcUrl) {
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 15_000, retryCount: 2 }),
  });
  const result = { rpc: rpcUrl };
  result.chainId = await attempt(() => client.getChainId());
  result.blockNumber = await attempt(() => client.getBlockNumber());
  const code = await attempt(() => client.getCode({ address }));
  result.code = code.ok
    ? {
        ok: true,
        bytes: code.value ? (code.value.length - 2) / 2 : 0,
        prefix: code.value ? code.value.slice(0, 66) : null,
        keccak: code.value ? keccak256(code.value) : null,
        isEip1167: code.value
          ? /^0x363d3d373d3d3d363d73[0-9a-f]{40}5af43d82803e903d91602b57fd5bf3$/i.test(
              code.value,
            )
          : false,
      }
    : code;
  result.balanceWei = await attempt(() => client.getBalance({ address }));
  result.nonce = await attempt(() => client.getTransactionCount({ address }));
  const slots = {};
  for (const [name, slot] of Object.entries({
    implementation: EIP1967_IMPLEMENTATION,
    admin: EIP1967_ADMIN,
    beacon: EIP1967_BEACON,
  })) {
    const word = await attempt(() => client.getStorageAt({ address, slot }));
    slots[name] = word.ok ? slotAddress(word.value) : word;
  }
  result.eip1967 = slots;
  const erc20 = {};
  for (const functionName of ["name", "symbol", "decimals", "totalSupply"]) {
    erc20[functionName] = await attempt(() =>
      client.readContract({ address, abi: erc20Abi, functionName }),
    );
  }
  // A zero-address balance and allowance probe the rest of the interface.
  erc20.balanceOfZero = await attempt(() =>
    client.readContract({
      address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: ["0x0000000000000000000000000000000000000000"],
    }),
  );
  // Raw eth_call results, in case a token returns non-standard encodings.
  const raw = {};
  for (const [name, selector] of Object.entries({
    name: "0x06fdde03",
    symbol: "0x95d89b41",
    decimals: "0x313ce567",
    totalSupply: "0x18160ddd",
    owner: "0x8da5cb5b",
    supportsInterfaceErc165: `0x01ffc9a7${"01ffc9a7".padEnd(64, "0")}`,
  })) {
    raw[name] = await attempt(() =>
      client.request({
        method: "eth_call",
        params: [{ to: address, data: selector }, "latest"],
      }),
    );
  }
  erc20.raw = raw;
  result.erc20 = erc20;
  // Base B20 tokens (Beryl upgrade) are Rust precompiles created by the
  // factory below, so their eth_getCode result is not proof either way.
  const b20Factory = "0xB20f000000000000000000000000000000000000";
  const b20Abi = parseAbi([
    "function isB20(address token) view returns (bool)",
    "function isB20Initialized(address token) view returns (bool)",
  ]);
  result.b20 = {
    factory: b20Factory,
    factoryCode: await attempt(async () => {
      const code = await client.getCode({ address: b20Factory });
      return code ? (code.length - 2) / 2 : 0;
    }),
    isB20: await attempt(() =>
      client.readContract({
        address: b20Factory,
        abi: b20Abi,
        functionName: "isB20",
        args: [address],
      }),
    ),
    isB20Initialized: await attempt(() =>
      client.readContract({
        address: b20Factory,
        abi: b20Abi,
        functionName: "isB20Initialized",
        args: [address],
      }),
    ),
    variantByte: `0x${address.slice(22, 24)}`,
    contractURI: await attempt(() =>
      client.readContract({
        address,
        abi: parseAbi(["function contractURI() view returns (string)"]),
        functionName: "contractURI",
      }),
    ),
  };
  // Recent Transfer logs (last ~2,000 blocks) show whether the token moves.
  if (result.blockNumber.ok) {
    const toBlock = result.blockNumber.value;
    const transferTopic = keccak256(toHex("Transfer(address,address,uint256)"));
    const logs = await attempt(() =>
      client.request({
        method: "eth_getLogs",
        params: [
          {
            address,
            fromBlock: toHex(toBlock - 2000n),
            toBlock: toHex(toBlock),
            topics: [transferTopic],
          },
        ],
      }),
    );
    result.recentTransferLogs = logs.ok
      ? {
          ok: true,
          count: logs.value.length,
          window: "last 2000 blocks",
          sample: logs.value.slice(-3).map((l) => ({
            blockNumber: hexToBigInt(l.blockNumber).toString(),
            transactionHash: l.transactionHash,
          })),
        }
      : logs;
  }
  return result;
}

report.chains.base = await inspectChain(
  base,
  process.env.BASE_RPC_URL || "https://mainnet.base.org",
);
report.chains.baseSepolia = await inspectChain(
  baseSepolia,
  process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
);
for (const [key, rpc] of Object.entries({
  ethereum: "https://ethereum-rpc.publicnode.com",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
})) {
  const code = await attempt(() =>
    createPublicClient({ transport: http(rpc, { timeout: 15_000 }) }).getCode({
      address,
    }),
  );
  report.chains[key] = code.ok
    ? { rpc, codeBytes: code.value ? (code.value.length - 2) / 2 : 0 }
    : { rpc, ...code };
}

async function getJson(url, headers = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", Origin: ORIGIN, ...headers },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 300);
    }
    const pick = [
      "access-control-allow-origin",
      "access-control-allow-headers",
      "cache-control",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "ratelimit-limit",
      "ratelimit-remaining",
      "retry-after",
      "content-type",
    ];
    return {
      url,
      status: response.status,
      ms: Date.now() - started,
      headers: Object.fromEntries(
        pick
          .map((h) => [h, response.headers.get(h)])
          .filter(([, v]) => v !== null),
      ),
      body,
    };
  } catch (error) {
    return { url, error: String(error?.message ?? error) };
  }
}

const lower = address.toLowerCase();
// DEX Screener: public, no key.
const ds = await getJson(
  `https://api.dexscreener.com/latest/dex/tokens/${address}`,
);
const dsPairs = Array.isArray(ds.body?.pairs) ? ds.body.pairs : [];
report.providers.dexscreenerTokens = {
  ...ds,
  body: undefined,
  pairCount: dsPairs.length,
  pairs: dsPairs.map((p) => ({
    chainId: p.chainId,
    dexId: p.dexId,
    labels: p.labels,
    pairAddress: p.pairAddress,
    baseToken: p.baseToken,
    quoteToken: p.quoteToken,
    priceNative: p.priceNative,
    priceUsd: p.priceUsd,
    liquidity: p.liquidity,
    volume: p.volume,
    priceChange: p.priceChange,
    txns: p.txns,
    fdv: p.fdv,
    marketCap: p.marketCap,
    pairCreatedAt: p.pairCreatedAt,
    imageUrl: p.info?.imageUrl,
    websites: p.info?.websites,
    socials: p.info?.socials,
    url: p.url,
  })),
};
const dsTop = [...dsPairs]
  .filter((p) => p.baseToken?.address?.toLowerCase() === lower)
  .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
if (dsTop) {
  const pair = await getJson(
    `https://api.dexscreener.com/latest/dex/pairs/base/${dsTop.pairAddress}`,
  );
  report.providers.dexscreenerPair = {
    ...pair,
    body: undefined,
    pairs: Array.isArray(pair.body?.pairs)
      ? pair.body.pairs.map((p) => ({
          pairAddress: p.pairAddress,
          priceUsd: p.priceUsd,
          liquidity: p.liquidity,
        }))
      : pair.body,
  };
}
const dsV1 = await getJson(
  `https://api.dexscreener.com/tokens/v1/base/${address}`,
);
report.providers.dexscreenerTokensV1 = {
  ...dsV1,
  body: Array.isArray(dsV1.body)
    ? dsV1.body.map((p) => ({
        chainId: p.chainId,
        dexId: p.dexId,
        pairAddress: p.pairAddress,
        quote: p.quoteToken?.symbol,
        liquidityUsd: p.liquidity?.usd,
      }))
    : dsV1.body,
};

// GeckoTerminal: public API v2, no key.
const gtHeaders = { Accept: "application/json;version=20230203" };
const gtToken = await getJson(
  `https://api.geckoterminal.com/api/v2/networks/base/tokens/${lower}`,
  gtHeaders,
);
report.providers.geckoterminalToken = {
  ...gtToken,
  body: gtToken.body?.data
    ? { id: gtToken.body.data.id, attributes: gtToken.body.data.attributes }
    : gtToken.body,
};
const gtPools = await getJson(
  `https://api.geckoterminal.com/api/v2/networks/base/tokens/${lower}/pools?page=1`,
  gtHeaders,
);
const pools = Array.isArray(gtPools.body?.data) ? gtPools.body.data : [];
report.providers.geckoterminalPools = {
  ...gtPools,
  body: Array.isArray(gtPools.body?.data) ? undefined : gtPools.body,
  poolCount: pools.length,
  pools: pools.map((p) => ({
    id: p.id,
    address: p.attributes?.address,
    name: p.attributes?.name,
    dex: p.relationships?.dex?.data?.id,
    baseToken: p.relationships?.base_token?.data?.id,
    quoteToken: p.relationships?.quote_token?.data?.id,
    base_token_price_usd: p.attributes?.base_token_price_usd,
    base_token_price_quote_token: p.attributes?.base_token_price_quote_token,
    reserve_in_usd: p.attributes?.reserve_in_usd,
    volume_usd: p.attributes?.volume_usd,
    price_change_percentage: p.attributes?.price_change_percentage,
    transactions: p.attributes?.transactions,
    fdv_usd: p.attributes?.fdv_usd,
    market_cap_usd: p.attributes?.market_cap_usd,
    pool_created_at: p.attributes?.pool_created_at,
  })),
};
// CORS preflight for the versioned Accept header used by browsers.
try {
  const preflight = await fetch(
    `https://api.geckoterminal.com/api/v2/networks/base/tokens/${lower}`,
    {
      method: "OPTIONS",
      headers: {
        Origin: ORIGIN,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "accept",
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  report.providers.geckoterminalPreflight = {
    status: preflight.status,
    allowOrigin: preflight.headers.get("access-control-allow-origin"),
    allowHeaders: preflight.headers.get("access-control-allow-headers"),
    allowMethods: preflight.headers.get("access-control-allow-methods"),
  };
} catch (error) {
  report.providers.geckoterminalPreflight = { error: String(error) };
}

// OHLCV and trades for the most liquid GeckoTerminal pool, if any.
const topPool = [...pools].sort(
  (a, b) =>
    Number(b.attributes?.reserve_in_usd ?? 0) -
    Number(a.attributes?.reserve_in_usd ?? 0),
)[0];
if (topPool?.attributes?.address) {
  const poolAddress = topPool.attributes.address;
  const ohlcv = {};
  for (const [label, timeframe, aggregate] of [
    ["5m", "minute", 5],
    ["15m", "minute", 15],
    ["1h", "hour", 1],
    ["4h", "hour", 4],
    ["1d", "day", 1],
  ]) {
    const r = await getJson(
      `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=300&currency=usd&token=${lower}`,
      gtHeaders,
    );
    const list = r.body?.data?.attributes?.ohlcv_list;
    ohlcv[label] = {
      status: r.status,
      error: r.error,
      headers: r.headers,
      candles: Array.isArray(list) ? list.length : null,
      first: Array.isArray(list) ? list[list.length - 1] : null,
      last: Array.isArray(list) ? list[0] : null,
      meta: r.body?.meta,
      bodyIfError: Array.isArray(list) ? undefined : r.body,
    };
    await new Promise((resolve) => setTimeout(resolve, 2_500));
  }
  report.providers.geckoterminalOhlcv = { pool: poolAddress, ohlcv };
  const trades = await getJson(
    `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddress}/trades?token=${lower}`,
    gtHeaders,
  );
  const list = Array.isArray(trades.body?.data) ? trades.body.data : [];
  report.providers.geckoterminalTrades = {
    status: trades.status,
    error: trades.error,
    count: list.length,
    sample: list.slice(0, 3).map((t) => t.attributes),
  };
}

// Blockscout: explorer metadata (verification, holders) without an API key.
const bsToken = await getJson(
  `https://base.blockscout.com/api/v2/tokens/${address}`,
);
report.providers.blockscoutToken = bsToken;
const bsAddress = await getJson(
  `https://base.blockscout.com/api/v2/addresses/${address}`,
);
report.providers.blockscoutAddress = {
  ...bsAddress,
  body:
    bsAddress.body && typeof bsAddress.body === "object"
      ? {
          is_contract: bsAddress.body.is_contract,
          is_verified: bsAddress.body.is_verified,
          name: bsAddress.body.name,
          proxy_type: bsAddress.body.proxy_type,
          implementations: bsAddress.body.implementations,
          creator_address_hash: bsAddress.body.creator_address_hash,
          creation_transaction_hash:
            bsAddress.body.creation_transaction_hash ??
            bsAddress.body.creation_tx_hash,
          token: bsAddress.body.token,
        }
      : bsAddress.body,
};
const bsContract = await getJson(
  `https://base.blockscout.com/api/v2/smart-contracts/${address}`,
);
report.providers.blockscoutContract = {
  ...bsContract,
  body:
    bsContract.body && typeof bsContract.body === "object"
      ? {
          name: bsContract.body.name,
          is_verified: bsContract.body.is_verified,
          compiler_version: bsContract.body.compiler_version,
          language: bsContract.body.language,
          proxy_type: bsContract.body.proxy_type,
          implementations: bsContract.body.implementations,
          sourceHead: String(bsContract.body.source_code ?? "").slice(0, 1500),
        }
      : bsContract.body,
};

report.finishedAt = new Date().toISOString();
const json = JSON.stringify(safe(report), null, 2);
await writeFile("market-data-verification.json", json);
console.log(json);
