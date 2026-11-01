import { expect, test } from "@playwright/test";

test("a guest create whose response is lost retries with the same key", async ({ page }) => {
  const email = `idem-e2e-${Date.now()}@example.com`;
  const guestName = `Ishaan ${Date.now()}`;

  await page.goto("/login");
  await page.getByRole("button", { name: "Need an account? Sign up" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/events$/);

  await page.getByLabel("Event name").fill("Idempotency wedding");
  await page.getByLabel("Event date").fill("2027-02-14");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
  const eventId = new URL(page.url()).pathname.split("/").pop();
  if (!eventId) throw new Error("event id missing from the workspace URL");

  const keys: string[] = [];
  let firstRequest = true;
  await page.route("**/api/v1/events/*/guests", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const key = route.request().headers()["idempotency-key"];
    expect(key).toBeTruthy();
    keys.push(key);

    if (firstRequest) {
      firstRequest = false;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  const guestSection = page.locator("section", {
    has: page.getByRole("heading", { name: "Guests" })
  });
  await page.getByLabel("Guest name").fill(guestName);
  await page.getByRole("button", { name: "Add guest" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Guest name")).toHaveValue(guestName);
  await expect(guestSection.getByText(guestName, { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Add guest" }).click();
  await expect(guestSection.getByText(guestName, { exact: true })).toHaveCount(1);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);

  const plan = await page.request.get(`/api/v1/events/${eventId}/plan`);
  expect(plan.status()).toBe(200);
  const body = (await plan.json()) as { guests: { full_name: string }[] };
  expect(body.guests.filter((guest) => guest.full_name === guestName)).toHaveLength(1);
});
