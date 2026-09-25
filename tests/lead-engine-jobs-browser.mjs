// Browser check of the Owner cells tab against an isolated local build with mocked session and API.
// L01_REVIEW_BASE_URL=http://127.0.0.1:3111 node tests/lead-engine-jobs-browser.mjs
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.L01_REVIEW_BASE_URL;
if (!base || !/^http:\/\/127\.0\.0\.1:(?!3000\b)\d+$/.test(base)) throw Error('Set an isolated loopback URL, never shared port 3000.');
const artifact = process.env.L01_REVIEW_ARTIFACT_DIR || fileURLToPath(new URL('../artifacts/lanes/L03/jobs-ui/', import.meta.url));
await mkdir(artifact, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));

  // Anonymous requests to the new routes must be refused before any storage access.
  for (const [path, method] of [['/jobs', 'GET'], ['/jobs', 'POST'], ['/jobs/quote', 'POST'], ['/credits', 'GET'], ['/credits', 'POST'], ['/coverage', 'GET'], ['/outcomes', 'POST'], ['/outcomes/import', 'POST'],
    ['/jobs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'GET'], ['/jobs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/start', 'POST'], ['/jobs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/advance', 'POST'], ['/jobs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/resume', 'POST'], ['/jobs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/download', 'GET']]) {
    const response = await context.request.fetch(`${base}/api/lead-engine${path}`, { method });
    assert.equal(response.status(), 401, `${method} ${path} requires a signed-in operator`);
    assert.equal(response.headers()['cache-control'], 'no-store');
  }
  console.log('PASS: 13 job/credit/outcome/coverage routes reject anonymous requests.');

  const user = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'operator@example.test' };
  await page.route('**/auth/v1/token**', route => route.fulfill({ json: { access_token: 'l03-admin', token_type: 'bearer', expires_in: 3600, refresh_token: 'synthetic', user: { ...user, email_confirmed_at: '2026-09-14T00:00:00Z', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-09-14T00:00:00Z' } } }));
  await page.route('**/api/workspace/session', route => route.fulfill({ json: { user: { ...user, name: 'Review fixture', role: 'admin' } } }));
  await page.route('**/api/members/summary', route => route.fulfill({ status: 503, json: { error: 'Not part of fixture' } }));
  await page.route('**/api/lead-engine/credits', route => route.fulfill({ json: { available: 120, held: 20 } }));
  await page.route('**/api/lead-engine/coverage', async route => {
    // Real brain, served through the fixture: exercise the grid with the production config.
    const { coverage, brain } = await import('../src/lib/lead-engine-brain.ts');
    const source = brain();
    await route.fulfill({ json: { version: source.version, industries: source.industries.map(item => ({ key: item.key, recipe: item.recipe, aliases: item.aliases, expectedClean: item.expectedClean, measuredBy: item.measuredBy, n: item.n })), states: Object.values(source.states), cells: coverage() } });
  });
  const job = { id: 'cccccccc-cccc-4ccc-8ccc-000000000001', operator_id: user.id, industry: 'hvac', industry_key: 'hvac', state: 'FL', target_cells: 20, dnc_mode: 'strict', recipe: 'A', recipe_version: 'A', brain_version: '2026-09-21.1',
    legal_status: 'ok', legal_note: null, expected_clean: '0.2000', credits_per_cell: 2, credit_cents: 10, cap_ratio: '0.600', credits_quoted: 40, credits_held: 40, credits_settled: 0, cap_cents: 240, spent_cents: 61,
    status: 'needs_attention', resume_from: 'running', attention_reason: 'BatchData balance exhausted. Top up the vendor account, then resume.', sample: {}, progress: { cities: ['Miami, FL', 'Orlando, FL', 'Tampa, FL'], cityIndex: 1, run: null, scraped: 88, filtered: 37, verified: 60, dropped: 44, held: 1, delivered: 15, flagged: 0, cached: 3, lastMessage: 'Finished Miami, FL: 125 places.' },
    delivered_count: 0, plan_id: null, batch_id: null, created_at: '2026-09-21T14:00:00Z', updated_at: '2026-09-21T14:20:00Z', quoted_at: '2026-09-21T14:00:00Z', delivered_at: null };
  await page.route('**/api/lead-engine/jobs', route => route.fulfill({ json: { jobs: [job] } }));
  await page.route(`**/api/lead-engine/jobs/${job.id}`, route => route.fulfill({ json: { job, progress: job.progress, quote: null, spend: [{ vendor: 'apify', step: 'scrape', units: 125, cents: 50 }, { vendor: 'batchdata', step: 'verify', units: 57, cents: 11 }], ledger: [],
    rows: [{ id: 'r1', phone10: '3055551234', name: 'Acme Air Conditioning', city: 'Miami', state: 'FL', timeZone: 'America/New_York', stage: 'delivered', dropReason: null, ledgerId: 'dddddddd-dddd-4ddd-8ddd-000000000001' },
      { id: 'r2', phone10: '7865551234', name: 'Bay Cooling & Heat', city: 'Miami', state: 'FL', timeZone: 'America/New_York', stage: 'delivered', dropReason: null, ledgerId: 'dddddddd-dddd-4ddd-8ddd-000000000002' }] } }));
  await page.route('**/api/lead-engine/jobs/quote', route => route.fulfill({ json: { balance: { available: 120, held: 20 }, quote: { route: { industry: 'hvac', state: 'FL', recipe: 'A', fallbackRecipe: null, sources: ['Google Maps: hvac contractor'], expectedClean: 0.2, expectedAny: 0.35, n: 500, measuredBy: 'anas', creditsPerCleanCell: 2, legalStatus: 'ok', legalNote: null, reason: 'hvac: recipe A' },
    recipe: 'A', legalStatus: 'ok', legalNote: null, credits: 40, capCents: 240, creditCents: 10, expectedClean: 0.2, expectedBusinesses: 100, estimatedVendorCents: 89, cities: ['Miami, FL', 'Orlando, FL', 'Tampa, FL', 'Jacksonville, FL', 'Fort Lauderdale, FL'], sampleCities: 1, blockers: [] } } }));

  await page.goto(`${base}/lead-engine`);
  await page.getByLabel('Email address', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Enter NBC Sales' }).click();
  await page.getByRole('heading', { name: /Lead Engine/ }).waitFor();
  await page.getByRole('tab', { name: 'Owner cells' }).waitFor();
  await page.getByRole('heading', { name: 'Owner cells by the job' }).waitFor();
  await page.getByText('120', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Get quote' }).click();
  await page.getByText('Hold 40 credits and start').waitFor();
  await page.getByText('$2.40', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Show grid' }).click();
  await page.locator('table td', { hasText: 'contractor_registry' }).first().waitFor();
  await page.screenshot({ path: `${artifact}/owner-cells-quote.png`, fullPage: true });
  console.log('PASS: quote renders credits, cap, expected clean rate and the coverage grid.');

  await page.getByRole('button', { name: 'Open' }).first().click();
  await page.getByText('Parked:').waitFor();
  await page.getByText('BatchData balance exhausted').waitFor();
  await page.getByRole('button', { name: /Resume with 20 more credits/ }).waitFor();
  await page.getByText('(305) 555-1234').waitFor();
  await page.getByLabel('Outcome for Acme Air Conditioning').waitFor();
  await page.getByRole('button', { name: /Download dial sheet/ }).waitFor();
  await page.getByRole('button', { name: /Upload sheet with outcomes/ }).waitFor();
  await page.screenshot({ path: `${artifact}/owner-cells-job.png`, fullPage: true });
  console.log('PASS: a parked job shows the reason, resume with credits, delivered rows with outcome capture, download and upload.');
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`Screenshots in ${artifact}`);
} finally { await browser.close(); }
