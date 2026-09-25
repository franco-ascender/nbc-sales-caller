import { test, expect } from "@playwright/test";

test("demo navigation, filtering, details and export work together", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "A better view of every conversation." })).toBeVisible();
  await expect(page.getByText("Demo mode", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/desktop-overview.png", fullPage: true });
  await page.getByRole("button", { name: "View all calls" }).click();
  await page.getByLabel("Filter by outcome").selectOption("Booked");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.getByLabel("Search calls").fill("Olivia");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "View call with Olivia Bennett" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("No recording in this demo")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("nbc-demo-calls.csv");
  await page.getByLabel("Search calls").fill("nothing-matches-this");
  await expect(page.getByText("No conversations found")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.getByLabel("Main navigation").getByRole("button", { name: "Appointments" }).click();
  await expect(page.getByRole("heading", { name: "Discovery conversations" })).toBeVisible();
});

test("integration setup never claims an unverified connection", async ({ page }) => {
  await page.route("**/api/integrations/status", route => route.fulfill({ json: { ghl: false, auth: false, storage: false, webhook: false } }));
  await page.goto("/demo");
  await page.getByLabel("Main navigation").getByRole("button", { name: "Integrations" }).click();
  await expect(page.getByRole("heading", { name: "Everything, connected." })).toBeVisible();
  await expect(page.getByText("0 of 4 configured")).toBeVisible();
  await page.getByRole("button", { name: "Set up & test" }).click();
  await expect(page.getByRole("button", { name: "Sign in to test workspace" })).toBeDisabled();
  await expect(page.getByText("Your events stay yours.")).toBeVisible();
});

test("real integration endpoints reject anonymous calls and omit secrets", async ({ request }) => {
  const status = await request.get("/api/integrations/status");
  const flags = await status.json() as Record<string, unknown>;
  expect(Object.keys(flags).sort()).toEqual(["auth", "ghl", "storage", "webhook"]);
  expect(Object.values(flags).every(value => typeof value === "boolean")).toBe(true);
  const contact = await request.post("/api/integrations/ghl/test", { data: { contactId: "test-contact" } });
  expect(contact.status()).toBe(401);
  const events = await request.get("/api/integrations/events");
  expect(events.status()).toBe(401);
  const webhook = await request.post("/api/webhooks/ghl", { data: {} });
  expect([401, 503]).toContain(webhook.status());
});

test("mobile navigation and details remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await page.screenshot({ path: "test-results/mobile-overview.png", fullPage: true });
  const overflow = await page.evaluate(() => [...document.querySelectorAll("main *")].filter(element => element.getBoundingClientRect().right > window.innerWidth + 1).map(element => ({ tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width })));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), JSON.stringify(overflow.slice(0, 12))).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByLabel("Main navigation").getByRole("button", { name: "Leads" }).click();
  await expect(page.getByRole("heading", { name: "Your demo pipeline" })).toBeVisible();
  await page.getByLabel("Search leads").fill("Sophia");
  await page.getByRole("button", { name: /Sophia Chen/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close call details" }).click();
  await page.screenshot({ path: "test-results/mobile-leads.png", fullPage: true });
});
