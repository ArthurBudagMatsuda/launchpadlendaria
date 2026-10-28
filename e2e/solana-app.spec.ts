import { test, expect } from "@playwright/test";
import { ALICE, BOB, solanaFixture } from "./solana-fixtures";
const root = "/launchpadlendaria";
test("Mainnet adapters render indexed figures, original chart and signatures", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await solanaFixture(page, { market: true, restore: true });
  await page.goto(`${root}/`);
  await page
    .getByLabel("Application Solana cluster")
    .selectOption("mainnet-beta");
  await page.getByPlaceholder("Search name, ticker or mint…").fill(ALICE);
  await page.locator(".lookup-card").click();
  await expect(page.locator(".market-stats")).toContainText("$2");
  await expect(page.locator(".chart-panel canvas").first()).toBeVisible();
  await expect(page.locator(".activity-panel")).toContainText("42");
  await page.getByRole("button", { name: "Line chart" }).click();
  await page.getByRole("button", { name: "Candlestick chart" }).click();
  await page.locator(".price-chart-canvas").hover();
  await page.mouse.wheel(0, -150);
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Trading Coming Soon/ }),
  ).toBeDisabled();
  await page.screenshot({
    path: `test-results/mainnet-chart-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
async function connect(
  page: import("@playwright/test").Page,
  name = "Phantom",
) {
  await page
    .locator("header")
    .getByRole("button", { name: "Connect Wallet" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: `${name} Available` })
    .click();
  await expect(page.getByRole("dialog")).toContainText(ALICE);
  await page.getByLabel("Close dialog").click();
}
test("preserved discovery, empty featured section, navigation and responsive layout", async ({
  page,
}, info) => {
  await solanaFixture(page, { absent: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${root}/`);
  await expect(page.getByText("No featured token yet")).toBeVisible();
  await page
    .locator("header")
    .getByRole("button", { name: "Connect Wallet" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No compatible Solana wallet detected",
  );
  await page.getByLabel("Close dialog").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/discover-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto(`${root}/create/`);
  await expect(
    page.getByRole("heading", { name: /Create/ }).first(),
  ).toBeVisible();
  await page.getByLabel("Token name").fill("Solana Draft");
  await page.reload();
  await expect(page.getByLabel("Token name")).toHaveValue("Solana Draft");
  expect(errors).toEqual([]);
});
for (const name of ["Phantom", "Solflare", "Backpack"])
  test(`Wallet Standard ${name}: balance, account events, cluster, navigation and disconnect`, async ({
    page,
  }, info) => {
    const calls = await solanaFixture(page, { name });
    await page.goto(`${root}/`);
    await connect(page, name);
    await page.goto(`${root}/portfolio/`); // Authorized restore after a complete navigation.
    await expect(page.locator(".portfolio-overview")).toContainText(
      "1.500000001 SOL",
    );
    await expect(page.locator(".portfolio-overview")).toContainText(ALICE);
    await page.evaluate(() =>
      (
        window as unknown as { solanaTest: { change: () => void } }
      ).solanaTest.change(),
    );
    await expect(page.locator(".portfolio-overview")).toContainText(BOB);
    await expect(page.locator(".portfolio-overview")).toContainText("2.5 SOL");
    await page
      .getByLabel("Application Solana cluster")
      .selectOption("mainnet-beta");
    await expect(page.locator(".portfolio-overview")).toContainText(
      "Solana Mainnet",
    );
    await expect(page.locator(".portfolio-overview")).toContainText("2.5 SOL");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (name === "Phantom")
      await page.screenshot({
        path: `test-results/portfolio-${info.project.name}.png`,
        fullPage: true,
      });
    await page.locator("header .wallet-button").click();
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(page.locator(".portfolio-connect")).toBeVisible();
    expect(
      calls.every((method) =>
        ["getGenesisHash", "getBalance"].includes(method),
      ),
    ).toBe(true);
  });
test("rejection and RPC failure have honest user states", async ({ page }) => {
  await solanaFixture(page, { reject: true });
  await page.goto(`${root}/portfolio/`);
  await page
    .locator("header")
    .getByRole("button", { name: "Connect Wallet" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Phantom Available" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Connection rejected");
  await expect(page.locator(".portfolio-connect")).toBeVisible();
});
test("an RPC outage is never shown as zero SOL", async ({ page }) => {
  await solanaFixture(page, { failRpc: true, restore: true });
  await page.goto(`${root}/portfolio/`);
  await expect(page.locator(".portfolio-overview")).toContainText(
    "Balance unavailable",
  );
  await expect(page.locator(".portfolio-overview")).not.toContainText("0 SOL");
});
test("mint lookup preserves terminal and disabled trade, rejects EVM address and old route", async ({
  page,
}, info) => {
  const calls = await solanaFixture(page, { restore: true });
  await page.goto(`${root}/token/?mint=${ALICE}&cluster=devnet`);
  await expect(
    page.getByRole("heading", { name: /About this mint/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Market data unavailable on Devnet.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Coming Soon/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Candlestick chart" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sell", exact: true }).click();
  await expect(page.getByLabel("Trade preview")).toContainText("not indexed");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/terminal-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto(`${root}/token/?mint=0x1234`);
  await expect(
    page.getByRole("heading", { name: "Enter a Solana mint address" }),
  ).toBeVisible();
  const response = await page.goto(
    `${root}/token/base/0x1111111111111111111111111111111111111111/`,
  );
  expect(response?.status()).toBe(404);
  expect(
    calls.every((method) =>
      ["getGenesisHash", "getBalance", "getAccountInfo"].includes(method),
    ),
  ).toBe(true);
});
