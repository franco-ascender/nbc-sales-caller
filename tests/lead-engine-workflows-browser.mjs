// Synthetic account and source metadata only. No paid provider or production mutation.
import { fileURLToPath } from 'node:url';
import { WORKFLOW_NICHES } from '../src/lib/lead-engine-niches.ts';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const base = process.env.L01_REVIEW_BASE_URL;
if (!/^http:\/\/127\.0\.0\.1:(?!3000\b)\d+$/.test(base ?? '')) throw Error('Isolated loopback required');
const artifact = fileURLToPath(new URL('../artifacts/lanes/L03/industry-workflows-r4/', import.meta.url));
await mkdir(artifact, { recursive: true });
const bundle = JSON.parse(await readFile(new URL('../src/data/lead-engine-workflows.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  // Only this fixture bypasses CSP because its synthetic Auth transport is loopback; production test retains CSP.
  const context = await browser.newContext({ bypassCSP: true, reducedMotion:'reduce', viewport: { width: 1440, height: 1000 } });
  for (const [role, status] of [['anonymous',401],['invalid',403],['student',403],['coach',403],['suspended',403],['admin',200]]) {
    const response = await context.request.get(`${base}/api/lead-engine/brain`, { headers: role === 'anonymous' ? {} : { Authorization: `Bearer l01-${role}` } });
    assert.equal(response.status(), status, role);
    assert.equal(response.headers()['cache-control'], 'no-store');
    const body = await response.json();
    if (status === 200) assert.equal(Object.keys(body.workflowReviews).length, 44);
    else assert.equal('workflowReviews' in body, false);
  }
  const page = await context.newPage(); const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => console.log('request failed', new URL(request.url()).pathname, request.failure()?.errorText));
  page.on('response', response => { if(response.url().includes('/auth/')) console.log('auth response', response.status(), new URL(response.url()).pathname); });
  const user = {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'operator@example.test'};
  await page.route('**/auth/v1/token**', route => route.fulfill({ json: { access_token:'l01-admin',token_type:'bearer',expires_in:3600,refresh_token:'synthetic',user:{...user,email_confirmed_at:'2026-09-14T00:00:00Z',app_metadata:{},user_metadata:{},aud:'authenticated',created_at:'2026-09-14T00:00:00Z'} } }));
  await page.route('**/api/workspace/session', route => route.fulfill({ json: {user:{...user,name:'Review fixture',role:'admin'}} }));
  await page.route('**/api/lead-engine/jobs', route => route.fulfill({ json:{jobs:[]} }));
  await page.route('**/api/lead-engine/credits', route => route.fulfill({ json:{available:0,held:0} }));
  await page.route('**/api/members/summary', route => route.fulfill({ status:503,json:{error:'Outside fixture'} }));
  await page.goto(`${base}/lead-engine`);
  await page.getByLabel('Email address',{exact:true}).fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('synthetic-password');
  await page.getByRole('button',{name:'Enter NBC Sales'}).click();
  await page.getByRole('tab',{name:'Brain (admin)'}).click().catch(async error => { console.log(await page.locator('body').innerText()); console.log(errors); throw error; });
  await page.getByRole('heading',{name:'Choose a niche'}).waitFor();
  assert.equal(await page.getByRole('button',{name:/^Open /}).count(),35);
  assert.equal(await page.getByRole('button',{name:/Open (Minnesota|Florida)/}).count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), 'Desktop fits viewport');
  await page.getByRole('region',{name:'Industry workflows'}).screenshot({style:'header[class*="topbar"] { visibility: hidden !important; }',path:`${artifact}/niche-list-desktop.png`});
  for (const niche of WORKFLOW_NICHES) {
    await page.getByLabel('Search niches').fill(niche.title);
    await page.getByRole('button',{name:`Open ${niche.title}`,exact:true}).click();
    await page.getByRole('region',{name:'Selected approach'}).waitFor();
    await page.getByRole('region',{name:`${niche.title} tool diagram`}).waitFor();
    assert.ok(await page.getByRole('region',{name:`${niche.title} tool diagram`}).getByRole('article').count()>=4);
    assert.equal(await page.getByRole('group',{name:'State routes',exact:true}).getByRole('button').count(),51,`${niche.title}: all states visible`);
    if(niche.id==='attorney') {
      await page.getByRole('button',{name:'Inspect Alaska',exact:true}).click();
      await page.getByRole('button',{name:'Inspect Alaska',exact:true}).getByText('Blocked · see missing requirements',{exact:true}).waitFor();
    }
    await page.getByRole('region',{name:`${niche.title} tool diagram`}).getByText('YES · phone available',{exact:true}).waitFor();
    await page.getByRole('region',{name:`${niche.title} tool diagram`}).getByText('NO · phone missing',{exact:true}).waitFor();
    assert.equal(await page.locator('svg[role="group"]').count(),0,'No sideways SVG diagram');
    if(niche.id==='contractors') {
      const states=page.getByRole('group',{name:'State routes',exact:true});
      assert.equal(await states.getByRole('button').count(),51);
      for(const [search,code,name] of [['Alaska','AK','Alaska'],['WY','WY','Wyoming']]) {
        await page.getByLabel('Search states',{exact:true}).fill(search);
        assert.equal(await states.getByRole('button').count(),1);
        const choice=page.getByRole('button',{name:`Inspect ${name}`,exact:true});
        await choice.click();
        assert.equal(await page.getByLabel('Workflow state').inputValue(),code);
        assert.equal(await choice.getAttribute('aria-pressed'),'true');
        await page.getByRole('region',{name:'Contractors tool diagram'}).waitFor();
      }
      await page.getByLabel('Search states',{exact:true}).fill('Atlantis');
      await page.getByText('No states match. Clear the search to see the whole country.',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Show all',exact:true}).click();
      assert.equal(await states.getByRole('button').count(),51);
      await page.getByRole('complementary',{name:'All US states'}).screenshot({style:'header[class*="topbar"] { visibility: hidden !important; }',path:`${artifact}/national-states-desktop.png`});
      await page.setViewportSize({width:390,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'State list fits mobile');
      await page.getByRole('complementary',{name:'All US states'}).screenshot({style:'header[class*="topbar"] { visibility: hidden !important; }',path:`${artifact}/national-states-mobile.png`});
      await page.setViewportSize({width:1440,height:1000});

      for(const [code,name]of [['FL','Florida construction license records'],['MN','Minnesota contractor license records'],['WA','Washington contractor register']]) {
        await page.getByLabel('Workflow state').selectOption(code);
        await page.getByRole('region',{name:'Selected approach'}).getByText(name,{exact:true}).waitFor();
      }
      await page.getByLabel('Workflow state').selectOption('TX');
      await page.getByText('Austin permit records only. This is not statewide Texas coverage.',{exact:false}).waitFor();
      await page.getByRole('region',{name:'Selected approach'}).getByText(/register path is unavailable/i).waitFor();
      await page.getByLabel('Workflow state').selectOption('MN');
      await page.getByRole('option',{name:'Minnesota',exact:true}).waitFor({state:'attached'});
      console.log('desktop bounds',await page.getByRole('region',{name:'Industry workflows'}).boundingBox(),await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth,x:scrollX})));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), 'Contractors desktop fits viewport');
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({style:'header[class*="topbar"] { visibility: hidden !important; }',path:`${artifact}/contractors-viewport.png`});
      await page.getByRole('region',{name:'Industry workflows'}).screenshot({style:'header[class*="topbar"] { visibility: hidden !important; }',path:`${artifact}/contractors-desktop.png`});
    }
    if(niche.id==='realtor') {
      await page.getByLabel('Workflow state').selectOption('IL');
      const diagram=page.getByRole('region',{name:'Real estate agents tool diagram'});
      await diagram.getByText('Illinois IDFPR license records',{exact:true}).first().waitFor();
      await diagram.getByText(/Licensee name, license status and location. No phone field/).waitFor();
      await diagram.getByText(/Cook County Assessor parcel addresses \+ BatchData lookup/).waitFor();
      await diagram.screenshot({style:'header[class*="topbar"] { visibility: hidden !important; }',path:`${artifact}/illinois-diagram-desktop.png`});
      await page.setViewportSize({width:390,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Illinois diagram fits mobile');
      await diagram.screenshot({style:'header[class*="topbar"] { visibility: hidden !important; }',path:`${artifact}/illinois-diagram-mobile.png`});
      await page.setViewportSize({width:1440,height:1000});
    }
    const audit=page.locator('summary').filter({hasText:'Evidence & technical details'});
    await audit.focus(); await page.keyboard.press('Enter');
    assert.equal(await audit.locator('..').getAttribute('open'),'');
    await page.getByText('Inspected job identifier',{exact:true}).waitFor();
    await page.getByRole('button',{name:'All niches',exact:true}).click();
  }
  await page.getByLabel('Search niches').fill('Car detailing');
  await page.getByRole('button',{name:'Open Car detailing',exact:true}).click();
  await page.getByLabel('Workflow state').selectOption('FL');
  await page.getByRole('region',{name:'Industry workflows'}).screenshot({style:'header[class*="topbar"] { visibility: hidden !important; }',path:`${artifact}/detailing-desktop.png`});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No page-wide horizontal overflow');
  await page.getByRole('region',{name:'Car detailing tool diagram'}).screenshot({style:'header[class*="topbar"] { visibility: hidden !important; }',path:`${artifact}/detailing-diagram-mobile.png`});
  await page.getByRole('region',{name:'Selected approach'}).screenshot({style:'header[class*="topbar"] { visibility: hidden !important; }',path:`${artifact}/approach-mobile.png`});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,niches:35,preservedReviews:Object.keys(bundle).length,authRoles:6,jurisdictionsPerNiche:51,nationalStatePairs:1785,stateSearch:true,keyboard:true,mobileWidth:390,paidCalls:0}));
} finally { await browser.close(); }
