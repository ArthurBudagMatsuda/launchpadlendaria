// Public read-only browser QA. Fresh profiles, no wallet keys and no RPC mocks.
import assert from "node:assert/strict";
import { chromium, devices } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const settings = JSON.parse(
  await readFile(
    new URL("../infra/devnet-beta/public-settings.json", import.meta.url),
    "utf8",
  ),
);
const origin = settings.publicOrigin;
const expectedCommit = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(expectedCommit ?? ""))
  throw new Error("Provide the full commit served by the reviewed deployment.");
const directory = new URL("../.qa/stage-8/public-browser/", import.meta.url);
await mkdir(directory, { recursive: true });
const versionResponse = await fetch(`${origin}/beta-version.json`, {
  signal: AbortSignal.timeout(15000),
});
assert.equal(versionResponse.status, 200);
const version = await versionResponse.json();
assert.deepEqual(
  {
    sourceCommit: version.sourceCommit,
    dirty: version.dirty,
    cluster: version.cluster,
    mainnetExecution: version.mainnetExecution,
    capabilities: version.capabilities,
  },
  {
    sourceCommit: expectedCommit,
    dirty: false,
    cluster: "devnet",
    mainnetExecution: false,
    capabilities: "read-only",
  },
);
const negatives = [];
for (const [method, path, headers, expected] of [
  ["GET", "/v1/metadata", {}, 401],
  ["POST", "/v1/metadata", { origin, "content-type": "application/json" }, 503],
  [
    "POST",
    "/v1/metadata",
    { origin: "https://unapproved.test", "content-type": "application/json" },
    403,
  ],
  ["GET", "/v1/m/not-a-hash.json", {}, 404],
  ["GET", "/v1/m/%2e%2e/not-public", {}, 404],
]) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers,
    body: method === "POST" ? "{}" : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, expected);
  negatives.push({
    method,
    path,
    status: response.status,
    cacheControl: response.headers.get("cache-control"),
  });
}
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
const results = [];
try {
  for (const [name, device] of [
    ["desktop", devices["Desktop Chrome"]],
    ["mobile", devices["Pixel 7"]],
  ]) {
    const context = await browser.newContext(device);
    const page = await context.newPage();
    const errors = [],
      assetFailures = [],
      rpcMethods = [],
      rpcStatuses = [];
    let mainnetRequests = 0;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().startsWith(`${origin}/_next/`) && r.status() >= 400)
        assetFailures.push({ url: r.url(), status: r.status() });
      if (r.url().startsWith("https://api.devnet.solana.com"))
        rpcStatuses.push(r.status());
    });
    page.on("request", (r) => {
      if (/api\.mainnet/.test(r.url())) mainnetRequests++;
      if (r.url().startsWith("https://api.devnet.solana.com")) {
        try {
          rpcMethods.push(r.postDataJSON().method);
        } catch {
          /* no request body */
        }
      }
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.getByText(/Read-only preview\. Test SOL only/).waitFor();
    assert.equal(
      await page
        .locator('select[aria-label="Application Solana cluster"] option')
        .count(),
      1,
    );
    await page
      .getByRole("link", { name: /RETRY Devnet Test/ })
      .first()
      .waitFor({ timeout: 25000 });
    const realLaunches = await page.locator('a[href*="mint="]').count();
    assert.ok(realLaunches >= 2);
    await page.screenshot({
      path: new URL(`public-${name}.png`, directory).pathname.replace(
        /^\/(\w:)/,
        "$1",
      ),
      fullPage: true,
    });
    const routes = [];
    for (const route of [
      "/create/",
      "/portfolio/",
      "/token/?cluster=devnet&mint=6WwkimyJfjEbeh7wSXYRZ6e26pmEyPLWwTUt9fTY1nUz",
    ]) {
      const response = await page.goto(`${origin}${route}`, {
        waitUntil: "domcontentloaded",
      });
      assert.equal(response.status(), 200);
      await page.locator("main").waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      routes.push({ route, status: response.status() });
    }
    await page.locator("header .wallet-button").click();
    await page.getByRole("dialog").waitFor();
    const walletModal = await page.getByRole("dialog").isVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close dialog" })
      .click();
    assert.equal(mainnetRequests, 0);
    assert.equal(
      rpcMethods.some((m) => m === "sendTransaction" || m === "requestAirdrop"),
      false,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(assetFailures, []);
    results.push({
      viewport: name,
      realLaunches,
      routes,
      walletModal,
      phantomExtension: "not installed in this fresh automation profile",
      pageErrors: errors,
      assetFailures,
      mainnetRequests,
      rpcMethods: [...new Set(rpcMethods)],
      rpcStatuses,
      solanaWrites: 0,
    });
    await context.close();
  }
  const evidence = {
    evidence: "PUBLIC_PREVIEW_READ_ONLY_BROWSER",
    at: new Date().toISOString(),
    url: origin,
    sourceCommit: expectedCommit,
    browser: browser.version(),
    noWalletKeys: true,
    mockedRpc: false,
    version,
    negatives,
    results,
  };
  await writeFile(
    new URL("public-browser.json", directory),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
