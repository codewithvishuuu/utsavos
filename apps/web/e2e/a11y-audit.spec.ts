import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    window.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations?.push(event.violatedDirective);
    });
  });
}

async function audit(page: Page, label: string, screenshot: string) {
  // Axe can mis-sample the fixed sidebar after the page scrolls; audit from a stable top position.
  await page.evaluate(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previous;
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  // Axe and Playwright screenshots inject their own style elements, which WebKit
  // reports as CSP violations. Check the app before those test-only injections.
  expect(
    await page.evaluate(() => window.__cspViolations ?? []),
    `${label} has CSP violations`
  ).toEqual([]);
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
  const summary = blocking.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(" "))
  }));
  expect(summary, `${label} has serious or critical axe violations`).toEqual([]);
  // WebKit cannot encode a full-page image taller than 32767px; viewport evidence
  // is sufficient because screenshots are not asserted.
  const browserName = page.context().browser()?.browserType().name();
  await page.screenshot({ path: screenshot, fullPage: browserName !== "webkit" });
  // Screenshot injection is test-only; do not carry its violation into the next audit.
  await page.evaluate(() => {
    window.__cspViolations = [];
  });
}

// Axe and Playwright screenshots inject styles that WebKit blocks under our CSP.
// App-originated violations are asserted separately before those injections.
function appConsoleErrors(messages: string[]): string[] {
  return messages.filter(
    (message) =>
      !message.startsWith(
        "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear"
      )
  );
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const offenders = Array.from(document.querySelectorAll("body *"))
      .filter((element) => element.getBoundingClientRect().right > root.clientWidth + 1)
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        text: (element.textContent ?? "").trim().slice(0, 60)
      }));
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, offenders };
  });
  expect(
    overflow.scrollWidth,
    `${label} scrolls horizontally (${overflow.scrollWidth} > ${overflow.clientWidth}): ` +
      JSON.stringify(overflow.offenders)
  ).toBeLessThanOrEqual(overflow.clientWidth);
}

test("keyboard focus stays visible on the sign-in screen", async ({ page }) => {
  await page.goto("/login");
  const stops: { tag: string; text: string; outline: string; shadow: string }[] = [];
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    stops.push(
      await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        const style = getComputedStyle(element);
        return {
          tag: element.tagName,
          text: (element.textContent ?? element.getAttribute("aria-label") ?? "").trim().slice(0, 40),
          outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
          shadow: style.boxShadow
        };
      })
    );
  }
  const invisible = stops.filter(
    (stop) =>
      stop.tag !== "BODY" &&
      stop.outline.startsWith("none") &&
      stop.shadow === "none"
  );
  expect(invisible, `focus stops without a visible indicator: ${JSON.stringify(stops)}`).toEqual([]);
});

test("public screens pass axe at desktop, tablet and mobile widths", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await watchCsp(page);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  const loginResponse = await page.goto("/login");
  const csp = loginResponse?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  await expect(page.getByRole("heading", { name: "Sign in to UtsavOS" })).toBeVisible();
  await audit(page, "login", testInfo.outputPath("login-desktop.png"));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /celebrate beautifully/i })
  ).toBeVisible();
  await audit(page, "landing", testInfo.outputPath("landing-desktop.png"));

  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Public demo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run simulation" })).toBeVisible();
  await audit(page, "demo", testInfo.outputPath("demo-desktop.png"));

  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.getByRole("heading", { name: "Computed impact" })).toBeVisible();
  const demoSummary = page.getByRole("region", { name: "Budget summary" }).last();
  await expect(demoSummary).toContainText("₹17,00,800.00");
  await expect(demoSummary).toContainText("₹99,200.00");
  await expect(demoSummary).toContainText("₹80,800.00");
  await audit(page, "demo-result", testInfo.outputPath("demo-result-desktop.png"));

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/demo");
  await expect(page.getByRole("button", { name: "Run simulation" })).toBeVisible();
  await audit(page, "demo-mobile", testInfo.outputPath("demo-mobile.png"));
  await expectNoHorizontalOverflow(page, "demo-mobile");

  await page.goto("/");
  await audit(page, "landing-mobile", testInfo.outputPath("landing-mobile.png"));
  await expectNoHorizontalOverflow(page, "landing-mobile");

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/login");
  await audit(page, "login-tablet", testInfo.outputPath("login-tablet.png"));
  await expectNoHorizontalOverflow(page, "login-tablet");

  await page.goto("/");
  await audit(page, "landing-tablet", testInfo.outputPath("landing-tablet.png"));
  await expectNoHorizontalOverflow(page, "landing-tablet");

  expect(appConsoleErrors(consoleErrors), `console errors: ${consoleErrors.join(" | ")}`).toEqual(
    []
  );
});

test("landing navigation, brand assets and reduced motion work", async ({ page, browserName }) => {
  await watchCsp(page);
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") {
      failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ""}`);
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page).toHaveTitle("UtsavOS — Adaptive Event Planning");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await page.locator('meta[name="description"]').getAttribute("content")).toContain(
    "UtsavOS"
  );

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  if (browserName === "webkit") {
    // WebKit's default Tab navigation skips links unless full keyboard access
    // is enabled in the OS/browser; this setting is not exposed by Playwright.
    test.info().annotations.push({
      type: "webkit-keyboard",
      description: "Skip link focused directly because WebKit does not Tab to links."
    });
    await skipLink.focus();
  } else {
    await page.keyboard.press("Tab");
  }
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  const faviconHref = await page.locator('link[rel="icon"]').first().getAttribute("href");
  expect(faviconHref).toBe("/brand/utsavos-icon-dark.png");
  const favicon = await page.request.get(faviconHref ?? "");
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()["content-type"]).toContain("image/png");

  const brand = page.locator('img[src="/brand/utsavos-icon-dark.png"]').first();
  await expect(brand).toBeVisible();
  await expect
    .poll(() => brand.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "Start Planning" }).first().click();
  const planningDialog = page.getByRole("dialog", {
    name: "Initialize Your Baseline Celebration Plan"
  });
  await expect(planningDialog).toBeVisible();
  await planningDialog.getByRole("link", { name: "Launch Workspace Route" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await page.getByRole("link", { name: "Explore the Experience" }).click();
  await expect(page).toHaveURL(/\/#adaptive-studio$/);
  await page.goBack();

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)
  ).toBe("auto");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const menuButton = page.locator('button[aria-controls="mobile-navigation"]');
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(mobileNavigation).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(mobileNavigation).toBeHidden();
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await expect(mobileNavigation).toBeVisible();
  await mobileNavigation.getByRole("link", { name: "How It Works" }).click();
  await expect(page).toHaveURL(/\/#how-it-works$/);

  expect(failedResponses, `failed responses: ${failedResponses.join(" | ")}`).toEqual([]);
  expect(failedRequests, `failed requests: ${failedRequests.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  expect(await page.evaluate(() => window.__cspViolations ?? [])).toEqual([]);
});

test("signed-in planning screens pass axe and stay inside the viewport", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await watchCsp(page);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Need an account? Sign up" }).click();
  await page.getByLabel("Email").fill(`a11y-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/events$/);
  await audit(page, "events-empty", testInfo.outputPath("events-empty-desktop.png"));

  await page.getByLabel("Event name").fill("A11y Wedding");
  await page.getByLabel("Total budget (₹)").fill("1800000");
  await page.getByLabel("Contingency reserve (₹)").fill("180000");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "A11y Wedding" })).toBeVisible();

  for (const item of [
    { label: "Venue", category: "Venue", amount: "420000", basis: "fixed" },
    { label: "Catering", category: "Catering", amount: "3800", basis: "per_guest" },
    { label: "Decor", category: "Decor", amount: "150000", basis: "fixed" },
    { label: "Photography", category: "Photography", amount: "100000", basis: "fixed" },
    { label: "Attire", category: "Attire", amount: "60000", basis: "fixed" },
    { label: "Invitations", category: "Stationery", amount: "120", basis: "per_guest" },
    { label: "Contingency items", category: "Other", amount: "30000", basis: "fixed" }
  ]) {
    await page.getByLabel("Item label").fill(item.label);
    await page.getByLabel("Item category").fill(item.category);
    await page.getByLabel("Rate (₹)", { exact: true }).fill(item.amount);
    await page.getByLabel("Basis").selectOption(item.basis);
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("cell", { name: new RegExp(item.label) })).toBeVisible();
  }

  await page.getByLabel("Guests", { exact: true }).fill("240");
  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByText("Simulation result")).toBeVisible();
  await audit(page, "planning-studio", testInfo.outputPath("planning-studio-desktop.png"));

  const alternative = page.getByTestId("alternative-increase_budget");
  await alternative.getByTestId("draft-alternative").click();
  await expect(page.getByText("Proposal drafted.")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByText("Approved.")).toBeVisible();
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible();
  await audit(page, "impact-ledger", testInfo.outputPath("impact-ledger-desktop.png"));

  await page.setViewportSize({ width: 768, height: 1024 });
  await audit(page, "event-detail-tablet", testInfo.outputPath("event-detail-tablet.png"));
  await expectNoHorizontalOverflow(page, "event-detail-tablet");

  await page.setViewportSize({ width: 375, height: 812 });
  await audit(page, "event-detail-mobile", testInfo.outputPath("event-detail-mobile.png"));
  await expectNoHorizontalOverflow(page, "event-detail-mobile");

  expect(appConsoleErrors(consoleErrors), `console errors: ${consoleErrors.join(" | ")}`).toEqual(
    []
  );
});
