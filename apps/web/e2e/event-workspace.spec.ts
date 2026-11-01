import { mkdirSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const EVENTS_ROUTE = /\/api\/v1\/events(?:\?.*)?$/;

const totals = {
  guest_count: 240,
  budget_minor: 180_000_000,
  reserve_minor: 18_000_000,
  spendable_minor: 162_000_000,
  fixed_minor: 52_000_000,
  per_guest_minor: 118_080_000,
  committed_minor: 170_080_000,
  remaining_budget_minor: 9_920_000,
  remaining_spendable_minor: 8_080_000,
  per_guest_average_minor: 708_667,
  over_budget: false,
  spendable_shortfall_minor: 0,
  category_totals: { Venue: 42_000_000, Catering: 118_080_000 }
};

const event = {
  id: "e1",
  name: "Ananya & Rohan wedding",
  event_type: "wedding",
  city: "Hyderabad",
  event_date: "2027-02-14",
  guest_count: 240,
  budget_minor: 180_000_000,
  reserve_minor: 18_000_000,
  currency: "INR",
  status: "active",
  version: 2
};

const BASELINE = "a".repeat(64);
const plan = {
  event,
  baseline_hash: BASELINE,
  totals,
  ceremonies: [
    { id: "c1", name: "Mehndi", ceremony_date: "2027-02-11", guest_count: 60, venue: "Home" },
    { id: "c2", name: "Pheras", ceremony_date: "2027-02-14", guest_count: 240, venue: "Falaknuma" }
  ],
  items: [
    {
      id: "i1",
      label: "Venue and mandap",
      category: "Venue",
      basis: "fixed",
      unit_amount_minor: 42_000_000,
      quantity: 1,
      vendor_id: "v1",
      quote_minor: 39_000_000,
      is_optional: false
    },
    {
      id: "i2",
      label: "Catering",
      category: "Catering",
      basis: "per_guest",
      unit_amount_minor: 380_000,
      quantity: 1,
      vendor_id: null,
      quote_minor: null,
      is_optional: false
    },
    {
      id: "i3",
      label: "Decor and florals",
      category: "Decor",
      basis: "fixed",
      unit_amount_minor: 15_000_000,
      quantity: 1,
      vendor_id: null,
      quote_minor: null,
      is_optional: false
    }
  ],
  tasks: [
    { id: "t1", title: "Send invites", status: "todo", due_date: "2026-12-01", offset_days: null, is_locked: false },
    { id: "t2", title: "Confirm headcount", status: "in_progress", due_date: "2027-01-01", offset_days: null, is_locked: true },
    { id: "t3", title: "Finalise menu", status: "done", due_date: "2027-01-10", offset_days: null, is_locked: false }
  ],
  dependencies: [{ predecessor_id: "t1", successor_id: "t2" }],
  vendors: [
    { id: "v1", name: "Taj Falaknuma", category: "Venue", contact_name: null, email: null, phone: null, status: "confirmed" },
    { id: "v2", name: "Marigold Studio", category: "Decor", contact_name: null, email: null, phone: null, status: "contacted" }
  ],
  quotes: [
    {
      id: "q1",
      vendor_id: "v1",
      budget_item_id: "i1",
      amount_minor: 39_000_000,
      inclusions: null,
      exclusions: null,
      status: "confirmed",
      valid_until: null
    }
  ],
  guests: [
    { id: "g1", full_name: "Meera", party_size: 2, dietary_tags: "vegetarian", accessibility_notes: null, email: null, phone: null, notes: null },
    { id: "g2", full_name: "Kabir", party_size: 1, dietary_tags: null, accessibility_notes: null, email: null, phone: null, notes: null }
  ],
  proposals: [
    {
      id: "p1",
      status: "draft",
      base_version: 1,
      baseline_hash: BASELINE,
      scenario: { kind: "guest_count", guest_count: 260 },
      impact: { ...totals, guest_count: 260, committed_minor: 172_800_000, remaining_budget_minor: 7_200_000 },
      alternatives: [],
      created_at: "2026-10-01T00:00:00Z",
      decided_at: null,
      revision_id: null
    },
    {
      id: "p2",
      status: "approved",
      base_version: 1,
      baseline_hash: BASELINE,
      scenario: { kind: "guest_count", guest_count: 240 },
      impact: totals,
      alternatives: [],
      created_at: "2026-09-20T00:00:00Z",
      decided_at: "2026-09-21T00:00:00Z",
      revision_id: "r1"
    }
  ],
  revisions: [
    {
      id: "r1",
      version: 2,
      proposal_id: "p2",
      before_json: { guest_count: 180, budget_minor: 180_000_000 },
      after_json: { guest_count: 240, budget_minor: 180_000_000 },
      created_at: "2026-09-21T00:00:00Z"
    }
  ]
};

async function mock(page: Page) {
  // Smooth scrolling can race Firefox's click dispatch after Playwright scrolls
  // a control into view. Reduced motion is a supported preference and makes it instant.
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  await page.route(EVENTS_ROUTE, (route) => route.fulfill({ json: { items: [event] } }));
  await page.route("**/api/v1/ai/status", (route) =>
    route.fulfill({
      json: {
        local: { enabled: true, model: "qwen2.5" },
        cloud: { configured: false, enabled: false, model: null, consent_granted: false, policy_version: "v1" },
        deterministic_engine: "utsavos",
        disclosure: "Explanations are optional."
      }
    })
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

test("event workspace sections and shell navigation work", async ({ page }) => {
  test.setTimeout(120_000);
  await mock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/events/e1");

  await expect(page.getByRole("heading", { name: "Ananya & Rohan wedding" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByText("240 guests · version 2")).toBeVisible();
  await expect(page.getByText("Explanations are optional.")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Celebration panels" });
  const sections = [
    ["Budget", "budget"],
    ["Adaptive Studio", "simulate"],
    ["Proposals", "proposals"],
    ["Guests", "guests"],
    ["Timeline & Tasks", "tasks"],
    ["Vendors", "vendors"],
    ["Quotes", "quotes"],
    ["Ceremonies", "ceremonies"],
    ["Impact Ledger", "impact"],
    ["Revision history", "revisions"]
  ] as const;

  for (const [name, hash] of sections) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${hash}$`));
    await expect(page.locator(`#${hash}`)).toBeInViewport({ ratio: 0.05 });
    await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
  }

  await nav.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/events\/e1$/);
  await expect(page.locator("#overview")).toBeInViewport({ ratio: 0.2 });

  await page.getByRole("banner").getByRole("button", { name: "New event" }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole("heading", { name: "Create a celebration" })).toBeVisible();
  await expect(page.getByLabel("Event name")).toBeFocused();
});

test("event workspace passes axe and viewport checks at three widths", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  mkdirSync("test-results/workspace", { recursive: true });
  await mock(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/events/e1");
  await expect(page.getByRole("heading", { name: "Ananya & Rohan wedding" })).toBeVisible();
  await page.screenshot({ path: "test-results/workspace/desktop-1440.png", fullPage: true });
  await audit(page, "desktop");
  await overflow(page, "desktop");

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: "test-results/workspace/tablet-768.png", fullPage: true });
  await audit(page, "tablet");
  await overflow(page, "tablet");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "test-results/workspace/mobile-375.png", fullPage: true });
  await audit(page, "mobile");
  await overflow(page, "mobile");

  await page.locator("#guests").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("banner").getByRole("link", { name: event.name, exact: true })
  ).toBeVisible();

  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  const navigation = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  // Shift-Tab from the first stop wraps to the last, then Tab wraps back into the drawer.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(navigation.getByRole("button", { name: "Sign out" })).toBeFocused();
  await page.keyboard.press("Tab");
  expect(
    await navigation.evaluate((node) => node.contains(document.activeElement))
  ).toBe(true);

  await navigation.getByRole("link", { name: "Guests", exact: true }).click();
  await expect(page).toHaveURL(/#guests$/);
  await expect(navigation).toBeHidden();
  await expect(menu).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");

  testInfo.annotations.push({ type: "screens", description: "test-results/workspace" });
});

test("an API error from an off-screen section is revealed", async ({ page }) => {
  await mock(page);
  await page.route("**/api/v1/events/e1/simulate", (route) =>
    route.fulfill({
      status: 500,
      json: {
        error: {
          code: "simulation_failed",
          message: "Simulation failed. Try again.",
          details: {},
          request_id: "req-test"
        }
      }
    })
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/events/e1");
  await expect(page.getByRole("heading", { name: "Ananya & Rohan wedding" })).toBeVisible();

  await page.locator("#simulate").scrollIntoViewIfNeeded();
  await page.getByLabel("Guests", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Simulation failed. Try again.");
  await expect(alert).toBeFocused();
  await expect(alert).toBeInViewport();
});

test("a saved guest is not resubmitted when the refresh fails", async ({ page }) => {
  await mock(page);
  await page.unroute("**/api/v1/events/e1/plan");
  let saves = 0;
  let failNextRefresh = false;
  const newGuest = {
    id: "g3",
    full_name: "Ishaan",
    party_size: 1,
    dietary_tags: null,
    accessibility_notes: null,
    email: null,
    phone: null,
    notes: null
  };
  await page.route("**/api/v1/events/e1/guests", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    saves += 1;
    failNextRefresh = true;
    await route.fulfill({
      status: 201,
      json: { id: newGuest.id, full_name: newGuest.full_name, party_size: newGuest.party_size }
    });
  });
  await page.route("**/api/v1/events/e1/plan", async (route) => {
    if (failNextRefresh) {
      failNextRefresh = false;
      await route.fulfill({
        status: 500,
        json: {
          error: {
            code: "refresh_failed",
            message: "Fresh plan unavailable.",
            details: {},
            request_id: "req-refresh"
          }
        }
      });
      return;
    }
    await route.fulfill({
      json: { ...plan, guests: saves > 0 ? [...plan.guests, newGuest] : plan.guests }
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/events/e1");
  await expect(page.getByRole("heading", { name: "Ananya & Rohan wedding" })).toBeVisible();

  await page.getByLabel("Guest name").fill("Ishaan");
  await page.getByRole("button", { name: "Add guest" }).click();

  await expect(page.getByRole("alert")).toContainText("The change was saved");
  await expect(page.getByRole("alert")).toContainText("Fresh plan unavailable.");
  await expect(page.getByLabel("Guest name")).toHaveValue("");
  expect(saves).toBe(1);

  await page.getByRole("button", { name: "Retry refresh" }).click();
  await expect(page.locator("#guests")).toContainText("Ishaan");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(saves).toBe(1);
});

test("older proposals and revisions stay reachable", async ({ page }) => {
  await mock(page);
  await page.unroute("**/api/v1/events/e1/plan");
  await page.route("**/api/v1/events/e1/plan", (route) =>
    route.fulfill({ json: { ...plan, proposal_total: 3, revision_total: 2 } })
  );
  const olderProposal = {
    ...plan.proposals[0],
    id: "p3",
    status: "rejected",
    scenario: { kind: "guest_count", guest_count: 280 }
  };
  await page.route(/\/api\/v1\/events\/e1\/proposals\?.*$/, (route) =>
    route.fulfill({
      json: { items: [olderProposal], total: 3, limit: 20, offset: 2 }
    })
  );
  const olderRevision = {
    ...plan.revisions[0],
    id: "r0",
    version: 1,
    proposal_id: "p0"
  };
  await page.route(/\/api\/v1\/events\/e1\/revisions\?.*$/, (route) =>
    route.fulfill({
      json: { items: [olderRevision], total: 2, limit: 50, offset: 1 }
    })
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/events/e1");
  await expect(page.getByRole("heading", { name: "Ananya & Rohan wedding" })).toBeVisible();

  await page.getByRole("button", { name: "Load older proposals" }).click();
  await expect(page.locator("#proposals")).toContainText("280 guests");
  await expect(page.getByRole("button", { name: "Load older proposals" })).toHaveCount(0);

  await page.getByRole("button", { name: "Load older revisions" }).click();
  await expect(page.locator("#revisions")).toContainText("Version 1");
  await expect(page.getByRole("button", { name: "Load older revisions" })).toHaveCount(0);
});

test("proposal rejection dialog opens with safe focus and cancels cleanly", async ({ page }) => {
  mkdirSync("test-results/workspace", { recursive: true });
  await mock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/events/e1");

  const reject = page.getByRole("button", { name: "Reject", exact: true });
  await reject.click();

  const dialog = page.getByRole("dialog", { name: "Reject this proposal?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("260 guests");
  await expect(dialog).toContainText("Base version v1");
  await expect(dialog.getByRole("button", { name: "Keep proposal" })).toBeFocused();
  await audit(page, "rejection dialog");
  await page.screenshot({ path: "test-results/workspace/reject-dialog-desktop.png" });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(reject).toBeFocused();

  await reject.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(8, 400);
  await expect(dialog).toBeHidden();
  await expect(reject).toBeFocused();

  await page.setViewportSize({ width: 375, height: 812 });
  await reject.click();
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  await page.screenshot({ path: "test-results/workspace/reject-dialog-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(reject).toBeFocused();
});

test("proposal rejection reports failure in the dialog and confirms success", async ({ page }) => {
  await mock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/v1/events/e1/proposals/p1/reject", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: "conflict",
          message: "This proposal is no longer a draft.",
          details: {},
          request_id: "req-reject"
        }
      }
    });
  });
  await page.goto("/events/e1");

  const reject = page.getByRole("button", { name: "Reject", exact: true });
  await reject.click();
  const dialog = page.getByRole("dialog", { name: "Reject this proposal?" });
  await dialog.getByRole("button", { name: "Reject proposal" }).click();

  await expect(dialog.getByRole("button", { name: "Rejecting…" })).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("no longer a draft");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Keep proposal" }).click();
  await expect(dialog).toBeHidden();
  await expect(reject).toBeFocused();

  await page.unroute("**/api/v1/events/e1/proposals/p1/reject");
  await page.route("**/api/v1/events/e1/proposals/p1/reject", (route) =>
    route.fulfill({
      json: {
        ...plan.proposals[0],
        status: "rejected",
        decided_at: "2026-10-25T00:00:00Z"
      }
    })
  );

  await reject.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Reject proposal" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Proposal rejected. The plan is unchanged.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Proposals" })).toBeFocused();
});

test("equal-version baseline drift is explained and approval is blocked", async ({ page }) => {
  await mock(page);
  await page.unroute("**/api/v1/events/e1/plan");
  await page.route("**/api/v1/events/e1/plan", (route) =>
    route.fulfill({
      json: {
        ...plan,
        proposals: [
          {
            ...plan.proposals[0],
            base_version: 2,
            baseline_hash: "b".repeat(64)
          }
        ]
      }
    })
  );
  await page.goto("/events/e1");

  await expect(
    page.getByText("The plan changed after this draft was made, even though the event version is unchanged.")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
});

test("simulation preview clears on input edits and drafts bind to its baseline", async ({ page }) => {
  await mock(page);
  const simulation = {
    change_kind: "guest_count",
    feasible: true,
    base_version: 2,
    baseline_hash: BASELINE,
    baseline: totals,
    projected: { ...totals, guest_count: 260 },
    lines: [],
    task_changes: [],
    ceremony_changes: [],
    conflicts: [],
    alternatives: [],
    alternative_notes: [],
    assumptions: [],
    vendor_impacts: []
  };
  await page.route("**/api/v1/events/e1/simulate", (route) =>
    route.fulfill({ json: simulation })
  );
  let createBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/events/e1/proposals", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    createBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        ...plan.proposals[0],
        id: "pnew",
        base_version: 2,
        baseline_hash: BASELINE,
        scenario: { kind: "guest_count", guest_count: 260 }
      }
    });
  });

  await page.goto("/events/e1");
  const guests = page.locator("#sim-guests");
  await guests.fill("260");
  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByRole("heading", { name: "Simulation result" })).toBeVisible();

  await guests.fill("270");
  await expect(page.getByRole("heading", { name: "Simulation result" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Draft proposal for this change" })).toBeHidden();

  await guests.fill("260");
  await page.getByRole("button", { name: "Simulate" }).click();
  await page.getByRole("button", { name: "Draft proposal for this change" }).click();
  await expect(page.getByText("Proposal drafted. Review it below before approving.")).toBeVisible();
  expect(createBody).toMatchObject({
    expected_base_version: 2,
    expected_baseline_hash: BASELINE,
    change: { kind: "guest_count", guest_count: 260 }
  });
  await expect(page.getByRole("heading", { name: "Simulation result" })).toBeHidden();
});
