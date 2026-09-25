import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("authenticated caller filters saved history and downloads only verified transcripts", async ({ page }) => {
  const completed = {
    id: "9ac3ece1-c7be-4c58-9114-ea368a40d4a6", provider: "elevenlabs", provider_call_id: "test-provider-id",
    channel: "web", status: "completed", created_at: "2026-09-14T10:00:00Z", started_at: "2026-09-14T10:00:01Z",
    ended_at: "2026-09-14T10:01:01Z", duration_seconds: 60, synced_at: "2026-09-14T10:02:00Z",
    summary: "Agency needs faster follow-up.", failure_code: null,
    transcript: [{ role: "user", message: "We get twenty leads each week.", time_in_call_secs: 2 }],
  };
  const pending = { ...completed, id: "5faf0b9b-b2ac-4b91-9964-dd62896a046d", status: "processing", duration_seconds: null, summary: null, transcript: [], synced_at: null };
  await page.route("**/auth/v1/token?grant_type=password", route => route.fulfill({ json: {
    access_token: "test-operator-token", token_type: "bearer", expires_in: 3600, refresh_token: "test-refresh-token",
    user: { id: "test-operator", email: "operator@example.test", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-09-14T00:00:00Z" },
  } }));
  await page.route("**/api/caller/sessions", route => route.fulfill({ json: { configured: true, sessions: [completed, pending] } }));
  await page.route("**/api/caller/sessions/reconcile", route => route.fulfill({ json: { results: [], nextCursor: null } }));
  await page.route("**/api/caller/sessions/*/sync", route => route.fulfill({ json: { session: route.request().url().includes(completed.id) ? completed : pending } }));
  await page.route("**/api/workspace/session", route => route.fulfill({ json: { user: { id: "00000000-0000-4000-8000-000000000999", name: "DEMO Operator", role: "admin" } } }));
  await page.route("**/api/caller/leads", route => route.fulfill({ json: { leads: [], configured: true, hasMore: false } }));
  await page.route("**/api/caller/lists*", route => route.fulfill({ json: { lists: [] } }));
  await page.route("**/api/caller/demo", route => route.fulfill({ json: { available: true, exists: false } }));
  await page.goto("/caller");
  await page.getByLabel("Email address").fill("operator@example.test");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Enter NBC Sales" }).click();
  await page.getByRole("tab", { name: "AI Caller", exact: true }).click();
  await page.getByRole("button", { name: "Conversation history", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start voice test" })).toBeVisible();
  await expect(page.getByText("1 duration still unknown")).toBeVisible();
  await page.getByLabel("Search saved sessions").fill("twenty");
  await expect(page.getByText("1 of 2 loaded sessions")).toBeVisible();
  await expect(page.getByText("Of 2 recent sessions", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View result", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download transcript" })).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download transcript" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(`nbc-caller-${completed.id}.txt`);
  const path = await download.path();
  expect(path).not.toBeNull();
  const text = await readFile(path!, "utf8");
  expect(text).toContain("[0:02] You: We get twenty leads each week.");
  expect(text).not.toContain("test-provider-id");
  await page.getByLabel("Search saved sessions").fill("");
  await page.getByLabel("Filter saved session status", { exact: true }).selectOption("processing");
  await page.getByRole("button", { name: "Refresh result", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download transcript" })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeEnabled();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Conversation result" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enter NBC Sales" })).toBeVisible();
});
