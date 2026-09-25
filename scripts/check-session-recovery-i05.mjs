import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const origin=process.argv[2]||'http://127.0.0.1:3025',out=process.argv[3]||'artifacts/lanes/S01';
const key='nbc-workspace-session-v1',ttl=43200000;
const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[];
const fixtureUser={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'session-demo@example.com',email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',app_metadata:{},user_metadata:{}};
try {
 const ctx=await browser.newContext();let authRequests=0,status=200,delay=false,release;
 await ctx.route('**/auth/v1/**',async r=>{if(r.request().url().includes('/token')){authRequests++;await r.fulfill({json:{access_token:'session-test-access',refresh_token:'session-test-refresh',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user:fixtureUser}});}else if(r.request().url().includes('/logout'))await r.fulfill({status:204});else await r.fulfill({json:fixtureUser});});
 await ctx.route('**/api/workspace/session',async r=>{if(delay)await new Promise(resolve=>{release=resolve});await r.fulfill({status,json:status===200?{user:{id:fixtureUser.id,name:'SESSION DEMO',role:'admin'}}:{error:'Test verification failure'}});});
 const p=await ctx.newPage();await p.clock.install();const errors=[];p.on('pageerror',e=>errors.push(e.name));
 const enter=async page=>{await page.getByLabel('Email address',{exact:true}).fill('session-demo@example.com');await page.getByLabel('Password',{exact:true}).fill('Fixture-only-password');await page.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();};
 const open=async page=>{try{await page.getByRole('navigation',{name:'Platform navigation',exact:true}).waitFor({timeout:10000});}catch(e){console.log({screen:await page.locator('body').innerText(),saved:await page.evaluate(()=>{const r=localStorage.getItem('nbc-workspace-session-v1');return r?{present:true,deadline:JSON.parse(r).expiresAt,now:Date.now(),hasValue:!!JSON.parse(r).value}:null})});throw e;}};
 const login=page=>page.getByRole('button',{name:'Enter NBC Sales',exact:true}).waitFor();
 const expires=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).expiresAt,key);
 await p.goto(origin+'/academy');await login(p);await enter(p);await open(p);const deadline=await expires(p);assert(Math.abs(deadline-Date.now()-ttl)<15000);assert.equal(authRequests,1);
 const second=await ctx.newPage();await second.goto(origin+'/academy');await open(second);assert.equal(await expires(second),deadline);await p.reload();await open(p);assert.equal(authRequests,1);checks.push('login once; new tab and reload restore without new password request or extended deadline');
 await second.getByRole('button',{name:'Sign out',exact:true}).click();await login(second);await login(p);await second.reload();await login(second);assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),null);checks.push('logout propagates to other tab and prevents reload restoration');
 await enter(p);await open(p);await second.reload();await open(second);
 await p.clock.fastForward(ttl+2000);await login(p);await login(second);await p.clock.resume();checks.push('12-hour expiry with controlled clock closes both tabs');
 // New context avoids the deliberately advanced clock from the expiry test.
 await ctx.close();
 const ctx2=await browser.newContext();await ctx2.route('**/auth/v1/**',r=>r.fulfill(r.request().url().includes('/logout')?{status:204}:{json:r.request().url().includes('/token')?{access_token:'session-test-access',refresh_token:'session-test-refresh',token_type:'bearer',expires_in:86400,user:fixtureUser}:fixtureUser}));
 let verifyStatus=200,hold=false,finish;
 await ctx2.route('**/api/workspace/session',async r=>{if(hold)await new Promise(resolve=>{finish=resolve});await r.fulfill({status:verifyStatus,json:verifyStatus===200?{user:{id:fixtureUser.id,name:'SESSION DEMO',role:'admin'}}:{error:'Test verification failure'}});});
 const q=await ctx2.newPage();await q.goto(origin+'/academy');await enter(q);await open(q);verifyStatus=503;await q.reload();await q.getByRole('button',{name:'Try again',exact:true}).waitFor();assert.equal(await q.getByRole('navigation',{name:'Platform navigation',exact:true}).count(),0);verifyStatus=200;await q.getByRole('button',{name:'Try again',exact:true}).click();await open(q);checks.push('transient backend failure keeps saved session private and allows retry');
 verifyStatus=403;await q.reload();await login(q);assert.equal(await q.evaluate(k=>localStorage.getItem(k),key),null);checks.push('server permission denial removes remembered session');
 verifyStatus=200;await enter(q);await open(q);const other=await ctx2.newPage();hold=true;await other.goto(origin+'/academy');await other.getByRole('status').waitFor();await q.getByRole('button',{name:'Sign out',exact:true}).click();await login(q);hold=false;finish?.();await login(other);await other.waitForTimeout(300);assert.equal(await other.getByRole('navigation',{name:'Platform navigation',exact:true}).count(),0);checks.push('logout during pending verification cannot reopen access');
 await ctx2.close();assert.deepEqual(errors,[]);writeFileSync(out+'/browser-checks.json',JSON.stringify({at:new Date().toISOString(),origin,checks,passed:true,auth:'fixtures',expiry:'clock advanced, not 12h wall time',errors},null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{await browser.close();}
