import { test, expect } from "@playwright/test";

test("master workspace links to separate modules and survives direct navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your next chapter starts here." })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Platform navigation", exact: true });
  await navigation.getByRole("link", { name: "Caller", exact: true }).click();
  await expect(page).toHaveURL(/\/caller$/);
  await expect(page.getByLabel("Operator email")).toBeVisible();
  await page.reload();
  await expect(navigation.getByRole("link", { name: "Caller", exact: true })).toHaveAttribute("aria-current", "page");
  await navigation.getByRole("link", { name: "Integrations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Everything, connected." })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/caller$/);
  expect(await page.locator("main").count()).toBe(1);
});

test("Lead Engine plans locally, shows budget failures and exports a draft without contact data", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", request => { if (/outscraper|batchdata|apollo\.io/.test(request.url())) externalRequests.push(request.url()); });
  await page.goto("/lead-engine");
  await expect(page.getByRole("heading", { name: "Build your next opportunity." })).toBeVisible();
  await page.getByLabel("Hard budget (USD)").fill("10");
  await expect(page.getByText("Plan exceeds your budget", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pilot not connected" })).toBeDisabled();
  await page.getByLabel("Industry", { exact: true }).fill("Unknown niche");
  await expect(page.getByLabel("How does this business operate?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download plan" })).toBeDisabled();
  await page.getByLabel("How does this business operate?").selectOption("C");
  await expect(page.getByText("Cost rule needs resolution", { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download plan" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("nbc-lead-engine-plan.json");
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Expected downloaded plan stream");
  const parts: Buffer[] = [];
  for await (const chunk of stream) parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const data = JSON.parse(Buffer.concat(parts).toString("utf8")) as { executionEnabled: boolean; containsContactData: boolean; lane: string; overBudget: boolean };
  expect(data).toMatchObject({ executionEnabled: false, containsContactData: false, lane: "C", overBudget: true });
  expect(externalRequests).toEqual([]);
});

test("master navigation works on mobile without overflowing the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Open platform navigation", exact: true }).click();
  await page.getByRole("navigation", { name: "Platform navigation", exact: true }).getByRole("link", { name: "Lead Engine", exact: true }).click();
  await expect(page).toHaveURL(/\/lead-engine$/);
  await expect(page.getByRole("heading", { name: "Build your next opportunity." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Open platform navigation", exact: true })).toBeVisible();
});

test("Academy validates local inventory, preserves it after an invalid import and never fetches video references", async ({ page }) => {
  const videoRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("videos.example.test")) videoRequests.push(request.url()); });
  await page.goto("/academy");
  await expect(page.getByRole("heading", { name: "A new home for your knowledge." })).toBeVisible();
  await expect(page.getByText("Your courses will appear here.", { exact: true })).toBeVisible();
  const manifest = { version: 1, courses: [{ id: "sales", title: "Test course inventory", modules: [{ id: "discovery", title: "Discovery skills", lessons: [{ id: "listen", title: "Listening first", videoUrl: "https://videos.example.test/lesson.mp4" }, { id: "questions", title: "Better questions" }] }] }] };
  await page.getByLabel("Course inventory JSON").setInputFiles({ name: "test-inventory.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(manifest)) });
  await expect(page.getByText("Test course inventory", { exact: true })).toBeVisible();
  await expect(page.getByText("Reference added", { exact: true })).toBeVisible();
  await expect(page.getByText("Video pending", { exact: true })).toBeVisible();
  await page.getByLabel("Course inventory JSON").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"version":2,"courses":[]}') });
  await expect(page.locator("main").getByRole("alert")).toContainText("Your previous inventory is still available below.");
  await expect(page.getByText("Test course inventory", { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export inventory", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe("nbc-academy-inventory.json");
  expect(videoRequests).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/ask-anas");
  await expect(page.getByRole("heading", { name: "The methodology, within reach." })).toBeVisible();
  await expect(page.getByText("Ask Anas is being prepared.", { exact: false })).toBeVisible();
});
