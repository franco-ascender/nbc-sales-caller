import { test, expect } from "@playwright/test";

test("Caller shows its private login and does not expose test records anonymously", async ({ page, request }) => {
  await page.goto("/caller");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start voice test" })).toHaveCount(0);
  expect((await request.get("/api/caller/sessions")).status()).toBe(401);
  expect((await request.post("/api/caller/sessions", { data: { sessionId: "9ac3ece1-c7be-4c58-9114-ea368a40d4a6" } })).status()).toBe(401);
  expect((await request.post("/api/caller/sessions/9ac3ece1-c7be-4c58-9114-ea368a40d4a6/sync")).status()).toBe(401);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
