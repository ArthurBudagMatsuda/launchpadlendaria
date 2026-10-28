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
} from "./fixtures";

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
    for (const route of ["/", "/create/", "/portfolio/", "/token/orbit/"]) {
      await page.goto(`${APP}${route}`);
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
    // Token illustrations too (public/ files need the base path prefix).
    await page.goto(`${APP}/`);
    const art = page.locator(`img[src^="${APP}/tokens/"]`).first();
    await expect(art).toBeVisible();
    expect(
      await art.evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);
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

  test("Discover keeps the demo catalogue and shows the target network while disconnected", async ({
    page,
    wallet,
  }) => {
    await wallet();
    await page.goto(`${APP}/`);
    await expect(page.getByText("Demo Data").first()).toBeVisible();
    await expect(page.getByTestId("rw3-network-indicator")).toContainText(
      "Base Sepolia",
    );
    await expect(
      page.getByText(/0x[0-9a-fA-F]{4}…|0x[0-9a-fA-F]{4}\.\.\./),
    ).toHaveCount(0);
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
    // No invented holdings or history.
    await expect(
      page.getByText("Token balances are not indexed"),
    ).toBeVisible();

    await navigate(page, "Discover");
    await expect(page).toHaveURL(`${APP}/`);
    await expect(
      banner.getByRole("button", { name: short(ALICE) }),
    ).toBeVisible();

    await page.locator(`a[href="${APP}/token/orbit/"]`).first().click();
    await expect(page).toHaveURL(`${APP}/token/orbit/`);
    const trade = page.getByRole("region", { name: "Trade preview" });
    await expect(trade.locator(".wallet-status")).toContainText(short(ALICE));
    await expect(trade.locator(".wallet-status")).toContainText("Base Sepolia");
    await expect(trade).toContainText("Balance: 0.0234 ETH");
    await expect(
      banner.getByRole("button", { name: short(ALICE) }),
    ).toBeVisible();

    // The balance came from the (mocked) Base Sepolia RPC, never from a fixture.
    expect(rpc.calls.some((call) => call.chainId === 84532)).toBe(true);
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
    await page.goto(`${APP}/token/orbit/`);
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
