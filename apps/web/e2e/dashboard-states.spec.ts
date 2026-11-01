import { mkdirSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const EVENTS_ROUTE = /\/api\/v1\/events(?:\?.*)?$/;

const totals = {
  guest_count: 180,
  budget_minor: 180_000_000,
  reserve_minor: 18_000_000,
  spendable_minor: 162_000_000,
  fixed_minor: 52_000_000,
  per_guest_minor: 3_800_00,
  committed_minor: 170_080_000,
  remaining_budget_minor: 9_920_000,
  remaining_spendable_minor: 8_080_000,
  per_guest_average_minor: 944_889,
  over_budget: false,
  spendable_shortfall_minor: 0,
  category_totals: { Venue: 42_000_000, Catering: 68_400_000 }
};

const event = {
  id: "e1",
  name: "Ananya & Rohan wedding",
  event_type: "wedding",
  city: "Hyderabad",
  event_date: "2027-02-14",
  guest_count: 180,
  budget_minor: 180_000_000,
  reserve_minor: 18_000_000,
  currency: "INR",
  status: "active",
  version: 2
};

const secondEvent = {
  ...event,
  id: "e2",
  name: "Meera & Kabir sangeet",
  city: "Jaipur",
  event_date: "2027-03-06",
  version: 1
};

const BASELINE = "a".repeat(64);
const plan = {
  event,
  baseline_hash: BASELINE,
  totals,
  ceremonies: [],
  items: [],
  tasks: [
    { id: "t1", title: "Send invites", status: "todo", due_date: "2027-01-04", offset_days: null, is_locked: false },
    { id: "t2", title: "Confirm headcount", status: "todo", due_date: "2027-01-18", offset_days: null, is_locked: true },
    { id: "t3", title: "Finalise florals", status: "done", due_date: "2027-02-01", offset_days: null, is_locked: false }
  ],
  dependencies: [],
  vendors: [],
  quotes: [],
  guests: [],
  proposals: [
    {
      id: "p1",
      status: "draft",
      base_version: 1,
      baseline_hash: BASELINE,
      scenario: { kind: "guest_count", guest_count: 240 },
      impact: { ...totals, committed_minor: 172_800_000, remaining_budget_minor: 7_200_000 },
      alternatives: [],
      created_at: "2026-10-01T00:00:00Z",
      decided_at: null,
      revision_id: null
    }
  ],
  revisions: []
};

async function mock(page: Page, events: unknown[] = [event], planBody: unknown = plan) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "u1",
        email: "owner@example.com",
        display_name: "Ananya",
        created_at: "2026-01-01T00:00:00Z"
      }
    })
  );
  await page.route("**/api/v1/events/e1/plan", (route) => route.fulfill({ json: planBody }));
  await page.route(EVENTS_ROUTE, (route) =>
    route.fulfill({ json: { items: events } })
  );
}

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
  expect(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" "))
    })),
    label
  ).toEqual([]);
}

async function overflow(page: Page, label: string) {
  const data = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(data.scroll, label).toBeLessThanOrEqual(data.client);
}

test("dashboard visual and accessibility verification", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  mkdirSync("test-results/dashboard", { recursive: true });
  await mock(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Ananya & Rohan wedding" })).toBeVisible();
  await expect(page.getByText("Plan is now v2")).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard/desktop-1440.png", fullPage: true });
  await expect(page.getByRole("button", { name: "Sign out" })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Revision history" })).toBeInViewport();
  await audit(page, "desktop");
  await overflow(page, "desktop");

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: "test-results/dashboard/tablet-768.png", fullPage: true });
  await audit(page, "tablet");
  await overflow(page, "tablet");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "test-results/dashboard/mobile-375.png", fullPage: true });
  await audit(page, "mobile");
  await overflow(page, "mobile");

  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  const navigation = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(navigation).toBeVisible();
  await expect(page.getByRole("link", { name: "Adaptive Studio" })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard/mobile-menu.png" });
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(menu).toBeFocused();

  testInfo.annotations.push({ type: "screens", description: "test-results/dashboard" });
});

test("dashboard pending, multiple, empty and error states", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync("test-results/dashboard", { recursive: true });

  const fresh = {
    ...plan,
    proposals: [{ ...plan.proposals[0], base_version: 2 }]
  };
  await mock(page, [event], fresh);
  await page.goto("/events");
  await expect(page.getByText("Pending review")).toBeVisible();
  await expect(page.getByText("Plan is now v2")).toHaveCount(0);
  await page.screenshot({ path: "test-results/dashboard/pending-desktop.png", fullPage: true });

  await page.unroute(EVENTS_ROUTE);
  await page.route(EVENTS_ROUTE, (route) =>
    route.fulfill({ json: { items: [event, secondEvent] } })
  );
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "All celebrations" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Meera & Kabir sangeet/ })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard/multiple-desktop.png", fullPage: true });

  await page.unroute(EVENTS_ROUTE);
  await page.route(EVENTS_ROUTE, (route) => route.fulfill({ json: { items: [] } }));
  await page.goto("/events");
  await expect(page.getByText("No celebrations yet")).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard/empty-desktop.png", fullPage: true });
  await audit(page, "empty");

  await page.unroute(EVENTS_ROUTE);
  await page.route(EVENTS_ROUTE, (route) =>
    route.fulfill({
      status: 500,
      json: { error: { code: "db_unavailable", message: "The workspace database is unavailable." } }
    })
  );
  await page.goto("/events");
  await expect(page.getByRole("alert")).toContainText("database is unavailable");
  await page.screenshot({ path: "test-results/dashboard/error-desktop.png", fullPage: true });
  await audit(page, "error");
});

test("dashboard shows a busy skeleton while the workspace loads", async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "u1",
        email: "owner@example.com",
        display_name: "Ananya",
        created_at: "2026-01-01T00:00:00Z"
      }
    })
  );
  await page.route("**/api/v1/events/e1/plan", (route) => route.fulfill({ json: plan }));
  await page.route(EVENTS_ROUTE, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({ json: { items: [event] } });
  });

  await page.goto("/events");
  await expect(page.locator("[aria-busy='true']")).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard/loading-desktop.png" });
  await expect(page.getByRole("heading", { name: "Ananya & Rohan wedding" })).toBeVisible();
});
