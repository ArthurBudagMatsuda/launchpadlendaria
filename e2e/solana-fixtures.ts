import type { Page } from "@playwright/test";
import { getAddressEncoder, address } from "@solana/kit";
export const ALICE = "11111111111111111111111111111111";
export const BOB = "So11111111111111111111111111111111111111112";
export async function solanaFixture(
  page: Page,
  options: {
    name?: string;
    reject?: boolean;
    failRpc?: boolean;
    absent?: boolean;
    restore?: boolean;
    market?: boolean;
  } = {},
) {
  const calls: string[] = [];
  await page.route(
    /https:\/\/api\.(devnet|mainnet)\.solana\.com\/?$/,
    async (route) => {
      const body = route.request().postDataJSON();
      calls.push(body.method);
      if (options.failRpc)
        return route.fulfill({ status: 503, body: "Unavailable" });
      const mainnet = route.request().url().includes("mainnet");
      const result =
        body.method === "getGenesisHash"
          ? mainnet
            ? "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
            : "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
          : body.method === "getBalance"
            ? {
                context: { slot: 123 },
                value: mainnet
                  ? body.params[0] === ALICE
                    ? 3500000001
                    : 4500000000
                  : body.params[0] === ALICE
                    ? 1500000001
                    : 2500000000,
              }
            : body.method === "getAccountInfo"
              ? {
                  context: { slot: 123 },
                  value: {
                    owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                    lamports: 1461600,
                    executable: false,
                    rentEpoch: 0,
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
                }
              : null;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
      });
    },
  );
  await page.route(
    /https:\/\/api\.(geckoterminal|dexscreener)\.com\//,
    (route) => {
      if (options.market && route.request().url().includes("geckoterminal")) {
        const url = route.request().url();
        const time = Math.floor(Date.now() / 86400000) * 86400 - 86400;
        const payload = url.includes("/ohlcv/")
          ? {
              meta: { base: { address: ALICE } },
              data: {
                attributes: {
                  ohlcv_list: Array.from({ length: 20 }, (_, i) => [
                    time - i * 86400,
                    1,
                    3,
                    0.5,
                    2,
                    10,
                  ]),
                },
              },
            }
          : url.includes("/trades")
            ? {
                data: [
                  {
                    id: "test-swap",
                    attributes: {
                      tx_hash: "3".repeat(87),
                      kind: "buy",
                      to_token_address: ALICE,
                      from_token_address: BOB,
                      to_token_amount: "42",
                      price_to_in_usd: "2",
                      volume_in_usd: "84",
                      block_number: 123,
                      block_timestamp: new Date(time * 1000).toISOString(),
                    },
                  },
                ],
              }
            : {
                data: [
                  {
                    attributes: {
                      address: BOB,
                      base_token_price_usd: "2",
                      base_token_price_quote_token: "0.02",
                      reserve_in_usd: "20000",
                      volume_usd: { h24: "1000" },
                      transactions: { h24: { buys: 10, sells: 5 } },
                    },
                    relationships: {
                      base_token: { data: { id: `solana_${ALICE}` } },
                      quote_token: { data: { id: `solana_${BOB}` } },
                      dex: { data: { id: "raydium" } },
                    },
                  },
                ],
              };
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(payload),
        });
      }
      return route.fulfill({
        contentType: "application/json",
        body: route.request().url().includes("geckoterminal")
          ? '{"data":[]}'
          : "[]",
      });
    },
  );
  await page.addInitScript(
    ({ options, alice, bob, bBytes }) => {
      if (options.absent) return;
      if (options.restore)
        localStorage.setItem(
          "retry:solana:last-wallet:v1",
          options.name || "Phantom",
        );
      const listeners = new Set<(event: { accounts: unknown[] }) => void>();
      const account = (other = false) => ({
        address: other ? bob : alice,
        publicKey: other ? new Uint8Array(bBytes) : new Uint8Array(32),
        chains: ["solana:devnet", "solana:mainnet"],
        features: [],
      });
      const evidence = {
        connections: [] as boolean[],
        disconnects: 0,
        change: (other = true) =>
          listeners.forEach((listener) =>
            listener({ accounts: [account(other)] }),
          ),
        clear: () =>
          listeners.forEach((listener) => listener({ accounts: [] })),
      };
      Object.assign(window, { solanaTest: evidence });
      const wallet = {
        version: "1.0.0",
        name: options.name || "Phantom",
        icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a21sAAAAASUVORK5CYII=",
        chains: ["solana:devnet", "solana:mainnet"],
        accounts: [],
        features: {
          "standard:connect": {
            version: "1.0.0",
            connect: async ({ silent = false } = {}) => {
              evidence.connections.push(silent);
              if (options.reject) throw new Error("User rejected");
              return { accounts: [account()] };
            },
          },
          "standard:disconnect": {
            version: "1.0.0",
            disconnect: async () => {
              evidence.disconnects++;
            },
          },
          "standard:events": {
            version: "1.0.0",
            on: (
              _event: string,
              listener: (event: { accounts: unknown[] }) => void,
            ) => {
              listeners.add(listener);
              return () => listeners.delete(listener);
            },
          },
        },
      };
      window.addEventListener("wallet-standard:app-ready", ((
        event: CustomEvent<{ register: (wallet: unknown) => void }>,
      ) => event.detail.register(wallet)) as EventListener);
      window.dispatchEvent(
        new CustomEvent("wallet-standard:register-wallet", {
          detail: (api: { register: (wallet: unknown) => void }) =>
            api.register(wallet),
        }),
      );
    },
    {
      options,
      alice: ALICE,
      bob: BOB,
      bBytes: Array.from(getAddressEncoder().encode(address(BOB))),
    },
  );
  return calls;
}
