// Session/role regression against isolated Next. Workspace authorization uses the synthetic HTTP Auth/Members backend.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.L01_REVIEW_BASE_URL;
if (!/^http:\/\/127\.0\.0\.1:(?!3000\b)\d+$/.test(base ?? '')) throw Error('Isolated loopback required');
const out = process.env.L01_REVIEW_ARTIFACT_DIR;
if (!out) throw Error('Set own artifact directory');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [];
const ids = { admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', student: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', coach: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' };
try {
  for (const role of ['admin', 'student', 'coach']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
    let logins = 0, providerChecks = 0;
    await context.route('**/auth/v1/token**', route => {
      logins++;
      return route.fulfill({ json: { access_token: `l01-${role}`, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600,
        user: { id: ids[role], email: `${role}@example.test`, email_confirmed_at: '2026-09-15T00:00:00Z', aud: 'authenticated', app_metadata: {}, user_metadata: {} } } });
    });
    await context.route('**/auth/v1/logout**', route => route.fulfill({ status: 204 }));
    await context.route('**/api/profile', route => route.fulfill({ json: { name: 'Review fixture', email: `${role}@example.test`, role, avatarTone: 'blue', completedAt: null, business: '', goal: '', questions: '', timezone: 'America/New_York' } }));
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.name));
    page.on('request', request => { if (request.url().endsWith('/api/lead-engine/connections/check')) providerChecks++; });
    async function noModuleLogin() {
      assert.equal(await page.getByLabel('Operator email', { exact: true }).count(), 0);
      assert.equal(await page.locator('input[type="password"]').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Sign in to save plans', exact: true }).count(), 0);
    }
    await page.goto(base + '/lead-engine');
    await page.getByLabel('Email address', { exact: true }).fill(`${role}@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Enter NBC Sales', exact: true }).click();
    await page.getByRole('heading', { name: 'Lead Engine', exact: true }).waitFor();
    await noModuleLogin();
    assert.equal(await page.getByRole('tab', { name: 'Connections', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Check provider access', exact: true }).count(), 0);
    const state = role === 'admin' ? "Saving isn't available yet" : 'Saved research is not available for your account yet. Your draft is still available to download.';
    await page.getByText(state, { exact: true }).first().waitFor();
    await page.getByRole('tab', { name: 'Lead lists', exact: true }).click();
    await noModuleLogin();
    if(role==='admin'){await page.getByRole('button',{name:'Refresh lists',exact:true}).click();await page.getByRole('button',{name:'Create folder',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Create folder',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('status',{name:'Saving availability',exact:true}).count(),1);}
    await page.getByRole('tab', { name: 'Evidence workspace', exact: true }).click();
    await page.getByRole('heading', { name: 'Your research will land here.' }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Lead Engine', exact: true }).waitFor();
    await noModuleLogin(); assert.equal(logins, 1);
    checks.push(`${role}: one login across tabs and reload; no Connections`);
    await page.goto(base + '/settings');
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    await page.getByLabel('Full name', { exact: true }).waitFor();
    await noModuleLogin(); assert.equal(logins, 1);
    if (role === 'admin') {
      await page.getByRole('heading', { name: 'Lead providers', exact: true }).waitFor();
      assert.equal(providerChecks, 0, 'opening settings does not contact providers');
      await page.getByRole('button', { name: 'Check provider access', exact: true }).click();
      await page.getByText('API token not configured', { exact: true }).waitFor();
      assert.equal(providerChecks, 1);
      await page.locator('section[aria-labelledby="lead-provider-settings-title"]').screenshot({ animations: 'disabled', style: 'header[class*="topbar"] {visibility:hidden}', path: out + '/admin-settings-desktop.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('section[aria-labelledby="lead-provider-settings-title"]').screenshot({ animations: 'disabled', style: 'header[class*="topbar"] {visibility:hidden}', path: out + '/admin-settings-mobile.png' });
      checks.push('admin: private settings visible, manual server-authorized diagnosis, mobile');
    } else {
      assert.equal(await page.getByRole('heading', { name: 'Lead providers', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Check provider access', exact: true }).count(), 0);
      assert.equal(providerChecks, 0);
      const response = await context.request.post(base + '/api/lead-engine/connections/check', { headers: { Authorization: `Bearer l01-${role}` }, data: {} });
      assert.equal(response.status(), 403);
      await page.screenshot({ animations: 'disabled', path: out + `/${role}-settings-desktop.png`, fullPage: true });
      checks.push(`${role}: settings omit providers; direct API 403`);
    }
    // Global logout clears module state; restoration never asks for a second module password.
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Enter NBC Sales', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Lead providers', exact: true }).count(), 0);
    assert.equal(logins, 1); assert.deepEqual(errors, []);
    await context.close();
  }
  // A recoverable authorization error must not create a second authentication flow.
  const context = await browser.newContext(); const page = await context.newPage(); let planStatus = 401;
  await context.route('**/auth/v1/token**', route => route.fulfill({ json: { access_token: 'l01-admin', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, user: { id: ids.admin, aud: 'authenticated', app_metadata: {}, user_metadata: {} } } }));
  await context.route('**/api/lead-engine/plans?**', route => route.fulfill({ status: planStatus, json: planStatus === 200 ? { plans: [], nextOffset: null } : { error: 'Synthetic auth error' } }));
  await page.goto(base + '/lead-engine'); await page.getByLabel('Email address', { exact: true }).fill('admin@example.test'); await page.getByLabel('Password', { exact: true }).fill('synthetic-password'); await page.getByRole('button', { name: 'Enter NBC Sales', exact: true }).click();
  await page.getByText(/Your NBC session could not be verified/).waitFor(); assert.equal(await page.locator('input[type="password"]').count(), 0);
  planStatus = 200; await page.getByRole('button', { name: 'Refresh saved plans', exact: true }).click(); await page.getByText('No saved plans yet. Save your first draft snapshot.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save draft snapshot', exact: true }).isDisabled(), false); assert.equal(await page.getByLabel('Industry', { exact: true }).inputValue(), 'Roofing');
  checks.push('401 recovers through the shared session without module credentials; draft preserved');
  await context.close();
  await writeFile(out + '/session-checks.json', JSON.stringify({ passed: true, checks, apiAndWorkspaceGuard: 'real Next route with synthetic Auth/Members HTTP', profileAndPasswordLogin: 'fixtures', paidCalls: 0 }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} finally { await browser.close(); }
