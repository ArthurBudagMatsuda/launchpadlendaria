// Mock wallet and Base RPC for the browser tests of the unified app. Adapted
// from examples/web3-playground/e2e/fixtures.ts (Stage 2) so the app and the
// playground exercise the module with the same simulated wallet.
import { test as base, expect, type Page } from "@playwright/test";
import {
  type Address,
  decodeFunctionData,
  encodeFunctionResult,
  getAddress,
  type Hex,
  multicall3Abi,
  numberToHex,
} from "viem";
import {
  answerTokenCall,
  marketFetch,
  WORTH,
} from "../tests/fixtures/market-responses";

export const ALICE = getAddress("0x84a2c0b2e6dc6e1f2c3a4b5d6e7f8091a2b33f91");
export const BOB = getAddress("0x1111111111111111111111111111111111111111");

export interface WalletSetup {
  accounts?: Address[];
  chainId?: number;
  rejectConnect?: boolean;
  rejectSwitch?: boolean;
  /** Confirm a network switch, then go back to the previous chain, like Phantom does. */
  revertSwitch?: boolean;
  /** Never answer the connection request, like Phantom on a Solana-only account. */
  ignoreConnect?: boolean;
}

/**
 * Browser-side mock wallet: an EIP-1193 provider exposed both as
 * window.ethereum and through EIP-6963, like a real extension. Authorization
 * survives reloads via sessionStorage so session restore can be tested.
 */
function installMockWallet(setup: Required<WalletSetup>) {
  const KEY = "__retryMockWallet";
  const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as {
    authorized: boolean;
    chainId: number;
    accounts: string[];
  } | null;
  const state = {
    accounts: saved?.accounts ?? setup.accounts,
    chainId: saved?.chainId ?? setup.chainId,
    authorized: saved?.authorized ?? false,
    rejectConnect: setup.rejectConnect,
    rejectSwitch: setup.rejectSwitch,
    revertSwitch: setup.revertSwitch,
    ignoreConnect: setup.ignoreConnect,
    calls: [] as string[],
  };
  const persist = () =>
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        authorized: state.authorized,
        chainId: state.chainId,
        accounts: state.accounts,
      }),
    );
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const emit = (event: string, ...args: unknown[]) => {
    for (const listener of listeners[event] ?? []) listener(...args);
  };
  const hex = (value: number) => `0x${value.toString(16)}`;
  const rpcError = (code: number, message: string) =>
    Object.assign(new Error(message), { code });

  const provider = {
    async request({ method, params }: { method: string; params?: unknown[] }) {
      state.calls.push(method);
      switch (method) {
        case "eth_chainId":
          return hex(state.chainId);
        case "net_version":
          return String(state.chainId);
        case "eth_accounts":
          return state.authorized ? state.accounts : [];
        case "eth_requestAccounts":
        case "wallet_requestPermissions":
          if (state.rejectConnect)
            throw rpcError(4001, "User rejected the request.");
          if (state.ignoreConnect) return new Promise(() => {});
          state.authorized = true;
          persist();
          return method === "eth_requestAccounts"
            ? state.accounts
            : [
                {
                  parentCapability: "eth_accounts",
                  caveats: [
                    { type: "restrictReturnedAccounts", value: state.accounts },
                  ],
                },
              ];
        case "wallet_revokePermissions":
          state.authorized = false;
          persist();
          return null;
        case "wallet_switchEthereumChain": {
          if (state.rejectSwitch)
            throw rpcError(4001, "User rejected the request.");
          const target = Number((params?.[0] as { chainId: string }).chainId);
          const previous = state.chainId;
          state.chainId = target;
          persist();
          emit("chainChanged", hex(target));
          if (state.revertSwitch)
            setTimeout(() => {
              state.chainId = previous;
              persist();
              emit("chainChanged", hex(previous));
            }, 5);
          return null;
        }
        default:
          throw rpcError(4200, `Unsupported method ${method}`);
      }
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      listeners[event] = [...(listeners[event] ?? []), listener];
    },
    removeListener(event: string, listener: (...args: unknown[]) => void) {
      listeners[event] = (listeners[event] ?? []).filter(
        (item) => item !== listener,
      );
    },
  };

  Object.assign(window, {
    ethereum: provider,
    __retryMockWallet: {
      state,
      changeChain(chainId: number) {
        state.chainId = chainId;
        persist();
        emit("chainChanged", hex(chainId));
      },
      changeAccounts(accounts: string[]) {
        state.accounts = accounts;
        persist();
        emit("accountsChanged", accounts);
      },
      endSession() {
        state.authorized = false;
        persist();
        emit("accountsChanged", []);
      },
    },
  });

  const info = {
    uuid: "6f1c2b8e-7d3a-4c1e-9b2f-0a5d4e3c2b1a",
    name: "Retry Test Wallet",
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"%3E%3Crect width="32" height="32" rx="8" fill="%23845ef7"/%3E%3C/svg%3E',
    rdns: "io.retry.testwallet",
  };
  const announce = () =>
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: Object.freeze({ info, provider }),
      }),
    );
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
}

export interface RpcMock {
  /** Wei balances per chain and lowercase address. */
  balances: Record<number, Record<string, bigint>>;
  /** Raw balances of the tracked Base token per lowercase owner (Base mainnet). */
  tokenBalances: Record<string, bigint>;
  /** When set, every RPC call answers with this HTTP status. */
  failStatus: number | undefined;
  calls: { chainId: number; method: string }[];
}

const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11";

/**
 * Multicall3 answers: native balances (getEthBalance) and, on Base mainnet,
 * the tracked token's ERC-20 and B20 reads, like the real chain on 2026-10-28.
 */
function answerMulticall(
  data: Hex,
  balanceOf: (address: Address) => bigint,
  tokenBalanceOf: (owner: Address) => bigint,
): Hex {
  const decoded = decodeFunctionData({ abi: multicall3Abi, data });
  if (decoded.functionName === "getEthBalance") {
    const [address] = decoded.args as readonly [Address];
    return encodeFunctionResult({
      abi: multicall3Abi,
      functionName: "getEthBalance",
      result: balanceOf(address),
    });
  }
  const [calls] = decoded.args as readonly [
    readonly { target: Address; callData: Hex }[],
  ];
  return encodeFunctionResult({
    abi: multicall3Abi,
    functionName: "aggregate3",
    result: calls.map(({ target, callData }) =>
      target.toLowerCase() === MULTICALL3
        ? {
            success: true,
            returnData: answerMulticall(callData, balanceOf, tokenBalanceOf),
          }
        : answerTokenCall(target, callData, tokenBalanceOf),
    ),
  });
}

const RPC_HOSTS: Record<string, number> = {
  "sepolia.base.org": 84532,
  "mainnet.base.org": 8453,
};

async function mockRpc(page: Page, rpc: RpcMock) {
  await page.route(/^https:\/\/(sepolia|mainnet)\.base\.org/, async (route) => {
    const chainId = RPC_HOSTS[new URL(route.request().url()).hostname] ?? 0;
    if (rpc.failStatus)
      return route.fulfill({ status: rpc.failStatus, body: "unavailable" });
    const payload = route.request().postDataJSON() as
      | { id: number; method: string; params: unknown[] }
      | { id: number; method: string; params: unknown[] }[];
    const answer = ({
      id,
      method,
      params,
    }: {
      id: number;
      method: string;
      params: unknown[];
    }) => {
      rpc.calls.push({ chainId, method });
      const balanceOf = (address: Address) =>
        rpc.balances[chainId]?.[address.toLowerCase()] ?? 0n;
      // The tracked token exists on Base mainnet only (its Sepolia address is empty).
      const tokenBalanceOf = (owner: Address) =>
        chainId === 8453 ? (rpc.tokenBalances[owner.toLowerCase()] ?? 0n) : 0n;
      switch (method) {
        case "eth_chainId":
          return { jsonrpc: "2.0", id, result: numberToHex(chainId) };
        case "eth_blockNumber":
          return { jsonrpc: "2.0", id, result: "0x1234" };
        case "eth_getBalance":
          return {
            jsonrpc: "2.0",
            id,
            result: numberToHex(balanceOf(params[0] as Address)),
          };
        case "eth_getCode":
          // Base B20 tokens are precompiles: their code is the single byte 0xef.
          return {
            jsonrpc: "2.0",
            id,
            result:
              chainId === 8453 &&
              (params[0] as Address).toLowerCase() === WORTH.toLowerCase()
                ? "0xef"
                : "0x",
          };
        case "eth_call": {
          const { to, data } = params[0] as { to: Address; data: Hex };
          if (to.toLowerCase() === MULTICALL3)
            return {
              jsonrpc: "2.0",
              id,
              result: answerMulticall(data, balanceOf, tokenBalanceOf),
            };
          const direct =
            chainId === 8453 ? answerTokenCall(to, data, tokenBalanceOf) : null;
          return direct?.success
            ? { jsonrpc: "2.0", id, result: direct.returnData }
            : {
                jsonrpc: "2.0",
                id,
                error: { code: 3, message: "execution reverted", data: "0x" },
              };
        }
        default:
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: "method not found" },
          };
      }
    };
    const body = Array.isArray(payload) ? payload.map(answer) : answer(payload);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

export interface MarketMock {
  /** Per provider: when set, every request answers with this HTTP status. */
  failStatus: { geckoterminal?: number; dexscreener?: number };
  /** Requested provider URLs (host + path + query). */
  calls: string[];
}

const MARKET_HOSTS: Record<string, keyof MarketMock["failStatus"]> = {
  "api.geckoterminal.com": "geckoterminal",
  "api.dexscreener.com": "dexscreener",
};

/**
 * GeckoTerminal and DEX Screener answer from the recorded responses in
 * tests/fixtures (the same ones the unit tests use), with the CORS header the
 * live APIs send, so the static export's client-side fetches run unchanged.
 */
async function mockMarket(page: Page, market: MarketMock) {
  const answers = marketFetch();
  await page.route(
    /^https:\/\/api\.(geckoterminal|dexscreener)\.com\//,
    async (route) => {
      const url = new URL(route.request().url());
      market.calls.push(`${url.hostname}${url.pathname}${url.search}`);
      const headers = { "access-control-allow-origin": "*" };
      const failStatus = market.failStatus[MARKET_HOSTS[url.hostname]];
      if (failStatus)
        return route.fulfill({ status: failStatus, headers, body: "{}" });
      const response = await answers.fetch(url.toString());
      return route.fulfill({
        status: response.status,
        headers,
        contentType: "application/json",
        body: await response.text(),
      });
    },
  );
}

export const test = base.extend<{
  wallet: (setup?: WalletSetup) => Promise<void>;
  rpc: RpcMock;
  market: MarketMock;
  externalRequests: string[];
}>({
  externalRequests: [
    async ({ page }, use) => {
      const external: string[] = [];
      // Keep tests hermetic: anything that is not the app, the mocked RPC or
      // the mocked market providers is blocked and recorded.
      await page.route(
        (url) =>
          ![
            "localhost",
            "127.0.0.1",
            "sepolia.base.org",
            "mainnet.base.org",
            ...Object.keys(MARKET_HOSTS),
          ].includes(url.hostname),
        (route) => {
          external.push(new URL(route.request().url()).hostname);
          return route.abort();
        },
      );
      await use(external);
    },
    { auto: true },
  ],
  market: [
    async ({ page, externalRequests: _blocked }, use) => {
      const market: MarketMock = { failStatus: {}, calls: [] };
      await mockMarket(page, market);
      await use(market);
    },
    { auto: true },
  ],
  // Automatic, because Discover reads the tracked token from Base mainnet on load.
  rpc: [
    async ({ page, externalRequests: _blocked }, use) => {
      const rpc: RpcMock = {
        balances: {
          84532: {
            [ALICE.toLowerCase()]: 23_400_000_000_000_000n,
            [BOB.toLowerCase()]: 2n * 10n ** 18n,
          },
          8453: { [ALICE.toLowerCase()]: 5n * 10n ** 18n },
        },
        // 18,985.365382667 worth on Base mainnet.
        tokenBalances: {
          [ALICE.toLowerCase()]: 18_985_365_382_667n * 10n ** 9n,
        },
        failStatus: undefined,
        calls: [],
      };
      await mockRpc(page, rpc);
      await use(rpc);
    },
    { auto: true },
  ],
  wallet: async ({ page, rpc: _rpc }, use) => {
    await use(async (setup = {}) => {
      await page.addInitScript(installMockWallet, {
        accounts: setup.accounts ?? [ALICE, BOB],
        chainId: setup.chainId ?? 84532,
        rejectConnect: setup.rejectConnect ?? false,
        rejectSwitch: setup.rejectSwitch ?? false,
        revertSwitch: setup.revertSwitch ?? false,
        ignoreConnect: setup.ignoreConnect ?? false,
      });
    });
  },
});

export { expect };

export const short = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

/** GitHub Pages serves the app under the repository name. */
export const APP = "/launchpadlendaria";

/** The tracked Base token's statically exported page. */
export const TOKEN_PAGE = `${APP}/token/base/${WORTH.toLowerCase()}/`;
export { WORTH };

/** Errors from the page itself; requests the hermetic setup blocks on purpose are ignored. */
export function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Failed to load resource: net::ERR_FAILED/.test(text)) return;
    errors.push(`${text} (${message.location().url})`);
  });
  return errors;
}

export async function connectTestWallet(page: Page) {
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Connect Wallet" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Connect Wallet" });
  await dialog.getByRole("button", { name: /Retry Test Wallet/ }).click();
  await expect(dialog).toBeHidden();
}

/** Desktop uses the header links; phones open the navigation menu first. */
export async function navigate(
  page: Page,
  label: "Discover" | "Create" | "Portfolio",
) {
  const banner = page.getByRole("banner");
  const desktop = banner.getByRole("navigation", { name: "Main navigation" });
  if (await desktop.isVisible()) {
    await desktop.getByRole("link", { name: label }).click();
  } else {
    await banner.getByRole("button", { name: "Open navigation" }).click();
    await banner
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: label })
      .click();
  }
}
