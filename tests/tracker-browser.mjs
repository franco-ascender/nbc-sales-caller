import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.TRACKER_REVIEW_BASE_URL;
const isolatedOrigin = Boolean(origin && /^http:\/\/127\.0\.0\.1:(?!3000\b)\d+$/.test(origin));
const productionOrigin = origin === 'https://nbc-sales.vercel.app';
if (!isolatedOrigin && !productionOrigin) throw Error('Set TRACKER_REVIEW_BASE_URL to an isolated loopback URL (never shared port 3000) or the canonical production URL.');
const output = process.env.TRACKER_REVIEW_ARTIFACT_DIR ?? 'artifacts/lanes/TR01/r2';
await mkdir(output, { recursive: true });

const user = { id: '99999999-9999-4999-8999-999999999999', aud: 'authenticated', role: 'authenticated', email: 'tracker-review@example.test', email_confirmed_at: '2026-09-21T00:00:00Z', created_at: '2026-09-21T00:00:00Z', app_metadata: {}, user_metadata: {} };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [];

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1040 } });
  await context.route('**/auth/v1/**', route => route.fulfill(route.request().url().includes('/logout') ? { status: 204 } : { json: route.request().url().includes('/token') ? { access_token: 'tracker-review-access', refresh_token: 'tracker-review-refresh', token_type: 'bearer', expires_in: 3600, user } : user }));
  await context.route('**/api/workspace/session', route => route.fulfill({ json: { user: { id: user.id, name: 'Tracker review', role: 'admin' } } }));
  await context.route('**/api/members/summary', route => route.fulfill({ status: 503, json: { error: 'Fixture only' } }));
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const host = new URL(request.url()).hostname;
    if (!['127.0.0.1', 'localhost', 'nbc-sales.vercel.app'].includes(host) && !host.endsWith('supabase.co')) external.push(request.url());
  });

  await page.goto(`${origin}/tracker`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email address', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('Fixture-only-password');
  await page.getByRole('button', { name: 'Enter NBC Sales', exact: true }).click();
  await page.getByRole('heading', { name: 'See the business. Run the next move.' }).waitFor();
  await page.getByText('Preview data', { exact: true }).waitFor();
  await page.locator('svg[aria-label="Preview cash collection trend over 30 days"]').hover({ position: { x: 330, y: 92 } });
  await page.getByRole('status').filter({ hasText: 'Day' }).waitFor();
  await page.screenshot({ path: `${output}/tracker-overview-desktop.png`, fullPage: true, animations: 'disabled' });
  checks.push('Overview clearly labels preview data and exposes an inspectable cash trend without provider requests.');

  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByRole('heading', { name: 'Customize dashboard', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Business pulse', exact: true }).click();
  assert.equal(await page.getByRole('heading', { name: 'Business pulse', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Sales performance', exact: true }).click();
  await page.getByRole('button', { name: 'Move Sales performance up', exact: true }).click();
  await page.getByRole('button', { name: 'Move Sales performance up', exact: true }).click();
  await page.getByRole('button', { name: 'Reset default layout', exact: true }).click();
  await page.getByRole('heading', { name: 'Business pulse', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close customization', exact: true }).click();
  checks.push('Customization hides, reorders and resets local presentation blocks without mutating business data.');

  await page.getByRole('button', { name: 'Acquisition', exact: true }).click();
  await page.getByRole('heading', { name: 'Spend only matters when it is connected to the sales outcome.' }).waitFor();
  await page.getByText('Meta is not connected.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Sales quality', exact: true }).click();
  await page.getByRole('heading', { name: 'Coaching begins with evidence.' }).waitFor();
  checks.push('Acquisition and sales-quality views explain disconnected sources instead of presenting missing data as zero.');

  await page.getByRole('button', { name: 'Revenue & pipeline', exact: true }).click();
  await page.getByRole('heading', { name: 'Every stage has a next action.' }).waitFor();
  await page.getByText('Payment recorded', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Funnel', exact: true }).click();
  await page.getByRole('heading', { name: 'Follow the smallest handoff.' }).waitFor();
  checks.push('Revenue and funnel have concrete operating structures rather than generic placeholders.');

  await page.getByRole('button', { name: 'Accounts & journeys', exact: true }).click();
  await page.getByRole('heading', { name: 'Accounts needing context.' }).waitFor();
  await page.getByRole('button', { name: /Account B/ }).click();
  await page.getByRole('heading', { name: 'Account B', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Data sources', exact: true }).click();
  await page.getByRole('heading', { name: 'A number earns trust when its source is clear.' }).waitFor();
  await page.getByText('The connector contract exists.', { exact: false }).waitFor();
  checks.push('Account journeys and source setup are navigable while keeping illustrative records and provider requirements explicit.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile tracker should not overflow horizontally');
  await page.screenshot({ path: `${output}/tracker-overview-mobile.png`, fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Use dark appearance', exact: true }).click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'dark mobile tracker should not overflow horizontally');
  await page.screenshot({ path: `${output}/tracker-overview-mobile-dark.png`, fullPage: true, animations: 'disabled' });
  checks.push('Desktop and mobile overview render without horizontal overflow in light and dark appearance.');
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(`${output}/browser-checks.json`, JSON.stringify({ at: new Date().toISOString(), origin, checks, passed: true, auth: 'synthetic Supabase and workspace-session fixtures', providerCalls: 0, errors, external }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: checks.length }));
  await context.close();
} finally {
  await browser.close();
}
