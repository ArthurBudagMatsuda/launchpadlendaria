import {
  ALICE,
  APP,
  BOB,
  collectPageErrors,
  connectTestWallet,
  expect,
  navigate,
  short,
  test,
  TOKEN_PAGE,
  WORTH,
} from "./fixtures";
import { geckoOhlcvResponse } from "../tests/fixtures/market-responses";

type MockWindow = {
  __retryMockWallet: {
    changeChain(id: number): void;
    changeAccounts(accounts: string[]): void;
    endSession(): void;
    state: { calls: string[] };
  };
};

// 1×1 PNG, enough for the Create Token validation to accept a stored draft.
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test.describe("RETRY app with a connected wallet", () => {
  test("serves every route under the Pages base path without console errors", async ({
    page,
    wallet,
  }) => {
    const errors = collectPageErrors(page);
    await wallet();
    for (const path of [
      `${APP}/`,
      `${APP}/create/`,
      `${APP}/portfolio/`,
      TOKEN_PAGE,
      `${APP}/token/`,
    ]) {
      await page.goto(path);
      await expect(
        page
          .getByRole("banner")
          .getByRole("button", { name: "Connect Wallet" }),
      ).toBeVisible();
      // Styles load from the repository path.
      expect(
        await page.evaluate(
          () => getComputedStyle(document.body).backgroundColor,
        ),
      ).toBe("rgb(10, 11, 16)");
    }
    // Brand art too (public/ files need the base path prefix).
    await page.goto(`${APP}/`);
    const art = page.locator(`img[src^="${APP}/brand/"]`).first();
    await expect(art).toBeVisible();
    await expect
      .poll(() => art.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await page.goto(`${APP}/token/does-not-exist/`);
    // Unknown token routes get the export's not-found page, not a crash.
    await expect(
      page.getByRole("heading", { name: /hasn.t launched/ }),
    ).toBeVisible();
    // The only error is the expected 404 for the document itself.
    expect(errors).toEqual([
      expect.stringContaining(
        `404 (Not Found) (http://127.0.0.1:4174${APP}/token/does-not-exist/)`,
      ),
    ]);
  });

  test("Discover features the tracked Base token with real, labeled figures and no demo data", async ({
    page,
    wallet,
    market,
  }) => {
    await wallet();
    await page.goto(`${APP}/`);
    await expect(page.getByText("Real Base data · Read-only")).toBeVisible();
    const featured = page.getByRole("region", { name: "Featured token" });
    await expect(featured).toContainText(
      "Tracked on RETRY · not a RETRY launch",
    );
    await expect(featured).toContainText("one life, its worth an attempt");
    await expect(featured).toContainText("$0.001826");
    await expect(featured).toContainText("+108.20% 24h");
    await expect(featured).toContainText("$882.05K");
    await expect(featured).toContainText("$190.93K");
    // FDV is calculated from on-chain supply; market cap is never guessed.
    await expect(featured).toContainText("$1.83M");
    await expect(featured.locator(".featured-stats > div").last()).toHaveText(
      /Market cap\s*Unavailable/,
    );
    await expect(featured.locator(".source-line")).toContainText(
      "GeckoTerminal · worth/ETH · Uniswap v4 pool",
    );
    await expect(featured.locator(".freshness")).toHaveText("Live");
    await expect(
      featured.getByRole("link", { name: /Open market/ }),
    ).toHaveAttribute("href", TOKEN_PAGE);
    // The tracked column holds the real token; RETRY's own columns are honest.
    await expect(
      page.locator(`a.token-card[href="${TOKEN_PAGE}"]`),
    ).toBeVisible();
    await expect(page.getByText("No RETRY launches yet")).toBeVisible();
    await expect(page.getByText("Nothing has graduated yet")).toBeVisible();
    await expect(
      page.getByText(/Demo Data|Orbit Cat|Toast Protocol/),
    ).toHaveCount(0);
    await expect(page.getByTestId("rw3-network-indicator")).toContainText(
      "Base Sepolia",
    );
    // No wallet address is shown while disconnected.
    await expect(
      page.getByRole("banner").getByText(/0x[0-9a-fA-F]{4}(…|\.\.\.)/),
    ).toHaveCount(0);
    // Market data comes from the public providers, keyless and read-only.
    expect(market.calls.length).toBeGreaterThan(0);
    for (const call of market.calls)
      expect(call).toMatch(/^api\.(geckoterminal|dexscreener)\.com\//);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("searches by name, ticker or contract address and inspects untracked addresses", async ({
    page,
  }) => {
    await page.goto(`${APP}/`);
    const search = page.getByRole("textbox", {
      name: "Search by name, ticker or contract address",
    });
    const card = page.locator(`a.token-card[href="${TOKEN_PAGE}"]`);
    for (const term of ["worth", "WORTH", "0xb200", WORTH]) {
      await search.fill(term);
      await expect(card).toBeVisible();
    }
    await search.fill("orbit");
    await expect(card).toHaveCount(0);
    await expect(page.getByText("No tokens found")).toBeVisible();

    // A full address RETRY does not track gets an inspection link, not a guess.
    const other = "0x1111111111111111111111111111111111111111";
    await search.fill(other);
    const lookup = page.getByRole("link", { name: /Not tracked on RETRY/ });
    await expect(lookup).toHaveAttribute(
      "href",
      `${APP}/token/?address=${other}`,
    );
    await lookup.click();
    await expect(
      page.getByRole("heading", {
        name: "No contract at this address on Base",
      }),
    ).toBeVisible();
    await expect(page.getByText("Untracked lookup")).toBeVisible();
    await expect(page.locator(".market-stats")).toHaveCount(0);
    await expect(page.getByText(/\$\d/)).toHaveCount(0);
  });

  test("Token Detail shows the verified identity, real market data, the chart and labeled market activity", async ({
    page,
    wallet,
    rpc,
  }) => {
    const errors = collectPageErrors(page);
    await wallet();
    await page.goto(TOKEN_PAGE);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /one life, its worth an attempt/,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Tracked on RETRY · External token"),
    ).toBeVisible();
    await expect(page.getByText("B20 · Asset")).toBeVisible();
    // The reviewed logo comes from the app's own files, not a provider CDN.
    const logo = page.locator(".token-detail-heading .token-mark img");
    await expect(logo).toHaveAttribute(
      "src",
      new RegExp(
        `^(http://127\\.0\\.0\\.1:\\d+)?${APP}/tokens/base/${WORTH.toLowerCase()}\\.jpg$`,
      ),
    );
    await expect
      .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(250);
    await expect(page.locator(".trade-info")).toContainText(
      "LogoAs listed by GeckoTerminal and DEX Screener",
    );
    await expect(page.getByRole("link", { name: /BaseScan/ })).toHaveAttribute(
      "href",
      `https://basescan.org/token/${WORTH}`,
    );

    const stats = page.locator(".market-stats");
    await expect(stats).toContainText("$0.001826");
    await expect(stats).toContainText("0.000000775 ETH");
    await expect(stats).toContainText("$882.05K");
    await expect(stats).toContainText("$190.93K");
    await expect(stats).toContainText("FDV · calculated$1.83M");
    await expect(stats.locator(".market-stat").last()).toHaveText(
      /Market cap\s*Unavailable/,
    );
    await expect(page.locator(".market-changes")).toContainText(
      "Trades 24h 2,217 buys · 2,050 sells",
    );

    // Real OHLCV with the missing hour left empty.
    const chart = page.locator(".chart-panel");
    await expect(chart.locator(".price-chart canvas").first()).toBeVisible();
    await expect(chart.locator(".source-line")).toContainText(
      "1h OHLCV · UTC · 1 interval without trades left empty",
    );
    // Switching interval refetches; the same hours are 5m buckets with 34 empty ones.
    await chart.getByRole("button", { name: "5m", exact: true }).click();
    await expect(
      chart.getByRole("button", { name: "5m", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(chart.locator(".source-line")).toContainText(
      "5m OHLCV · UTC · 34 intervals without trades left empty",
    );

    // Market activity is everyone's trades, labeled; anomalies are hidden.
    const activity = page.locator(".activity-panel");
    await expect(activity).toContainText("not your wallet");
    await expect(activity.locator("tbody tr")).toHaveCount(2);
    await expect(
      activity.getByRole("link", { name: /buy/ }).first(),
    ).toHaveAttribute(
      "href",
      "https://basescan.org/tx/0xd063902d8f7b0a1a6ac385736f4fd4dc1bdf3e4b67aced249200a7c93451c8c6",
    );
    await expect(activity).toContainText(
      "1 flagged anomalous by the provider hidden",
    );

    // The pool policy is visible: two eligible pools, never summed.
    const pools = page.locator(".pools-panel");
    await expect(pools).toContainText("2 eligible of 5 listed · never summed");
    await expect(pools.locator("tbody tr").first()).toContainText(
      "worth/ETHPrimary",
    );
    await expect(pools).toContainText("below $1,000 liquidity");

    // Trading stays off.
    const trade = page.getByRole("region", { name: "Trade preview" });
    await expect(trade).toContainText("Not available");
    await expect(trade).toContainText("None verified");
    await expect(
      trade.getByRole("button", { name: /Trading Coming Soon/ }),
    ).toBeVisible();

    // On-chain reads went to Base mainnet only, and only as eth_call/eth_getCode.
    const mainnet = rpc.calls.filter((call) => call.chainId === 8453);
    expect(mainnet.length).toBeGreaterThan(0);
    expect(
      mainnet.filter(
        (call) =>
          !["eth_chainId", "eth_getCode", "eth_call"].includes(call.method),
      ),
    ).toEqual([]);
    // Phones get the chart first and the trade box right after it.
    const chartBox = (await chart.boundingBox())!;
    const tradeBox = (await trade.boundingBox())!;
    if (page.viewportSize()!.width < 760)
      expect(tradeBox.y).toBeGreaterThan(chartBox.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });

  test("the price chart opens on the newest candles and zooms and pans with mouse or touch", async ({
    page,
  }, testInfo) => {
    // 200 hourly candles (newest first, like GeckoTerminal), so there is
    // older history to scroll to. Registered last, so it wins for /ohlcv/.
    const rows = Array.from({ length: 200 }, (_, i) => {
      const open = 0.0015 + 0.0002 * Math.sin(i / 7);
      const close = 0.0015 + 0.0002 * Math.sin((i + 1) / 7);
      return [
        1_793_156_400 - i * 3600,
        open,
        Math.max(open, close) * 1.01,
        Math.min(open, close) * 0.99,
        close,
        1000 + i,
      ];
    });
    await page.route(
      /^https:\/\/api\.geckoterminal\.com\/.*\/ohlcv\//,
      (route) =>
        route.fulfill({
          status: 200,
          headers: { "access-control-allow-origin": "*" },
          contentType: "application/json",
          body: JSON.stringify(geckoOhlcvResponse(rows)),
        }),
    );
    const errors = collectPageErrors(page);
    await page.goto(TOKEN_PAGE);
    const chart = page.locator(".price-chart");
    await expect(chart).toHaveAttribute("data-visible-to", /\d/);
    await chart.scrollIntoViewIfNeeded();
    const range = async () => {
      const from = Number(await chart.getAttribute("data-visible-from"));
      const to = Number(await chart.getAttribute("data-visible-to"));
      return { from, to, width: to - from };
    };
    // Opens on the newest candles, not the whole history.
    const initial = await range();
    expect(initial.to).toBeGreaterThan(199);
    expect(initial.from).toBeGreaterThan(0);
    const box = (await chart.boundingBox())!;
    const x = box.x + box.width * 0.45;
    const y = box.y + box.height * 0.45;

    if (testInfo.project.name === "mobile") {
      // Real touch input through the Chrome DevTools protocol.
      const cdp = await page.context().newCDPSession(page);
      const touch = (
        type: "touchStart" | "touchMove" | "touchEnd",
        points: [number, number][],
      ) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: points.map(([px, py], id) => ({ x: px, y: py, id })),
        });
      // One finger dragging right moves to older candles.
      await touch("touchStart", [[x - 60, y]]);
      for (let i = 1; i <= 10; i += 1)
        await touch("touchMove", [[x - 60 + i * 15, y]]);
      await touch("touchEnd", []);
      await expect
        .poll(async () => (await range()).from)
        .toBeLessThan(initial.from - 5);
      // Two fingers spreading apart zoom in.
      const before = (await range()).width;
      await touch("touchStart", [
        [x - 30, y],
        [x + 30, y],
      ]);
      for (let i = 1; i <= 10; i += 1)
        await touch("touchMove", [
          [x - 30 - i * 8, y],
          [x + 30 + i * 8, y],
        ]);
      await touch("touchEnd", []);
      await expect
        .poll(async () => (await range()).width)
        .toBeLessThan(before * 0.8);
      // A vertical swipe over the chart still scrolls the page.
      const scrolled = await page.evaluate(() => window.scrollY);
      await touch("touchStart", [[x, y + 40]]);
      for (let i = 1; i <= 10; i += 1)
        await touch("touchMove", [[x, y + 40 - i * 12]]);
      await touch("touchEnd", []);
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(scrolled + 30);
    } else {
      // The legend follows the pointer with the candle's own values.
      await page.mouse.move(x, y);
      await expect(page.locator(".chart-legend")).toContainText(
        /Oct \d+, \d\d:00 UTC/,
      );
      await expect(page.locator(".chart-legend")).toContainText(
        /O\$0\.001\d+H\$/,
      );
      // Each wheel notch zooms in by about a tenth.
      for (let notch = 0; notch < 4; notch += 1)
        await page.mouse.wheel(0, -100);
      await expect
        .poll(async () => (await range()).width)
        .toBeLessThan(initial.width * 0.8);
      // Dragging right moves to older candles.
      const zoomed = await range();
      await page.mouse.down();
      await page.mouse.move(x + 250, y, { steps: 12 });
      await page.mouse.up();
      await expect
        .poll(async () => (await range()).from)
        .toBeLessThan(zoomed.from - 5);
      // The log scale toggles.
      const log = page.getByRole("button", { name: "Log" });
      await log.click();
      await expect(log).toHaveAttribute("aria-pressed", "true");
    }
    // Reset view goes back to the newest candles.
    await page.getByRole("button", { name: "Reset view" }).click();
    await expect
      .poll(async () => (await range()).from)
      .toBeCloseTo(initial.from, 0);
    expect(errors).toEqual([]);
  });

  test("falls back to DEX Screener when GeckoTerminal is rate limited, and says what is missing", async ({
    page,
    market,
  }) => {
    market.failStatus.geckoterminal = 429;
    await page.goto(TOKEN_PAGE);
    const stats = page.locator(".market-stats");
    await expect(stats).toContainText("$0.00183");
    await expect(stats).toContainText("$191.34K");
    await expect(page.locator(".source-line").first()).toContainText(
      "DEX Screener (fallback)",
    );
    // Candles and trades only come from GeckoTerminal: no chart is invented.
    await expect(page.locator(".chart-panel")).toContainText(
      "Price history is unavailable",
    );
    await expect(page.locator(".chart-panel .price-chart")).toHaveCount(0);
    await expect(page.locator(".activity-panel")).toContainText(
      "Trades are unavailable",
    );
  });

  test("shows market data as unavailable when every provider fails, never a price", async ({
    page,
    market,
  }) => {
    market.failStatus = { geckoterminal: 503, dexscreener: 503 };
    await page.goto(TOKEN_PAGE);
    const error = page.locator(".market-error").first();
    await expect(error).toContainText("Market data is unavailable", {
      timeout: 15_000,
    });
    await expect(page.locator(".market-stats")).toHaveCount(0);
    await expect(page.getByText(/\$0\.\d/)).toHaveCount(0);
    // The identity still comes from the chain.
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /one life, its worth an attempt/,
      }),
    ).toBeVisible();
    market.failStatus = {};
    await error.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator(".market-stats")).toContainText("$0.001826");
  });

  test("shows the X banner with the headline and the logo floating, and still when the system reduces motion", async ({
    page,
  }) => {
    await page.goto(`${APP}/`);
    const hero = page.locator(".discovery-hero");
    const heading = hero.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Your next tokenstarts here.");
    await expect(
      hero.getByRole("link", { name: "Create Token" }),
    ).toHaveAttribute("href", `${APP}/create/`);
    // Both images load from the Pages base path.
    const images = hero.locator("img");
    await expect(images).toHaveCount(2);
    for (const image of await images.all()) {
      await expect
        .poll(() =>
          image.evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth,
          ),
        )
        .toBeGreaterThan(0);
    }
    // The logo positions assume the banner's 3:1 ratio.
    const art = await hero.locator(".hero-art").boundingBox();
    expect(art!.width / art!.height).toBeCloseTo(3, 1);
    const logo = hero.locator(".hero-logo");
    // The headline stays left of the logo.
    const headingBox = (await heading.boundingBox())!;
    const logoBox = (await logo.boundingBox())!;
    expect(headingBox.x + headingBox.width).toBeLessThan(logoBox.x);
    await expect(logo).toHaveCSS("animation-name", "hero-float");
    await expect(logo).toHaveCSS("animation-iteration-count", "infinite");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(logo).toHaveCSS("animation-name", "none");
    await expect(hero.locator(".hero-shadow")).toHaveCSS(
      "animation-name",
      "none",
    );
  });

  test("connects in the header and keeps the wallet across Discover, Portfolio, Trade and Create", async ({
    page,
    wallet,
    rpc,
  }) => {
    await wallet();
    await page.goto(`${APP}/`);
    await connectTestWallet(page);
    const banner = page.getByRole("banner");
    const account = banner.getByRole("button", { name: short(ALICE) });
    await expect(account).toBeVisible();
    await expect(page.getByTestId("rw3-network-indicator")).toContainText(
      "Base Sepolia",
    );

    // Wallet menu: full address, network, live balance, explorer, disconnect.
    await account.click();
    const menu = page.getByTestId("rw3-wallet-menu");
    await expect(menu.getByTestId("rw3-full-address")).toHaveText(ALICE);
    await expect(menu.getByTestId("rw3-menu-network")).toContainText(
      "Base Sepolia",
    );
    await expect(menu.getByTestId("rw3-balance")).toContainText("0.0234 ETH");
    await expect(
      menu.getByRole("link", { name: /View on Basescan/ }),
    ).toHaveAttribute("href", `https://sepolia.basescan.org/address/${ALICE}`);
    await expect(
      menu.getByRole("button", { name: "Disconnect" }),
    ).toBeVisible();
    // The open menu fits the screen (desktop dropdown or phone bottom sheet).
    const box = await menu.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await navigate(page, "Portfolio");
    await expect(page).toHaveURL(`${APP}/portfolio/`);
    const portfolio = page.locator(".portfolio-overview");
    await expect(portfolio).toContainText(short(ALICE).replace("...", "…"));
    await expect(portfolio).toContainText(ALICE);
    await expect(portfolio).toContainText("Base Sepolia");
    await expect(portfolio).toContainText("0.0234 ETH");
    await expect(portfolio).toContainText("Connected with Retry Test Wallet");
    await expect(
      portfolio.getByRole("link", { name: /View on Basescan/ }),
    ).toHaveAttribute("href", `https://sepolia.basescan.org/address/${ALICE}`);
    // The tracked token's real balance on Base mainnet; nothing else is invented.
    const holdings = page.locator(".tracked-balances");
    await expect(holdings).toContainText("18.99K worth");
    await expect(holdings).toContainText("≈ $34.67 at the pool price");
    await expect(holdings).toContainText(
      "Other tokens in your wallet are not indexed",
    );

    await navigate(page, "Discover");
    await expect(page).toHaveURL(`${APP}/`);
    await expect(
      banner.getByRole("button", { name: short(ALICE) }),
    ).toBeVisible();

    await page.locator(`a.token-card[href="${TOKEN_PAGE}"]`).click();
    await expect(page).toHaveURL(TOKEN_PAGE);
    const trade = page.getByRole("region", { name: "Trade preview" });
    await expect(trade.locator(".wallet-status")).toContainText(short(ALICE));
    await expect(trade.locator(".wallet-status")).toContainText("Base Sepolia");
    await expect(trade).toContainText("Balance: 0.0234 ETH");
    // Selling shows the token balance read from Base mainnet.
    await trade.getByRole("button", { name: "Sell" }).click();
    await expect(trade).toContainText("Balance: 18.99K worth");
    await expect(
      banner.getByRole("button", { name: short(ALICE) }),
    ).toBeVisible();

    // Balances came from the (mocked) Base RPCs, never from a fixture in the app.
    expect(rpc.calls.some((call) => call.chainId === 84532)).toBe(true);
    expect(rpc.calls.some((call) => call.chainId === 8453)).toBe(true);
  });

  test("Trade and Create stay non-financial", async ({ page, wallet }) => {
    await page.addInitScript((image) => {
      localStorage.setItem(
        "retry:token-draft:v1",
        JSON.stringify({
          name: "Orbit Test",
          symbol: "ORBT",
          description: "A draft used by the browser tests.",
          image,
          website: "",
          twitter: "",
          telegram: "",
        }),
      );
    }, PIXEL);
    await wallet();
    await page.goto(TOKEN_PAGE);
    const trade = page.getByRole("region", { name: "Trade preview" });
    await expect(trade.locator(".wallet-status")).toHaveAttribute(
      "data-state",
      "disconnected",
    );
    await expect(trade).toContainText("Wallet not connected");
    await connectTestWallet(page);
    await trade.getByRole("button", { name: /Trading Coming Soon/ }).click();
    await expect(page.getByText(/cannot send transactions/)).toBeVisible();

    await navigate(page, "Create");
    await page.getByRole("button", { name: /Continue to Preview/ }).click();
    await page.getByRole("button", { name: /Continue to Summary/ }).click();
    const form = page.locator(".create-form");
    await expect(form.locator(".wallet-status")).toContainText(short(ALICE));
    await expect(
      form.getByRole("button", { name: /Launch Token · Coming Soon/ }),
    ).toBeDisabled();

    // Disconnecting does not touch the draft.
    await page
      .getByRole("banner")
      .getByRole("button", { name: short(ALICE) })
      .click();
    await page
      .getByTestId("rw3-wallet-menu")
      .getByRole("button", { name: "Disconnect" })
      .click();
    await expect(form.locator(".wallet-status")).toHaveAttribute(
      "data-state",
      "disconnected",
    );
    await expect(form).toContainText("Orbit Test (ORBT)");

    const calls = await page.evaluate(
      () => (window as unknown as MockWindow).__retryMockWallet.state.calls,
    );
    expect(calls.filter((method) => /sign|send|approve/i.test(method))).toEqual(
      [],
    );
  });

  test("follows account and network changes made in the wallet", async ({
    page,
    wallet,
  }) => {
    await wallet();
    await page.goto(`${APP}/portfolio/`);
    await connectTestWallet(page);
    const portfolio = page.locator(".portfolio-overview");
    await expect(portfolio).toContainText("0.0234 ETH");

    await page.evaluate(
      (next) =>
        (window as unknown as MockWindow).__retryMockWallet.changeAccounts([
          next,
        ]),
      BOB,
    );
    await expect(
      page.getByRole("banner").getByRole("button", { name: short(BOB) }),
    ).toBeVisible();
    await expect(portfolio).toContainText(BOB);
    await expect(portfolio).toContainText("2 ETH");

    await page.evaluate(() =>
      (window as unknown as MockWindow).__retryMockWallet.changeChain(1),
    );
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Wrong Network" }),
    ).toBeVisible();
    await expect(page.getByTestId("rw3-network-indicator")).toHaveText(
      "Wrong Network",
    );
    await expect(portfolio).toContainText("Wrong network");
    await expect(portfolio).toContainText("Unsupported network");
    await expect(portfolio).not.toContainText("2 ETH");

    await portfolio
      .getByRole("button", { name: "Switch to Base Sepolia" })
      .click();
    await expect(page.getByTestId("rw3-network-indicator")).toContainText(
      "Base Sepolia",
    );
    await expect(portfolio).toContainText("2 ETH");

    await page.evaluate(() =>
      (window as unknown as MockWindow).__retryMockWallet.changeChain(8453),
    );
    await expect(page.getByTestId("rw3-network-indicator")).toHaveText("Base");
    await expect(portfolio).toContainText("Base");
  });

  test("reports a rejected network switch without claiming success", async ({
    page,
    wallet,
  }) => {
    await wallet({ chainId: 42161, rejectSwitch: true });
    await page.goto(`${APP}/`);
    await connectTestWallet(page);
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Wrong Network" })
      .click();
    const menu = page.getByTestId("rw3-wallet-menu");
    await menu.getByRole("button", { name: "Switch to Base Sepolia" }).click();
    await expect(menu.getByRole("alert").first()).toHaveText(
      "Network switch rejected. Please switch to Base Sepolia.",
    );
    await expect(page.getByTestId("rw3-network-indicator")).toHaveText(
      "Wrong Network",
    );
  });

  test("explains a switch the wallet confirms and then undoes", async ({
    page,
    wallet,
  }) => {
    await wallet({ chainId: 1, revertSwitch: true });
    await page.goto(`${APP}/`);
    await connectTestWallet(page);
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Wrong Network" })
      .click();
    const menu = page.getByTestId("rw3-wallet-menu");
    await menu.getByRole("button", { name: "Switch to Base Sepolia" }).click();
    await expect(menu.getByRole("alert").first()).toHaveText(
      "Retry Test Wallet switched back to Ethereum. Open Retry Test Wallet, choose Base Sepolia there, and try again.",
    );
    await expect(page.getByTestId("rw3-network-indicator")).toHaveText(
      "Wrong Network",
    );
    // The message stays until the wallet changes network.
    await page.waitForTimeout(2_000);
    await expect(menu.getByRole("alert").first()).toBeVisible();
    await page.evaluate(() =>
      (window as unknown as MockWindow).__retryMockWallet.changeChain(84532),
    );
    await expect(page.getByTestId("rw3-network-indicator")).toContainText(
      "Base Sepolia",
    );
    await expect(menu.getByRole("alert")).toHaveCount(0);
  });

  test("keeps the wallet spinner turning slowly when the system reduces motion", async ({
    page,
  }) => {
    // The global reduced-motion reset used to turn it into a 0.01ms loop that flickered.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${APP}/`);
    const animation = await page.evaluate(() => {
      const spinner = document.createElement("span");
      spinner.className = "rw3-spinner";
      document.body.append(spinner);
      const style = getComputedStyle(spinner);
      return {
        duration: style.animationDuration,
        count: style.animationIterationCount,
      };
    });
    expect(animation).toEqual({ duration: "2.4s", count: "infinite" });
  });

  test("shows Balance unavailable when the RPC fails, never a number", async ({
    page,
    wallet,
    rpc,
  }) => {
    rpc.failStatus = 503;
    await wallet();
    await page.goto(`${APP}/portfolio/`);
    await connectTestWallet(page);
    const portfolio = page.locator(".portfolio-overview");
    await expect(portfolio).toContainText("Unavailable", { timeout: 15_000 });
    await expect(portfolio).not.toContainText(/\d ETH/);
    rpc.failStatus = undefined;
    await portfolio.getByRole("button", { name: "Retry balance" }).click();
    await expect(portfolio).toContainText("0.0234 ETH");
  });

  test("restores the session after a reload on a deep route", async ({
    page,
    wallet,
  }) => {
    const errors = collectPageErrors(page);
    await wallet();
    await page.goto(`${APP}/portfolio/`);
    await connectTestWallet(page);
    await page.reload();
    await expect(
      page.getByRole("banner").getByRole("button", { name: short(ALICE) }),
    ).toBeVisible();
    await expect(page.locator(".portfolio-overview")).toContainText(ALICE);
    // A hydration mismatch would surface as a console error here.
    expect(errors).toEqual([]);
  });

  test("disconnects from the menu and when the wallet ends the session", async ({
    page,
    wallet,
  }) => {
    await wallet();
    await page.goto(`${APP}/portfolio/`);
    await connectTestWallet(page);
    const banner = page.getByRole("banner");
    await banner.getByRole("button", { name: short(ALICE) }).click();
    await page
      .getByTestId("rw3-wallet-menu")
      .getByRole("button", { name: "Disconnect" })
      .click();
    await expect(
      banner.getByRole("button", { name: "Connect Wallet" }),
    ).toBeVisible();
    await expect(page.getByText("A home for your next chapter.")).toBeVisible();

    await connectTestWallet(page);
    await page.evaluate(() =>
      (window as unknown as MockWindow).__retryMockWallet.endSession(),
    );
    await expect(
      banner.getByRole("button", { name: "Connect Wallet" }),
    ).toBeVisible();
  });

  test("opens and closes the wallet picker from the keyboard", async ({
    page,
    wallet,
  }) => {
    await wallet();
    await page.goto(`${APP}/`);
    const button = page
      .getByRole("banner")
      .getByRole("button", { name: "Connect Wallet" });
    await button.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Connect Wallet" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Retry Test Wallet/ }),
    ).toBeVisible();
    // The injected wallet is listed once, not again as a generic browser wallet.
    await expect(
      dialog.getByRole("button", { name: /Browser Wallet/ }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
