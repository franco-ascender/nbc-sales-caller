// Browser fixture test against an isolated build with synthetic Supabase public configuration.
// L01_REVIEW_BASE_URL=http://127.0.0.1:3107 node tests/lead-engine-browser.mjs
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = process.env.L01_REVIEW_BASE_URL;
if (!base || !/^http:\/\/127\.0\.0\.1:(?!3000\b)\d+$/.test(base)) throw Error('Set an isolated loopback URL, never shared port 3000.');
const artifact = process.env.L01_REVIEW_ARTIFACT_DIR || fileURLToPath(new URL('../artifacts/lanes/L01/r8/local/', import.meta.url));
await mkdir(artifact, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const planId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  for (const [path, method] of [['/folders','GET'],['/folders','POST'],['/quotes','POST'],[`/quotes/${planId}/approve`,'POST'],['/lists','GET'],[`/lists/${planId}`,'GET'],[`/lists/${planId}/sync`,'POST'],[`/lists/${planId}/move`,'POST'],['/connections/check','POST'],['/plans','GET'],['/plans','POST'],[`/plans/${planId}`,'GET'],[`/plans/${planId}/dry-run`,'POST']]) {
    const response = await context.request.fetch(`${base}/api/lead-engine${path}`, { method });
    assert.equal(response.status(), 401, `${method} ${path} uses real requireOperator`);
    assert.equal(response.headers()['cache-control'], 'no-store');
  }
  console.log('PASS: thirteen real isolated API actions reject anonymous requests before DB access.');
  await page.route('**/auth/v1/token**', route => route.fulfill({ json: {
    access_token: 'l01-admin', token_type: 'bearer', expires_in: 3600, refresh_token: 'synthetic-refresh',
    user: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'operator@example.test', email_confirmed_at: '2026-09-14T00:00:00Z', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-09-14T00:00:00Z' },
  } }));
  await page.route('**/api/workspace/session',route=>route.fulfill({json:{user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Review fixture',email:'operator@example.test',role:'admin'}}}));
  await page.route('**/api/members/summary',route=>route.fulfill({status:503,json:{error:'Not part of L01 fixture'}}));
  await page.goto(`${base}/lead-engine`);
  await page.getByLabel('Email address',{exact:true}).fill('operator@example.test');
  await page.getByLabel('Password',{exact:true}).fill('synthetic-password');
  await page.getByRole('button',{name:'Enter NBC Sales'}).click();
  await page.getByRole('heading', { name: /Lead Engine/ }).waitFor();
  await page.waitForFunction(() => { const panel = document.getElementById('panel-search'); return panel && getComputedStyle(panel).opacity === '1'; });
  const research=page.getByRole('button',{name:/02 Research A person/});await research.click();
  await page.getByText('Owner research not connected',{exact:true}).waitFor();
  await research.focus();await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  await page.getByText('Phone verification not connected',{exact:true}).waitFor();
  await page.getByRole('button',{name:/01 Discover Businesses/}).click();
  await page.getByRole('button',{name:'Set up your search'}).click();
  assert.equal(await page.locator('#lead-industry').evaluate(el=>document.activeElement===el),true);
  assert.equal(await page.getByLabel('Industry',{exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),true);
  console.log('PASS: research steps respond to pointer/keyboard, setup link focuses the field, inputs use 16px text.');
  assert.equal(await page.getByText('Setup in progress', { exact: true }).count(), 1);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download plan', exact: true }).click();
  const download = await downloadPromise; const stream = await download.createReadStream(); let contents = ''; for await (const part of stream) contents += part;
  const draft = JSON.parse(contents); assert.equal(draft.executionEnabled, false); assert.equal(draft.containsContactData, false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ animations: 'disabled',  path: `${artifact}/desktop-planning.png`, fullPage: true });
  console.log('PASS: planning, setup status and local JSON export behind fixture workspace login.');
  await page.getByRole('tab', { name: 'Build a search' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('heading', { name: 'Your research will land here.' }).waitFor();
  await page.getByRole('button', { name: 'Preview the evidence format' }).click();
  await page.getByLabel('Illustrative evidence example').waitFor();
  await page.getByLabel('Lead confidence: 75 out of 100').click();
  await page.getByText('100 is the highest evidence score, not 100% certainty.', {exact:true}).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ animations: 'disabled',  path: `${artifact}/desktop-evidence.png`, fullPage: true });
  assert.equal(await page.getByRole('tab', { name: 'Connections', exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Operator email', { exact: true }).count(), 0);
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Check provider access', exact: true }).count(), 0);
  await page.getByRole('tab', { name: 'Build a search' }).click();
  console.log('PASS: one workspace session; no module credentials or provider configuration; keyboard evidence tabs preserved.');
  // Everything after this point uses synthetic auth/storage fixtures, not shared Supabase.
  await page.evaluate(() => { const label = document.createElement('p'); label.textContent = 'REVIEW FIXTURE — Synthetic storage and operator. No live data.'; document.getElementById('saved-plans-title').after(label); });
  let pending = true; let saved = null; const saveIds = []; let saveFailure = true;
  const folders=[]; let leadList=null; let pricingPending=true; let expiredQuote=false; let quote=null; let approvals=0; let approvalFailure=true; let synced=false;
  await page.route('**/api/lead-engine/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.endsWith('/folders')) {
      if(request.method()==='POST'){const body=request.postDataJSON();if(!folders.some(f=>f.id===body.id))folders.push(body);return route.fulfill({json:{folder:body}});}
      return route.fulfill({json:{folders}});
    }
    if (url.pathname.endsWith('/quotes')) {
      if(pricingPending){pricingPending=false;return route.fulfill({status:503,json:{code:'pricing_pending',error:'Verified scrape pricing is pending setup. No quote or charge was created.'}});}
      const body=request.postDataJSON();quote={id:body.quoteId,planId:body.planId,folderId:body.folderId,name:body.name,maxResults:body.count,minCostCents:25,maxCostCents:100,
        expiresAt:new Date(Date.now()+(expiredQuote?-60000:900000)).toISOString(),blockers:[],scope:'discovery_only'};
      return route.fulfill({json:{quote}});
    }
    if (url.pathname.endsWith('/approve')) {
      approvals++;
      if(approvalFailure){approvalFailure=false;return route.fulfill({status:409,json:{code:'hard_budget_exceeded',error:'Existing reservations leave insufficient plan budget.'}});}
      leadList??={id:quote.id,name:quote.name,folderId:quote.folderId,planId:saved.id,status:'running',importStatus:'waiting',processed:0,maxResults:quote.maxResults,reservedCents:100,consumedCents:0,createdAt:new Date().toISOString()};
      return route.fulfill({json:{list:leadList,records:[],nextOffset:null}});
    }
    const records=()=>synced?[{position:0,name:'Synthetic Roofing — review fixture',city:'Charlotte',state:'NC',website:'https://example.com',sourceUrl:'https://www.google.com/maps?cid=123',reviewStatus:'verification_pending'}]:[];
    if (url.pathname.endsWith('/lists')) return route.fulfill({json:{lists:leadList&&(url.searchParams.get('folder')===null||(url.searchParams.get('folder')==='unfiled'?leadList.folderId===null:leadList.folderId===url.searchParams.get('folder')))?[leadList]:[],nextOffset:null}});
    if (url.pathname.includes('/lists/')) {
      if(url.pathname.endsWith('/move')){leadList.folderId=request.postDataJSON().folderId;return route.fulfill({json:{moved:true}});}
      if(url.pathname.endsWith('/sync')){synced=true;leadList.status='succeeded';leadList.importStatus='complete';leadList.processed=1;}
      return route.fulfill({json:{list:leadList,records:records(),nextOffset:null}});
    }
    if (url.pathname.endsWith('/connections/check')) return route.fulfill({ json: { checkedAt: '2026-09-14T12:00:00Z', apify: 'missing', phoneVerifier: 'missing', executionEnabled: false } });
    if (url.pathname.endsWith('/dry-run')) {
      return route.fulfill({ json: { dryRun: { version: 1, batchId: request.postDataJSON().batchId, planId: saved.id, status: 'dry_run', executionEnabled: false,
        maxBusinesses: 300, maxCostCents: 1000, reservedCents: 0, consumedCents: 0, claimsCreated: 0,
        blockers: ['execution_not_connected','balance_check_required','verified_source_and_quote_required'], checkedAt: '2026-09-14T12:00:00Z' } } });
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON(); saveIds.push(body.planId);
      if (saveFailure) { saveFailure = false; return route.fulfill({ status: 503, json: { code: 'storage_pending', error: 'Plan storage is pending integration. Your draft is still available to export.' } }); }
      // PostgreSQL JSONB does not preserve the browser's input key order.
      const persistedInput = Object.fromEntries(Object.entries(body.input).reverse());
      saved = { id: body.planId, input: persistedInput, status: 'draft', createdAt: '2026-09-14T12:00:00Z', plan: draft };
      pending = false; return route.fulfill({ json: { plan: saved } });
    }
    if (pending) return route.fulfill({ status: 503, json: { code: 'storage_pending', error: 'Plan storage is pending integration. Your draft is still available to export.' } });
    if (url.pathname.endsWith('/plans')) return route.fulfill({ json: { plans: saved ? [saved] : [], nextOffset: null } });
    return route.fulfill({ json: { plan: saved } });
  });
  await page.getByRole('button', { name: 'Refresh saved plans', exact: true }).click();
  await page.getByText("Saving isn't available yet", { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Industry', { exact: true }).inputValue(), 'Roofing');
  assert.equal(await page.getByRole('button', { name: 'Prepare dry-run', exact: true }).isDisabled(), true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ animations: 'disabled',  path: `${artifact}/desktop-storage-pending-fixture.png`, fullPage: true });
  pending = false;
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await page.getByRole('button', { name: 'Save draft snapshot', exact: true }).click();
  await page.getByText("Saving isn't available yet", { exact: true }).waitFor();
  pending = false;
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await page.getByRole('button', { name: 'Save draft snapshot', exact: true }).click();
  await page.getByText('Plan saved. This snapshot is stored in your account.', { exact: true }).waitFor();
  assert.equal(saveIds.length, 2); assert.equal(saveIds[0], saveIds[1]);
  await page.getByLabel('Industry', { exact: true }).fill('Plumbing');
  assert.equal(await page.getByRole('button', { name: 'Prepare dry-run', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Open Roofing plan in Charlotte, NC' }).click();
  await page.waitForFunction(() => document.querySelector('input[maxlength="150"]')?.value === 'Roofing');
  await page.getByRole('button', { name: 'Prepare dry-run', exact: true }).click();
  await page.getByRole('heading', { name: 'Dry-run · execution disabled', exact: true }).waitFor();
  assert.equal(await page.getByText('Setup in progress', { exact: true }).count(), 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ animations: 'disabled',  path: `${artifact}/desktop-saved-dry-run-fixture.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
  assert.equal(await page.getByLabel('Hard budget (USD)').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'budget with decimals remains fully visible');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ animations: 'disabled',  path: `${artifact}/mobile-saved-dry-run-fixture.png`, fullPage: true });
  await page.setViewportSize({width:1440,height:1080});
  await page.getByRole('tab',{name:'Lead lists',exact:true}).click();
  await page.getByRole('button',{name:'Refresh lists',exact:true}).click();
  await page.getByRole('heading',{name:'No lists in this folder yet'}).waitFor();
  await page.getByLabel('New folder',{exact:true}).fill('Charlotte pilot');
  await page.getByRole('button',{name:'Create folder',exact:true}).click();
  await page.getByRole('button',{name:'Charlotte pilot',exact:true}).waitFor();
  assert.equal(folders.length,1);
  await page.getByRole('tab',{name:'Build a search'}).click();
  await page.getByRole('button',{name:'Review scrape cost',exact:true}).click();
  await page.getByText('Pricing pending setup',{exact:true}).waitFor();
  assert.equal(approvals,0);
  await page.getByRole('button',{name:'Review scrape cost',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Approve this scrape?'});await modal.waitFor();
  assert.equal(approvals,0);await modal.evaluate(node=>{const label=document.createElement('p');label.textContent='REVIEW FIXTURE — Synthetic price. No live account or charge.';node.prepend(label);});await page.screenshot({ animations: 'disabled', path:`${artifact}/desktop-cost-review-fixture.png`,fullPage:false});
  await page.setViewportSize({width:390,height:844});await page.screenshot({ animations: 'disabled', path:`${artifact}/mobile-cost-review-fixture.png`,fullPage:false});
  await page.setViewportSize({width:1440,height:1080});await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});assert.equal(approvals,0);
  expiredQuote=true;
  await page.getByRole('button',{name:'Review scrape cost',exact:true}).click();await modal.waitFor();
  assert.equal(await modal.getByRole('button',{name:/Approve & start/}).isDisabled(),true);
  await modal.getByRole('button',{name:'Cancel',exact:true}).click();expiredQuote=false;
  await page.getByRole('button',{name:'Review scrape cost',exact:true}).click();await modal.waitFor();
  await modal.getByRole('button',{name:/Approve & start/}).click();
  await modal.getByText('Existing reservations leave insufficient plan budget.').waitFor();assert.equal(leadList,null);
  await modal.getByRole('button',{name:/Approve & start/}).click();await modal.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Refresh results',exact:true}).click();
  await page.getByRole('cell',{name:'Synthetic Roofing — review fixture',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Lead confidence: Not checked').count(), 1);
  assert.equal(approvals,2);assert.equal(leadList.folderId,folders[0].id);
  await page.getByRole('tab',{name:'Lead lists',exact:true}).click();
  await page.getByRole('button',{name:'Refresh lists',exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({ animations: 'disabled', path:`${artifact}/desktop-folders-results-fixture.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({ animations: 'disabled', path:`${artifact}/mobile-folders-results-fixture.png`,fullPage:true});
  await page.getByLabel('Move list to folder').selectOption('');
  await page.getByText('List moved. Global duplicate and suppression checks are unchanged.').waitFor();assert.equal(leadList.folderId,null);
  await page.getByRole('button',{name:'Unfiled',exact:true}).click();
  await page.getByRole('button',{name:/Roofing.*records processed/}).waitFor();
  console.log('PASS (fixtures): folders persist, cost review never starts, cancel spends nothing, expired quote disabled, changed budget rejects approval, approved run imports business records, list moves to Unfiled with verification pending.');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#lead-industry').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByRole('tab',{name:'Build a search'}).click();
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({ animations: 'disabled', path:`${artifact}/mobile-planning.png`,fullPage:true});
  const lightCanvas = await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
  await page.getByRole('button',{name:'Use dark appearance',exact:true}).click();
  assert.notEqual(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),lightCanvas);
  await page.screenshot({animations:'disabled',path:`${artifact}/mobile-dark.png`,fullPage:true});
  await page.setViewportSize({width:1440,height:1080});
  await page.screenshot({animations:'disabled',path:`${artifact}/desktop-dark.png`,fullPage:true});
  await page.getByRole('button',{name:'Use light appearance',exact:true}).click();
  console.log('PASS: light/dark appearance integration, mobile and desktop captures, reduced-motion override.');
  assert.deepEqual(errors, []);
  console.log('PASS (fixtures): storage pending preserves draft; retry preserves UUID; saved plan opens; edits disable dry-run; diagnostic reserves $0; workspace session shared; provider controls absent; mobile 390px without overflow; no browser exceptions.');
} finally { await browser.close(); }
