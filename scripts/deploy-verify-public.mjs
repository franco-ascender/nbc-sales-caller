import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Public-only smoke check. Never accepts credentials or starts a voice session.
const [baseUrl, outputDirectory, dependencyRoot] = process.argv.slice(2);
if (!baseUrl || !outputDirectory || !dependencyRoot) throw new Error('Usage: node scripts/deploy-verify-public.mjs URL EVIDENCE_DIR ISOLATED_STAGE');
const base = new URL(baseUrl);
assert(!base.username && !base.password && !base.search && !base.hash);
assert(base.protocol === 'https:' || (base.protocol === 'http:' && base.hostname === '127.0.0.1'));
const require = createRequire(resolve(dependencyRoot, 'package.json'));
const { chromium } = require('playwright');
mkdirSync(outputDirectory, { recursive: true });
const routes = ['/', '/caller', '/lead-engine', '/academy', '/ask-anas', '/integrations'];
const report = { at: new Date().toISOString(), baseUrl, browser: 'Chrome, fresh contexts, no credentials', routes: [], navigation: [], apis: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    let errors = [];
    page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
    page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', message: message.text() }); });
    page.on('response', response => { if (response.status() >= 400) errors.push({ type: 'http', status: response.status(), path: new URL(response.url()).pathname }); });
    page.on('requestfailed', request => errors.push({ type: 'requestfailed', path: new URL(request.url()).pathname, message: request.failure()?.errorText }));
    for (const route of routes) {
      errors = [];
      const response = await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
      await page.locator('main h1').first().waitFor();
      const measurements = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      const row = { device, route, status: response.status(), finalUrl: page.url(), title: await page.locator('main h1').first().innerText(), ...measurements, errors: [...errors] };
      report.routes.push(row);
      await page.screenshot({ path: resolve(outputDirectory, `${device}-${route === '/' ? 'home' : route.slice(1)}.png`), fullPage: true });
      assert.equal(row.status, 200);
      assert.equal(new URL(page.url()).origin, base.origin, 'Unexpected login redirect');
      assert(row.document <= row.viewport, `Horizontal overflow: ${device} ${route}`);
    }
    for (const route of routes) {
      if (device === 'mobile') await page.getByRole('button', { name: 'Open platform navigation', exact: true }).click();
      const link = page.getByRole('navigation', { name: 'Platform navigation' }).locator(`a[href="${route}"]`);
      await link.click();
      await page.waitForURL(new URL(route, base).href);
      await page.waitForLoadState('networkidle');
      assert.equal(await page.locator(`#platform-navigation a[href="${route}"]`).getAttribute('aria-current'), 'page');
      if (device === 'mobile') assert.equal(await page.getByRole('button', { name: 'Open platform navigation', exact: true }).getAttribute('aria-expanded'), 'false');
      report.navigation.push({ device, route, passed: true });
    }
    if (device === 'mobile') {
      await page.getByRole('button', { name: 'Open platform navigation', exact: true }).click();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('button', { name: 'Open platform navigation', exact: true }).getAttribute('aria-expanded'), 'false');
      report.navigation.push({ device, action: 'Escape closes menu', passed: true });
    }
    await context.close();
  }
  const checks = [
    ['GET', '/api/caller/sessions', 401],
    ['POST', '/api/caller/sessions', 401],
    ['POST', '/api/caller/sessions/00000000-0000-4000-8000-000000000000/sync', 401],
    ['GET', '/api/integrations/events', 401],
    ['POST', '/api/integrations/ghl/test', 401],
    ['POST', '/api/webhooks/ghl', 503],
    ['GET', '/api/integrations/status', 200],
  ];
  for (const [method, path, expected] of checks) {
    const response = await fetch(new URL(path, base), { method, redirect: 'manual', headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {}, body: method === 'POST' ? '{}' : undefined, signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    report.apis.push({ method, path, status: response.status, body, cacheControl: response.headers.get('cache-control') });
    assert.equal(response.status, expected, `${method} ${path}`);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
  }
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(resolve(outputDirectory, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, routes: report.routes.length, navigation: report.navigation.length, apis: report.apis.length, failure: report.failure }));
}
