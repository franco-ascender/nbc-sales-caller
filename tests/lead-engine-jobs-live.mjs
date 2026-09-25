// Live check of the published Owner cells tab with the NBC operator account. Read-only: it logs in,
// opens the tab, records what the credits and jobs calls answer, and screenshots. No job is created.
// L03_LIVE_BASE_URL=https://nbc-sales-nbc-sales.vercel.app node tests/lead-engine-jobs-live.mjs
import { chromium } from 'playwright';
import { loadEnvFile } from 'node:process';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (existsSync('.env.local')) loadEnvFile('.env.local');
const base = process.env.L03_LIVE_BASE_URL || 'https://nbc-sales-nbc-sales.vercel.app';
const email = process.env.NBC_OPERATOR_EMAIL, password = process.env.NBC_OPERATOR_INITIAL_PASSWORD;
if (!email || !password) throw Error('NBC_OPERATOR_EMAIL and NBC_OPERATOR_INITIAL_PASSWORD are required in .env.local.');
const artifact = fileURLToPath(new URL('../artifacts/lanes/L03/jobs-ui-live/', import.meta.url));
await mkdir(artifact, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const answers = [];
  page.on('response', response => { const url = response.url(); if (url.includes('/api/lead-engine/')) answers.push(`${response.request().method()} ${new URL(url).pathname} -> ${response.status()}`); });
  await page.goto(`${base}/lead-engine`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Enter NBC Sales' }).click();
  await page.getByRole('heading', { name: /Lead Engine/ }).waitFor({ timeout: 60000 });
  await page.getByRole('tab', { name: 'Owner cells' }).waitFor();
  await page.getByRole('heading', { name: 'Owner cells by the job' }).waitFor();
  await page.getByRole('tab', { name: 'Registers' }).click();
  await page.getByRole('heading', { name: /Registers/ }).waitFor();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${artifact}/registers-live.png`, fullPage: true });
  await page.getByRole('tab', { name: 'Brain (admin)' }).click();
  await page.getByRole('heading', { name: 'The logic behind every contact.' }).waitFor();
  await page.getByText('Industries and their logic').waitFor();
  await page.screenshot({ path: `${artifact}/brain-live.png`, fullPage: true });
  await page.getByRole('tab', { name: 'Owner cells' }).click();
  await page.waitForTimeout(4000);
  const alert = await page.locator('[role="alert"]').allTextContents();
  await page.screenshot({ path: `${artifact}/owner-cells-live.png`, fullPage: true });
  console.log(JSON.stringify({ base, tabVisible: true, apiAnswers: answers, alerts: alert, screenshot: `${artifact}/owner-cells-live.png` }, null, 2));
} finally { await browser.close(); }
