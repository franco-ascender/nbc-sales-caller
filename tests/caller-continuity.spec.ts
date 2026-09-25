import { expect, test } from "@playwright/test";
import type { CallSession } from "../src/lib/caller-types";
const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fixture = (n: number): CallSession => ({ id: id(n), provider: "elevenlabs", provider_call_id: `fixture-${n}`, channel: "web", status: "completed", created_at: "2026-09-14T10:00:00.123456Z", started_at: null, ended_at: null, duration_seconds: 12, transcript: [{ role: "user", message: `C01 DEMO fixture ${n}`, time_in_call_secs: 1 }], summary: `C01 DEMO fixture ${n} — synthetic test data`, failure_code: null, synced_at: "2026-09-14T10:02:00Z" });

test("C01 fixture history: recovery, pagination, retry, selection races, desktop and mobile", async ({ page }) => {
  page.on("pageerror", error => console.error("Caller continuity page error:", error.stack ?? error.message));
  const rows = Array.from({ length: 65 }, (_, index) => fixture(65 - index));
  rows[0] = { ...rows[0], status: "processing", synced_at: null, summary: "C01 DEMO pending fixture", transcript: [] };
  let recoveryCount = 0;
  let pageCount = 0;
  let voiceCreates = 0;
  let failPage = true;
  let releaseSync: (() => void) | undefined;
  await page.route("**/auth/v1/token?grant_type=password", route => route.fulfill({ json: { access_token: "c01-fixture-token", refresh_token: "fixture", token_type: "bearer", expires_in: 3600, user: { id: id(999), email: "operator@example.test", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-09-14T00:00:00Z" } } }));
  await page.route("**/api/caller/**", async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/caller/sessions")) return route.fallback();
    if (url.pathname.endsWith("/reconcile")) {
      recoveryCount++;
      await new Promise(resolve => setTimeout(resolve, 100));
      return route.fulfill({ json: { results: [{ sessionId: id(65), outcome: "retry", error: "Fixture recovery failure" }], nextCursor: recoveryCount === 1 ? "recovery-page-2" : null } });
    }
    if (url.pathname.endsWith("/sync")) {
      await new Promise<void>(resolve => { releaseSync = resolve; });
      return route.fulfill({ json: { session: fixture(65) } });
    }
    if (route.request().method() === "POST") { voiceCreates++; return route.fulfill({ status: 400, json: { error: "Voice creation forbidden in C01 fixtures" } }); }
    const offset = Number(url.searchParams.get("cursor") ?? 0);
    if (offset) {
      pageCount++;
      await new Promise(resolve => setTimeout(resolve, 120));
      if (failPage) { failPage = false; return route.fulfill({ status: 503, json: { error: "Fixture page temporarily unavailable. Try Load more again." } }); }
    }
    return route.fulfill({ json: { sessions: rows.slice(offset, offset + 30), configured: true, nextCursor: offset + 30 < rows.length ? String(offset + 30) : null } });
  });
  await page.route("**/api/workspace/session", route => route.fulfill({ json: { user: { id: "00000000-0000-4000-8000-000000000999", name: "DEMO Operator", role: "admin" } } }));
  await page.route("**/api/caller/leads", route => route.fulfill({ json: { leads: [], configured: true, hasMore: false } }));
  await page.route("**/api/caller/lists*", route => route.fulfill({ json: { lists: [] } }));
  await page.route("**/api/caller/demo", route => route.fulfill({ json: { available: true, exists: false } }));
  await page.goto("/caller");
  await page.getByLabel("Email address").fill("operator@example.test");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button", { name: "Enter NBC Sales" }).click();
  await page.getByRole("tab", { name: "AI Caller", exact: true }).click();
  await page.getByRole("button", { name: "Conversation history", exact: true }).click();
  await expect(page.getByText(/Checked 1:.*1 need a retry/)).toBeVisible();
  expect(recoveryCount).toBe(1);
  await page.getByRole("button", { name: "Recover next batch" }).click();
  await expect(page.getByRole("button", { name: "Recover next batch" })).toHaveCount(0);
  expect(recoveryCount).toBe(2);
  await page.getByRole("button", { name: "Load more", exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole("alert").filter({ hasText: "Fixture page" })).toContainText("Fixture page temporarily unavailable");
  expect(pageCount).toBe(1);
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(page.getByText("60 sessions loaded.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(page.getByText("65 sessions loaded.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "View result", exact: true })).toHaveCount(64);
  await page.getByLabel("Search saved sessions").fill("fixture 1");
  await expect(page.getByText("11 of 65 loaded sessions", { exact: true })).toBeVisible();
  await expect(page.getByText("Of 30 recent sessions", { exact: true })).toBeVisible();
  await page.getByLabel("Search saved sessions").fill("");
  await page.getByRole("button", { name: "Refresh result", exact: true }).click();
  await expect.poll(() => Boolean(releaseSync)).toBe(true);
  await page.getByRole("button", { name: "View result", exact: true }).first().click();
  releaseSync?.();
  await expect(page.getByText(`Session ${id(64)}`, { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download transcript" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "View result", exact: true })).toHaveCount(65);
  // Keep evidence compact and unmistakably synthetic.
  await page.getByLabel("Search saved sessions").fill("fixture 65");
  await page.getByRole("button", { name: "View result", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/lanes/C03/browser/C01-regression-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Download transcript" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/lanes/C03/browser/C01-regression-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Refresh history" }).click();
  await expect(page.getByText("30 sessions loaded.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Conversation result" })).toHaveCount(0);
  expect(voiceCreates).toBe(0);
});
