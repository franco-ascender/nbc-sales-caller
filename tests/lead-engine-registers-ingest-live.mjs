// Live, free: logs in to production, presses Ingest on OR CCB for four minutes, pauses, reports counts.
// node tests/lead-engine-registers-ingest-live.mjs
import { chromium } from 'playwright';
import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');
const base = 'https://nbc-sales-nbc-sales.vercel.app';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  await page.goto(`${base}/lead-engine`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address', { exact: true }).fill(process.env.NBC_OPERATOR_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.NBC_OPERATOR_INITIAL_PASSWORD);
  await page.getByRole('button', { name: 'Enter NBC Sales' }).click();
  await page.getByRole('tab', { name: 'Registers' }).click();
  const row = page.locator('tr', { hasText: 'or_ccb' });
  await row.waitFor();
  await row.getByRole('button', { name: /Ingest|Resume/ }).click();
  await page.waitForTimeout(240000);
  const text = await row.innerText();
  const running = await row.getByRole('button', { name: /pause/ }).count();
  if (running) await row.getByRole('button', { name: /pause/ }).click();
  await page.waitForTimeout(25000);
  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.waitForTimeout(4000);
  console.log(JSON.stringify({ rowBefore: text.replace(/\s+/g, ' '), rowAfter: (await row.innerText()).replace(/\s+/g, ' ') }, null, 2));
  await page.screenshot({ path: 'artifacts/lanes/L03/jobs-ui-live/registers-or-ccb-live.png', fullPage: true });
} finally { await browser.close(); }
