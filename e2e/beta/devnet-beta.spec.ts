import { test, expect, type Page } from "@playwright/test";
import {
  createMetadataWorker,
  type Env,
  type KV,
} from "../../infra/metadata-worker/src/index";
import {
  accessFixture,
  rateLimitFixture,
} from "../../tests/fixtures/cloudflare-access";
import { solanaFixture, READ_ONLY_RPC_METHODS } from "../solana-fixtures";

// HTTPS address, Access session, KV and RPC are simulated. No public deployment or extension is claimed.
async function betaFixture(page: Page) {
  const access = await accessFixture();
  const worker = createMetadataWorker(access.fetcher);
  const objects = new Map<string, { value: ArrayBuffer; metadata: unknown }>();
  const kv: KV = {
    get: async (key) => objects.get(key)?.value ?? null,
    getWithMetadata: async <M>(key: string) => ({
      value: objects.get(key)?.value ?? null,
      metadata: (objects.get(key)?.metadata as M) ?? null,
    }),
    put: async (key, value, options) => {
      objects.set(key, {
        value:
          typeof value === "string"
            ? new TextEncoder().encode(value).buffer
            : value,
        metadata: options?.metadata,
      });
    },
  };
  const env: Env = {
    METADATA: kv,
    PUBLIC_URL: "https://retry-beta.test",
    ALLOWED_ORIGINS: "https://retry-beta.test",
    ACCESS_TEAM_DOMAIN: access.issuer,
    ACCESS_AUDIENCE: access.audience,
    UPLOAD_RATE_LIMITER: rateLimitFixture(10),
  };
  const state = {
    authorized: false,
    uploads: 0,
    publicReads: 0,
    mainnetRequests: 0,
  };
  page.on("request", (request) => {
    if (request.url().includes("api.mainnet.solana.com"))
      state.mainnetRequests++;
  });
  await page.route("https://retry-beta.test/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/v1/")) {
      const response = await route.fetch({
        url: `http://127.0.0.1:4175${url.pathname}${url.search}`,
      });
      return route.fulfill({ response });
    }
    if (request.method() === "POST") state.uploads++;
    else state.publicReads++;
    const headers = new Headers(request.headers());
    if (state.authorized) headers.set("cf-access-jwt-assertion", access.token);
    const response = await worker.fetch(
      new Request(request.url(), {
        method: request.method(),
        headers,
        body: request.method() === "POST" ? request.postData() : undefined,
      }),
      env,
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  const rpcCalls = await solanaFixture(page, { signing: true });
  return { state, objects, rpcCalls };
}

test("beta uses root assets, Devnet only and responsive navigation", async ({
  page,
}, info) => {
  const { state } = await betaFixture(page);
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/");
  await expect(
    page.getByText("Solana Devnet Beta — Test Tokens Only"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("combobox", { name: "Application Solana cluster" })
      .getByRole("option"),
  ).toHaveCount(1);
  for (const route of [
    "/create/",
    "/portfolio/",
    "/token/?mint=11111111111111111111111111111111&cluster=mainnet-beta",
  ]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page.getByText("Select the matching application cluster"),
  ).toBeVisible();
  expect(state.mainnetRequests).toBe(0);
  expect(failures).toEqual([]);
  await page.goto("/");
  await page.screenshot({
    path: `docs/devnet-beta/evidence/beta-${info.project.name}-mocked.png`,
    fullPage: true,
  });
});

test("Create authenticates storage and verifies both public objects before any signing", async ({
  page,
}) => {
  const { state, objects, rpcCalls } = await betaFixture(page);
  await page.goto("/create/");
  await page.locator("header .wallet-button").click();
  await page.getByRole("button", { name: /Phantom/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.locator("#name").fill("Beta Storage Test");
  await page.locator("#symbol").fill("BSTORE");
  await page
    .locator("#description")
    .fill("A simulated test of persistent metadata preparation.");
  await page.locator("#token-image").setInputFiles({
    name: "beta.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Continue to Preview" }).click();
  await page.getByRole("button", { name: "Continue to Summary" }).click();
  const review = page.getByRole("button", { name: /Review launch cost/ });
  await expect(review).toBeEnabled();
  await expect(
    page.getByRole("link", { name: "Authorize uploads" }),
  ).toHaveAttribute("href", "/v1/metadata");
  await review.click();
  await expect(page.locator(".launch-panel [role=alert]")).toContainText(
    "Authorize uploads",
  );
  expect(objects.size).toBe(0);
  state.authorized = true;
  await review.click();
  await expect.poll(() => objects.size).toBe(2);
  await expect.poll(() => state.publicReads).toBeGreaterThanOrEqual(2);
  // RPC fixture does not simulate a financial transaction. It stops after verified storage.
  await expect(
    page.getByRole("button", { name: /Sign & launch/ }),
  ).toBeDisabled();
  expect(
    rpcCalls.every(
      (method) =>
        READ_ONLY_RPC_METHODS.has(method) ||
        [
          "getLatestBlockhash",
          "getMinimumBalanceForRentExemption",
          "getFeeForMessage",
          "simulateTransaction",
        ].includes(method),
    ),
  ).toBe(true);
  expect(state.uploads).toBe(2); // one rejected attempt and one authorized upload
  expect(state.mainnetRequests).toBe(0);
});
