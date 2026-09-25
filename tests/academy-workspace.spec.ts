import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const manifest = { version: 1, courses: [{ id: 'demo-course', title: 'K01 DEMO course', modules: [{ id: 'demo-module', title: 'K01 DEMO module', lessons: [{ id: 'demo-lesson', title: '<img src=x onerror="window.k01Executed=true"> DEMO lesson', videoUrl: 'https://videos.example.test/lesson.mp4' }, { id: 'demo-pending', title: 'K01 DEMO pending lesson' }] }] }] };
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function record(revision: number, name = 'K01 DEMO inventory') { return { id, name, revision, createdAt: '2026-09-14T12:00:00Z', updatedAt: '2026-09-14T12:00:00Z', manifest, origin: { label: 'K01 DEMO authorized fixture', url: 'https://source.example.test/inventory' } }; }
async function manage(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Curriculum & imports', exact: true }).click();
}
async function advanced(page: Page): Promise<void> {
  const summary = page.locator('summary').filter({ hasText: 'Inventory details & advanced JSON' });
  if (!await summary.locator('..').getAttribute('open').then(value => value !== null)) await summary.click();
}
async function signIn(page: Page): Promise<void> {
  if (new URL(page.url()).pathname === '/academy') {
    await manage(page);
    if (!await page.getByLabel('Work email').isVisible()) await page.locator('summary').filter({ hasText: /^Saved inventories/ }).click();
  }
  await page.getByLabel('Work email').fill('operator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('fixture-only');
  await page.getByRole('button', { name: 'Sign in to Academy', exact: true }).click();
}
async function fixtureAuth(page: Page): Promise<void> {
  await page.route('https://academy-fixture.supabase.co/auth/v1/token**', route => route.fulfill({ json: { access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer', user: { id: '11111111-1111-4111-8111-111111111111', email: 'operator@example.test' } } }));
}
async function upload(page: Page, value: unknown = manifest): Promise<void> {
  await manage(page);
  await page.getByLabel('Course inventory JSON').setInputFiles({ name: 'K01-DEMO.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
}
async function exported(page: Page): Promise<unknown> {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export inventory', exact: true }).click();
  const stream = await (await waiting).createReadStream(); if (!stream) throw new Error('Missing download');
  const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const artifacts = process.env.K01_ARTIFACT_DIR;
test('K01 invalid import/editor preserve draft and references stay inert on desktop/mobile', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (/videos\.example|source\.example/.test(request.url())) external.push(request.url()); });
  await page.goto('/academy'); await upload(page);
  await expect(page.getByText('K01 DEMO course', { exact: true })).toBeVisible();
  await upload(page, { version: 2, courses: [] });
  await expect(page.locator('main').getByRole('alert')).toContainText('Your previous inventory is still available');
  expect(await exported(page)).toEqual(manifest);
  await advanced(page);
  await page.getByLabel('Manifest JSON').fill('{bad');
  await page.getByRole('button', { name: 'Apply JSON changes', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('not valid JSON');
  expect(await exported(page)).toEqual(manifest);
  await page.getByRole('link', { name: 'Review source preparation' }).click();
  await page.getByRole('link', { name: 'Open Academy' }).click();
  await manage(page); await advanced(page);
  await expect(page.getByLabel('Manifest JSON')).toHaveValue('{bad');
  await page.getByLabel('Manifest JSON').fill(JSON.stringify(manifest, null, 2));
  await page.getByRole('button', { name: 'Apply JSON changes', exact: true }).click();
  expect(await page.locator('main img').count()).toBe(0);
  expect(await page.evaluate(() => 'k01Executed' in window)).toBe(false);
  if (artifacts) await page.screenshot({ path: `${artifacts}/academy-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifacts) await page.screenshot({ path: `${artifacts}/academy-mobile.png`, fullPage: true });
  await page.getByRole('link', { name: 'Review source preparation' }).click();
  await expect(page.getByText('Local browser draft · not verified against current storage')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'K01-DEMO.json', exact: true })).toBeVisible();
  await expect(page.getByText('Transcript not yet available', { exact: true })).toHaveCount(2);
  expect(await page.locator('main img').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifacts) await page.screenshot({ path: `${artifacts}/ask-anas-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1080 });
  if (artifacts) await page.screenshot({ path: `${artifacts}/ask-anas-desktop.png`, fullPage: true });
  expect(external).toEqual([]);
});
test('K01 saved inventory, edit/save, conflict keeps draft and recovered open requires consent (HTTP fixtures)', async ({ page }) => {
  await fixtureAuth(page); let saved = record(1); let conflict = false; let saveCount = 0;
  await page.route('**/api/academy/inventories**', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (request.method() === 'PUT') {
      saveCount++; const body = request.postDataJSON(); expect(body.owner_id).toBeUndefined();
      expect(body.expectedRevision).toBe(saved.revision);
      if (conflict) { await route.fulfill({ status: 409, json: { code: 'revision_conflict', error: 'A newer revision exists. Your draft is preserved.' } }); return; }
      saved = { ...saved, name: body.name, manifest: body.manifest, revision: saved.revision + 1 }; await route.fulfill({ json: { inventory: saved } }); return;
    }
    if (url.pathname.endsWith(id)) await route.fulfill({ json: { inventory: saved } });
    else await route.fulfill({ json: { inventories: [saved], nextOffset: null } });
  });
  await page.goto('/academy'); await signIn(page);
  await page.getByRole('button', { name: 'Open K01 DEMO inventory' }).click();
  await expect(page.getByText('Opened saved revision 1.', { exact: true })).toBeVisible();
  await advanced(page);
  const changed = structuredClone(manifest); changed.courses[0].title = 'K01 DEMO edited course';
  await page.getByLabel('Manifest JSON').fill(JSON.stringify(changed));
  await page.getByRole('button', { name: 'Save inventory', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 2');
  conflict = true;
  await page.getByLabel('Inventory name', { exact: true }).fill('K01 DEMO unsaved conflict');
  await page.getByRole('button', { name: 'Save inventory', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Your draft is preserved');
  expect(await exported(page)).toEqual(changed); expect(saveCount).toBe(2);
  await expect(page.getByLabel('Inventory name', { exact: true })).toHaveValue('K01 DEMO unsaved conflict');
  await expect(page.getByText('Unsaved draft', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Open K01 DEMO inventory' }).click();
  await expect(page.getByLabel('Inventory name', { exact: true })).toHaveValue('K01 DEMO unsaved conflict');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Open K01 DEMO inventory' }).click();
  await expect(page.getByLabel('Inventory name', { exact: true })).toHaveValue('K01 DEMO inventory');
  await expect(page.getByText('Opened saved revision 2.', { exact: true })).toBeVisible();
});
test('K01 missing migration reports storage pending and keeps local export (HTTP fixture)', async ({ page }) => {
  await fixtureAuth(page);
  await page.route('**/api/academy/inventories**', route => route.fulfill({ status: 503, json: { code: 'storage_pending', error: 'Academy storage is pending setup. Keep your draft and export it.' } }));
  await page.goto('/academy'); await upload(page); await signIn(page);
  await expect(page.locator('main').getByRole('alert')).toContainText('storage is pending setup');
  await page.getByRole('button', { name: 'Save inventory', exact: true }).click();
  await advanced(page);
  await expect(page.getByLabel('Inventory name', { exact: true })).toHaveValue('K01-DEMO.json');
  expect(await exported(page)).toEqual(manifest);
});
test('K01 Ask Anas reads saved revisions and traces pending sources (HTTP fixtures)', async ({ page }) => {
  await fixtureAuth(page);
  await page.route('**/api/academy/inventories**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/revisions')) return route.fulfill({ json: { revisions: [{ revision: 2, name: 'K01 DEMO inventory', createdAt: record(2).createdAt }, { revision: 1, name: 'K01 DEMO inventory', createdAt: record(1).createdAt }], nextOffset: null } });
    if (url.pathname.endsWith(id)) return route.fulfill({ json: { inventory: record(Number(url.searchParams.get('revision') ?? 2)) } });
    return route.fulfill({ json: { inventories: [record(2)], nextOffset: null } });
  });
  await page.goto('/ask-anas'); await signIn(page);
  await page.getByRole('button', { name: 'Open K01 DEMO inventory' }).click();
  await expect(page.getByText('Saved inventory · revision 2', { exact: false })).toBeVisible();
  await expect(page.getByText('Metadata registered', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Transcript not yet available', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Revision 1', exact: true }).click();
  await expect(page.getByText('Saved inventory · revision 1', { exact: false })).toBeVisible();
  await expect(page.getByText('Origin: K01 DEMO authorized fixture', { exact: false })).toBeVisible();
  if (artifacts) await page.screenshot({ path: `${artifacts}/ask-anas-saved-fixture.png`, fullPage: true });
});
