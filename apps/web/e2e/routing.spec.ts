import { expect, test } from "@playwright/test";

test("unknown SPA routes render the app while API routes stay JSON 404", async ({
  page,
  request
}) => {
  await page.goto("/not-a-real-route");

  await expect(page).toHaveURL(/\/not-a-real-route$/);
  await expect(
    page.getByRole("heading", { name: "We could not find that page." })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Your events" })).toHaveAttribute(
    "href",
    "/events"
  );

  const api = await request.get("/api/v1/not-a-real-route");
  expect(api.status()).toBe(404);
  expect(api.headers()["content-type"]).toContain("application/json");
  expect((await api.json()).error.code).toBe("not_found");
});
