import { test, expect, type Page } from "@playwright/test";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";
import worker, { type KV } from "../../infra/metadata-worker/src/index";

// The whole RETRY flow in a real browser against a real validator running
// Meteora's programs: launch with a first buy, buy, sell, portfolio. Only two
// things are stand-ins, both outside RETRY's code: the wallet extension (a
// Wallet Standard wallet whose key signs in this test process) and
// Cloudflare (the metadata Worker runs in-process on an in-memory KV).
// The validator answers as Devnet: only its genesis hash is rewritten.

const RPC = process.env.RETRY_CHAIN_RPC ?? "http://127.0.0.1:8899";
const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const METADATA = "https://metadata.retry.test";
const root = "/launchpadlendaria";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAABlklEQVR4nA3L0QBAIQxA0RCGEMIQhjCEEIYwhBBC2McFCCGEEEJ47/yf1hrS6A1tWMMboxGNbMzGalRjN07jNl6jNUGELqhgggtDCCGFKSyhhC0c4QpP/tCRTu9oxzreGZ3oZGd2Vqc6u3M6t/P6HxRRuqKKKa4MJZRUprKUUrZylKs8/YMhRjfUMMONYYSRxjSWUcY2jnGNZ39wxOmOOua4M5xw0pnOcsrZznGu8/wPAxn0gQ5s4IMxiEEO5mANarAHZ3AHb/whkKAHGljgwQgiyGAGK6hgBye4wYs/JJL0RBNLPBlJJJnMZCWV7OQkN3n5h4lM+kQnNvHJmMQkJ3OyJjXZkzO5kzf/sJBFX+jCFr4Yi1jkYi7WohZ7cRZ38dYfCil6oYUVXowiiixmsYoqdnGKW7z6w0Y2faMb2/hmbGKTm7lZm9rszdnczdt/OMihH/RgBz+MQxzyMA/rUId9OId7eOcPF7n0i17s4pdxiUte5mVd6rIv53Iv7/7hIY/+0Ic9/DEe8cjHfKxHPfbjPO7jPT74o6QQdaP0PQAAAABJRU5ErkJggg==",
  "base64",
);

function memoryKv(): KV {
  const data = new Map<string, { value: ArrayBuffer; metadata: unknown }>();
  return {
    get: async (key) => data.get(key)?.value ?? null,
    getWithMetadata: async <M>(key: string) => ({
      value: data.get(key)?.value ?? null,
      metadata: (data.get(key)?.metadata as M) ?? null,
    }),
    put: async (key, value, options) =>
      void data.set(key, {
        value:
          typeof value === "string"
            ? (new TextEncoder().encode(value).buffer as ArrayBuffer)
            : value,
        metadata: options?.metadata ?? null,
      }),
  };
}

async function setup(page: Page, owner: Keypair) {
  const kv = memoryKv();
  const signed: string[] = [];
  await page.route(/127\.0\.0\.1:8899/, async (route) => {
    const body = route.request().postData() ?? "";
    const response = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const text = await response.text();
    const parsed = JSON.parse(body);
    type Rpc = { id?: unknown; method?: string; result?: unknown };
    const rewrite = (item: Rpc | undefined, answer: Rpc) =>
      item?.method === "getGenesisHash"
        ? { ...answer, result: DEVNET_GENESIS }
        : answer;
    const json = JSON.parse(text);
    const out = Array.isArray(parsed)
      ? json.map((answer: Rpc) =>
          rewrite(
            parsed.find((p: Rpc) => p.id === answer.id),
            answer,
          ),
        )
      : rewrite(parsed, json);
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(out),
    });
  });
  await page.route(/metadata\.retry\.test/, async (route) => {
    const request = route.request();
    const response = await worker.fetch(
      new Request(request.url(), {
        method: request.method(),
        headers: {
          ...request.headers(),
          origin: "http://127.0.0.1:4175",
          "cf-connecting-ip": "198.51.100.1",
        },
        body: request.method() === "POST" ? request.postData() : undefined,
      }),
      {
        METADATA: kv,
        PUBLIC_URL: METADATA,
        ALLOWED_ORIGINS: "http://127.0.0.1:4175",
        UPLOADS_PER_HOUR: "20",
      },
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  await page.exposeFunction("retryTestSign", (base64: string) => {
    const tx = Transaction.from(Buffer.from(base64, "base64"));
    tx.partialSign(owner);
    signed.push(tx.instructions.map((ix) => ix.programId.toBase58()).join(","));
    return tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64");
  });
  await page.addInitScript(
    ({ address, key }) => {
      const account = {
        address,
        publicKey: new Uint8Array(key),
        chains: ["solana:devnet"],
        features: ["solana:signTransaction"],
      };
      const sign = (
        window as unknown as { retryTestSign: (b: string) => Promise<string> }
      ).retryTestSign;
      const wallet = {
        version: "1.0.0",
        name: "RETRY Test Wallet",
        icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a21sAAAAASUVORK5CYII=",
        chains: ["solana:devnet"],
        accounts: [account],
        features: {
          "standard:connect": {
            version: "1.0.0",
            connect: async () => ({ accounts: [account] }),
          },
          "standard:disconnect": {
            version: "1.0.0",
            disconnect: async () => undefined,
          },
          "standard:events": { version: "1.0.0", on: () => () => undefined },
          "solana:signTransaction": {
            version: "1.0.0",
            supportedTransactionVersions: ["legacy"],
            signTransaction: async (...inputs: { transaction: Uint8Array }[]) =>
              Promise.all(
                inputs.map(async (input) => {
                  const encoded = btoa(
                    String.fromCharCode(...input.transaction),
                  );
                  const out = atob(await sign(encoded));
                  return {
                    signedTransaction: Uint8Array.from(out, (c) =>
                      c.charCodeAt(0),
                    ),
                  };
                }),
              ),
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
      address: owner.publicKey.toBase58(),
      key: Array.from(owner.publicKey.toBytes()),
    },
  );
  return signed;
}

test("launch, buy, sell and portfolio against Meteora's programs", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const owner = Keypair.generate();
  const connection = new Connection(RPC, "confirmed");
  const airdrop = await connection.requestAirdrop(
    owner.publicKey,
    5 * LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction({
    signature: airdrop,
    ...(await connection.getLatestBlockhash()),
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const signed = await setup(page, owner);

  await page.goto(`${root}/create/`);
  await page
    .locator("header")
    .getByRole("button", { name: "Connect Wallet" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "RETRY Test Wallet Available" })
    .click();
  await page.getByLabel("Close dialog").click();

  await page.locator("#name").fill("Browser Cat");
  await page.locator("#symbol").fill("BCAT");
  await page
    .locator("#description")
    .fill("Launched by the RETRY browser test on a local validator.");
  await page
    .locator("#token-image")
    .setInputFiles({ name: "cat.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Image added to your draft.")).toBeVisible();
  await page.getByRole("button", { name: /Continue to Preview/ }).click();
  await page.getByRole("button", { name: /Continue to Summary/ }).click();
  await page.locator("#initial-buy").fill("0.2");
  await page.getByRole("button", { name: /Review launch cost/ }).click();
  await expect(page.getByText("Simulated cost")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator(".cost-review")).toContainText("0.2 SOL");
  await page.screenshot({
    path: `test-results/chain-launch-review-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: /Sign & launch/ }).click();
  await expect(page.getByText("Launched.")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: /Open your token/ }).click();

  await expect(page.locator(".token-detail-heading")).toContainText(
    "Browser Cat",
    { timeout: 30_000 },
  );
  await expect(page.locator(".token-detail-heading img")).toBeVisible();
  await expect(page.locator(".trade-info").first()).toContainText("Graduation");
  await page.locator("#trade-amount").fill("0.1");
  await expect(page.locator(".trade-summary")).toContainText("BCAT", {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Buy BCAT" }).click();
  await expect(
    page.getByText("Bought. Balances refresh in a moment."),
  ).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Sell", exact: true }).click();
  await page.getByRole("button", { name: "50%" }).click({ timeout: 20_000 });
  await expect(page.locator(".trade-summary")).toContainText("SOL", {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Sell BCAT" }).click();
  await expect(
    page.getByText("Sold. Balances refresh in a moment."),
  ).toBeVisible({ timeout: 60_000 });
  await page.screenshot({
    path: `test-results/chain-token-${info.project.name}.png`,
    fullPage: true,
  });

  await page.goto(`${root}/portfolio/`);
  await expect(page.locator(".activity-table")).toContainText("BCAT", {
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.locator(".activity-table")).toContainText("Launch BCAT");
  await expect(page.locator(".activity-table")).toContainText("confirmed");
  await page.goto(`${root}/`);
  await expect(
    page.locator(".launch-card").filter({ hasText: "Browser Cat" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.screenshot({
    path: `test-results/chain-discover-${info.project.name}.png`,
    fullPage: true,
  });

  // Three wallet signatures: launch, buy, sell. Nothing else was signed.
  expect(signed).toHaveLength(3);
  expect(errors).toEqual([]);
});
