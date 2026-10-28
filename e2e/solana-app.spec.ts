import { test, expect } from "@playwright/test";
import { ALICE, BOB, solanaFixture } from "./solana-fixtures";
const root = "/launchpadlendaria";
test("copy confirmation follows the account being copied", async ({ page }) => {
  await solanaFixture(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    }),
  );
  await page.goto(`${root}/`);
  await connect(page);
  await page.locator("header .wallet-button").click();
  await page.getByRole("button", { name: "Copy address", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as { solanaTest: { change: () => void } }
    ).solanaTest.change(),
  );
  await expect(page.getByRole("dialog")).toContainText(BOB);
  await expect(
    page.getByRole("button", { name: "Copy address", exact: true }),
  ).toBeVisible();
});
test("Create preserves validated metadata and image through the disabled launch summary", async ({
  page,
}) => {
  await solanaFixture(page, { absent: true });
  await page.goto(`${root}/create/`);
  await page.locator("#name").fill("Review Token");
  await page.locator("#symbol").fill("rev");
  await page
    .locator("#description")
    .fill("Local Solana token preview for integration review.");
  await page.locator("#website").fill("https://retry.example");
  await page.locator("#twitter").fill("https://x.com/retry");
  await page.locator("#telegram").fill("https://t.me/retry");
  await page.locator("#token-image").setInputFiles({
    name: "review.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Continue to Preview" }).click();
  await page.getByRole("button", { name: "Continue to Summary" }).click();
  await expect(
    page.getByRole("button", { name: /Launch Token.*Coming Soon/ }),
  ).toBeDisabled();
  await expect(page.locator(".create-form")).toContainText("Review Token");
  await page.reload();
  await expect(page.locator("#name")).toHaveValue("Review Token");
  await expect(page.locator("#symbol")).toHaveValue("REV");
  await expect(page.locator("#website")).toHaveValue("https://retry.example");
  await expect(page.locator("#twitter")).toHaveValue("https://x.com/retry");
  await expect(page.locator(".image-preview")).toBeVisible();
});
test("a failed mint RPC is unavailable data, not proof of a non-token", async ({
  page,
}) => {
  await solanaFixture(page, { failRpc: true, absent: true });
  await page.goto(`${root}/token/?mint=${ALICE}&cluster=devnet`);
  await expect(
    page.getByText(
      "Mint identity unavailable from Solana RPC. No token identity is inferred.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "This account is not an initialized SPL mint",
    }),
  ).toHaveCount(0);
});
test("older Solana candles load when panning and preserve the chart view", async ({
  page,
}) => {
  await solanaFixture(page, { market: true });
  const end = Math.floor(Date.now() / 3600000) * 3600 - 3600;
  const rows = Array.from({ length: 350 }, (_, i) => [
    end - i * 3600,
    1,
    3,
    0.5,
    2,
    10,
  ]);
  const olderRequests: string[] = [];
  await page.route(
    /https:\/\/api\.geckoterminal\.com\/.*\/ohlcv\/hour/,
    async (route) => {
      const url = new URL(route.request().url()),
        before = url.searchParams.get("before_timestamp");
      if (before) olderRequests.push(before);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          meta: { base: { address: ALICE } },
          data: {
            attributes: {
              ohlcv_list: rows
                .filter(([time]) => !before || time <= Number(before))
                .slice(0, 200),
            },
          },
        }),
      });
    },
  );
  await page.goto(`${root}/`);
  await page
    .getByLabel("Application Solana cluster")
    .selectOption("mainnet-beta");
  await page.getByPlaceholder("Search name, ticker or mint…").fill(ALICE);
  await page.locator(".lookup-card").click();
  const chart = page.locator(".price-chart-canvas");
  await expect(chart.locator("canvas").first()).toBeVisible();
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  for (let n = 0; n < 12 && !olderRequests.length; n++) {
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5, {
      steps: 15,
    });
    await page.mouse.up();
  }
  await expect.poll(() => olderRequests).toContain(String(rows[199][0]));
  const stamp = new Date(rows[349][0] * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  });
  await expect(chart).toHaveAttribute(
    "aria-label",
    new RegExp(`from ${stamp} UTC`),
  );
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect
    .poll(async () =>
      Number(
        await page.locator(".price-chart").getAttribute("data-visible-from"),
      ),
    )
    .toBeGreaterThan(150);
});
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
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
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
async function navigate(page: import("@playwright/test").Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.locator("header").getByRole("link", { name, exact: true }).click();
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
    await navigate(page, "Portfolio");
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { solanaTest: { connections: boolean[] } })
            .solanaTest.connections,
      ),
    ).toEqual([false]);
    await expect(page.locator(".portfolio-overview")).toContainText(
      "1.500000001 SOL",
    );
    await expect(page.locator(".portfolio-overview")).toContainText(ALICE);
    await page.reload();
    await expect(page.locator(".portfolio-overview")).toContainText(
      "1.500000001 SOL",
    );
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { solanaTest: { connections: boolean[] } })
            .solanaTest.connections,
      ),
    ).toEqual([true]);
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
    await expect(page.locator(".portfolio-overview")).toContainText("4.5 SOL");
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
