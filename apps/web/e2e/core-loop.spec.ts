import { expect, test } from "@playwright/test";

const ITEMS = [
  { label: "Venue and mandap", category: "Venue", amount: "420000", basis: "fixed" },
  { label: "Catering per guest", category: "Catering", amount: "3800", basis: "per_guest" },
  { label: "Decor and florals", category: "Decor", amount: "150000", basis: "fixed" },
  { label: "Photography and film", category: "Photography", amount: "100000", basis: "fixed" },
  { label: "Attire and styling", category: "Attire", amount: "60000", basis: "fixed" },
  { label: "Invitations per guest", category: "Stationery", amount: "120", basis: "per_guest" },
  { label: "Contingency items", category: "Other", amount: "30000", basis: "fixed" }
];

test("resource forms and the review-gated guest change work in the browser", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/login");
  await page.getByRole("button", { name: "Need an account? Sign up" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/events$/);

  await page.getByLabel("Event name").fill("E2E Wedding");
  await page.getByLabel("City").fill("Hyderabad");
  await page.getByLabel("Event date").fill("2027-02-14");
  await page.getByLabel("Guests", { exact: true }).fill("180");
  await page.getByLabel("Total budget (₹)").fill("1800000");
  await page.getByLabel("Contingency reserve (₹)").fill("180000");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "E2E Wedding" })).toBeVisible();

  const budgetSection = page.locator("section").filter({ hasText: "Budget items" });
  for (const item of ITEMS) {
    await page.getByLabel("Item label").fill(item.label);
    await page.getByLabel("Item category").fill(item.category);
    await page.getByLabel("Rate (₹)", { exact: true }).fill(item.amount);
    await page.getByLabel("Basis").selectOption(item.basis);
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(budgetSection.getByText(item.label)).toBeVisible();
  }

  const ceremonySection = page.locator("section", {
    has: page.getByRole("heading", { name: "Ceremonies" })
  });
  await page.getByLabel("Ceremony name").fill("Mehndi");
  await page.getByLabel("Ceremony guests").fill("40");
  await page.getByLabel("Ceremony venue (optional)").fill("Home");
  await page.getByRole("button", { name: "Add ceremony" }).click();
  await expect(ceremonySection.getByText("Mehndi")).toBeVisible();

  const guestSection = page.locator("section", {
    has: page.getByRole("heading", { name: "Guests" })
  });
  await page.getByLabel("Guest name").fill("Meera");
  await page.getByLabel("Party size").fill("2");
  await page.getByLabel("Dietary tags (optional)").fill("vegetarian");
  await page.getByRole("button", { name: "Add guest" }).click();
  await expect(guestSection.getByText("Meera")).toBeVisible();

  const vendorSection = page.locator("section", {
    has: page.getByRole("heading", { name: "Vendors" })
  });
  await page.getByLabel("Vendor name").fill("Taj Falaknuma");
  await page.getByRole("button", { name: "Add vendor" }).click();
  await expect(vendorSection.getByText("Taj Falaknuma")).toBeVisible();

  const quoteSection = page.locator("section", {
    has: page.getByRole("heading", { name: "Manual quotes" })
  });
  await page.getByLabel("Quote vendor").selectOption({ label: "Taj Falaknuma" });
  await page.getByLabel("Quote amount (₹)").fill("390000");
  await page.getByLabel("Quote budget item").selectOption({ label: "Venue and mandap" });
  await page.getByRole("button", { name: "Add quote" }).click();
  await expect(quoteSection.getByText(/3,90,000/)).toBeVisible();

  const taskSection = page.locator("section", {
    has: page.getByRole("heading", { name: "Timeline, tasks and dependencies" })
  });
  const taskList = taskSection.getByRole("list", { name: "Tasks" });
  await page.getByLabel("Task title").fill("Send invites");
  await page.getByLabel("Task due date").fill("2026-12-01");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(taskList.getByText("Send invites")).toBeVisible();

  await page.getByLabel("Task title").fill("Confirm headcount");
  await page.getByLabel("Task due date").fill("2027-01-01");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(taskList.getByText("Confirm headcount")).toBeVisible();

  await page.getByLabel("Predecessor").selectOption({ label: "Send invites" });
  await page.getByLabel("Successor").selectOption({ label: "Confirm headcount" });
  await page.getByRole("button", { name: "Add dependency" }).click();
  await expect(
    taskSection.getByText(/Send invites must finish before Confirm headcount/)
  ).toBeVisible();

  await page.getByLabel("Guests", { exact: true }).fill("240");
  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByText("Simulation result")).toBeVisible();
  await expect(page).toHaveURL(/#simulate$/);
  await expect(
    page.getByRole("navigation", { name: "Celebration panels" }).getByRole("link", {
      name: "Adaptive Studio",
      exact: true
    })
  ).toHaveAttribute("aria-current", "page");

  const projectedSummary = page.getByRole("region", { name: "Projected budget summary" });
  await expect(projectedSummary).toContainText("₹18,00,000");
  await expect(projectedSummary).toContainText("₹1,80,000");
  await expect(projectedSummary).toContainText("₹16,20,000");
  await expect(projectedSummary).toContainText("₹17,00,800");
  await expect(projectedSummary).toContainText("₹99,200");
  await expect(projectedSummary).toContainText("₹80,800");

  const alternative = page.getByTestId("alternative-increase_budget");
  await expect(alternative).toContainText("Increase the budget");
  await alternative.getByTestId("draft-alternative").click();
  await expect(page.getByText("Proposal drafted.")).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByText("Approved.")).toBeVisible();
  await expect(page.getByText(/240 guests · version 2/)).toBeVisible();

  const currentSummary = page.getByRole("region", { name: "Budget summary" });
  await expect(currentSummary).toContainText("₹18,80,800");
  await expect(currentSummary).toContainText("₹17,00,800");
  await expect(currentSummary).toContainText("₹1,80,000");
  await expect(currentSummary).toContainText("₹0");
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible();

  await page.getByLabel("Event date").fill("2027-02-21");
  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByRole("heading", { name: "Simulation result" })).toBeVisible();
  await expect(page.getByText("Ceremony dates that would move")).toBeVisible();
  await expect(page.getByText(/Mehndi: 14 Feb 2027 → 21 Feb 2027/)).toBeVisible();
  await expect(page.getByText("Task dates that would move")).toBeVisible();
  await expect(page.getByText(/Send invites: 1 Dec 2026 → 8 Dec 2026/)).toBeVisible();

  await page.getByRole("button", { name: "Draft proposal for this change" }).click();
  await expect(page.getByText("Proposal drafted.")).toBeVisible();
  const dateProposal = page
    .locator("#proposals li")
    .filter({ hasText: "Date: 21 Feb 2027" });
  await dateProposal.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved. The plan and revision history are updated.")).toBeVisible();
  await expect(page.locator("#overview")).toContainText("21 Feb 2027");
  await expect(taskList.getByText("8 Dec 2026")).toBeVisible();
  await expect(taskList.getByText("8 Jan 2027")).toBeVisible();
  await expect(ceremonySection.getByText("21 Feb 2027")).toBeVisible();
  await expect(page.locator("#revisions")).toContainText("Event date");
  await expect(page.locator("#revisions")).toContainText("14 Feb 2027 → 21 Feb 2027");
  await expect(page.locator("#revisions")).toContainText("Mehndi");
  await expect(page.locator("#revisions")).toContainText("Send invites");
});
