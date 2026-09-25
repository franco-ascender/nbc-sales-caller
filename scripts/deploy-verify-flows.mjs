import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const [baseUrl, outputDirectory, dependencyRoot] = process.argv.slice(2);
if (!baseUrl || !outputDirectory || !dependencyRoot) throw new Error('Usage: node scripts/deploy-verify-flows.mjs URL EVIDENCE_DIR ISOLATED_STAGE');
const base = new URL(baseUrl);
assert(base.protocol === 'https:' && !base.username && !base.password && !base.search && !base.hash);
const require = createRequire(resolve(dependencyRoot, 'package.json'));
const { chromium } = require('playwright');
mkdirSync(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const report = { at: new Date().toISOString(), baseUrl, checks: [], networkMutations: [] };
page.on('request', request => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) report.networkMutations.push({ method: request.method(), path: new URL(request.url()).pathname });
});
try {
  await page.goto(new URL('/lead-engine', base).href, { waitUntil: 'networkidle' });
  await page.getByLabel('Hard budget (USD)').fill('1');
  await page.getByText('Plan exceeds your budget', { exact: true }).waitFor();
  assert(await page.getByRole('button', { name: 'Download plan', exact: true }).isEnabled());
  report.checks.push('Over-budget warning shown; draft download remains enabled, no spending execution');
  await page.getByLabel('Hard budget (USD)').fill('100');
  const planPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download plan', exact: true }).click();
  const plan = await planPromise;
  JSON.parse(readFileSync(await plan.path(), 'utf8'));
  await page.getByRole('status').filter({ hasText: 'Draft plan downloaded' }).waitFor();
  report.checks.push('Valid draft plan downloads as JSON with success state');
  await page.goto(new URL('/academy', base).href, { waitUntil: 'networkidle' });
  const templatePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download template', exact: true }).click();
  const template = await templatePromise;
  const contents = readFileSync(await template.path());
  await page.getByLabel('Course inventory JSON').setInputFiles({ name: 'DEMO-template.json', mimeType: 'application/json', buffer: contents });
  await page.getByText('Structure validated', { exact: true }).waitFor();
  const before = await page.getByLabel('Current inventory').innerText();
  report.checks.push('Demo template downloaded and imported in browser memory');
  await page.getByLabel('Course inventory JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
  await page.getByRole('alert').filter({ hasText: 'The file is not valid JSON.' }).waitFor();
  assert.equal(await page.getByLabel('Current inventory').innerText(), before);
  report.checks.push('Invalid JSON displays recoverable error and preserves previous inventory');
  const exportPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export inventory', exact: true }).click();
  const exported = await exportPromise;
  assert.deepEqual(JSON.parse(readFileSync(await exported.path(), 'utf8')), JSON.parse(contents));
  report.checks.push('Export matches the demo template import');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Your courses will appear here.', { exact: true }).waitFor();
  report.checks.push('Reload clears in-memory inventory');
  assert.equal(report.networkMutations.length, 0);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(resolve(outputDirectory, 'public-flows-final.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
