// Real login verification. No fixtures, credentials in logs, or paid operations.
import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
loadEnvFile('.env.local');
const origin=process.argv[2],label=process.argv[3]||'local';
if(!origin||!['local','vercel'].includes(label))throw Error('Supply origin and local|vercel');
const out='artifacts/lanes/I02/login';const stage=JSON.parse(readFileSync(out+'/staging.json')).path;
const require=createRequire(stage+'/package.json');const {chromium}=require('playwright');
const dir=readFileSync('artifacts/lanes/I02/private-access-location.txt','utf8').trim();
const accounts=JSON.parse(readFileSync(dir+'/auth-accounts.json')).accounts;
const checks=[];const errors=[];const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(15000);
 for(const path of ['/','/members','/caller','/academy','/lead-engine','/ask-anas','/integrations','/demo']){
  await page.goto(origin+path);await page.getByRole('button',{name:'Enter NBC Sales',exact:true}).waitFor();
  assert.equal(await page.getByRole('navigation',{name:'Platform navigation'}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Sign out',exact:true}).count(),0);
  checks.push({path,anonymous:'login only'});
 }
 await context.close();
 for(const [i,viewport] of [{width:1440,height:1000},{width:390,height:844}].entries()){
  const ctx=await browser.newContext({viewport});const p=await ctx.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.name));
  await p.goto(origin);await p.getByRole('button',{name:'Enter NBC Sales',exact:true}).waitFor();
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:out+`/${label}-login-${i?'mobile':'desktop'}.png`,fullPage:true,animations:'disabled'});
  await p.getByLabel('Email address',{exact:true}).fill(accounts[i].email);
  if(i===0){await p.getByLabel('Password',{exact:true}).fill('Invalid-verification-password');await p.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();await p.getByRole('alert').waitFor();assert.equal(await p.getByRole('navigation',{name:'Platform navigation'}).count(),0);checks.push({incorrectPassword:'stays on login'});}
  await p.getByLabel('Password',{exact:true}).fill(accounts[i].initialPassword);await p.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();
  await p.getByRole('button',{name:'Sign out',exact:true}).waitFor();
  if(i===1)await p.getByRole('button',{name:'Open platform navigation'}).click();
  await p.getByRole('navigation',{name:'Platform navigation'}).getByRole('link',{name:'Members',exact:true}).click();
  await p.getByLabel('Workspace to review').waitFor();
  assert.equal(await p.getByRole('button',{name:'Enter NBC Sales',exact:true}).count(),0);
  checks.push({account:accounts[i].display_name,rootLogin:true,membersWithoutSecondLogin:true,device:i?'mobile':'desktop'});
  const second=await ctx.newPage();await second.goto(origin);await second.getByRole('button',{name:'Enter NBC Sales',exact:true}).waitFor();checks.push({newTab:'requires login'});await second.close();
  await p.getByRole('button',{name:'Sign out',exact:true}).first().click();await p.getByRole('button',{name:'Enter NBC Sales',exact:true}).waitFor();assert.equal(await p.getByLabel('Workspace to review').count(),0);
  await p.goto(origin);await p.getByRole('button',{name:'Enter NBC Sales',exact:true}).waitFor();checks.push({logout:'root and private panels locked'});await ctx.close();
 }
 for(const path of ['/api/workspace/session','/api/members','/api/caller/sessions']){
  const r=await fetch(origin+path);assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');checks.push({path,anonymousStatus:r.status});
 }
 const forged=await fetch(origin+'/api/workspace/session',{headers:{Authorization:'Bearer invalid-session'}});assert.equal(forged.status,401);checks.push({forgedSessionStatus:forged.status});assert.equal(errors.length,0);
 writeFileSync(out+`/${label}-checks.json`,JSON.stringify({at:new Date().toISOString(),origin,checks,errors,passed:true,interceptedRequests:0},null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{await browser.close();}
