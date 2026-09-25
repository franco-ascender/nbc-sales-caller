import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
loadEnvFile('.env.local');
const out='artifacts/lanes/I02/activation';
const stage=JSON.parse(readFileSync(out+'/staging.json')).path;
const require=createRequire(stage+'/package.json');const {chromium}=require('playwright');
const origin=process.argv[2];if(!origin?.startsWith('https://'))throw Error('Supply HTTPS origin');
const dir=readFileSync('artifacts/lanes/I02/private-access-location.txt','utf8').trim();
const accounts=JSON.parse(readFileSync(dir+'/auth-accounts.json')).accounts;
const checks=[];const errors=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const [i,viewport] of [{width:1440,height:1000},{width:390,height:844}].entries()){
  const context=await browser.newContext({viewport});const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.name));
  const response=await page.goto(origin+'/members');assert.equal(response.status(),200);
  await page.getByRole('button',{name:'Enter your workspace'}).waitFor();
  await page.screenshot({path:out+`/public-${i?'mobile':'desktop'}.png`,fullPage:true});
  await page.getByLabel('Email',{exact:true}).fill(accounts[i].email);await page.getByLabel('Password',{exact:true}).fill(accounts[i].initialPassword);
  await page.getByRole('button',{name:'Enter your workspace'}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
  await page.getByLabel('Workspace to review').waitFor();
  assert(await page.getByText(accounts[i].display_name+' · Administrator',{exact:true}).isVisible());
  for(const title of ['Your roadmap','Calendar','Mentor chat','Support','NBC credits']){
   await page.getByRole('button',{name:title,exact:true}).click();
   await page.getByRole('region',{name:title,exact:true}).waitFor();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('button',{name:'Enter your workspace'}).waitFor();
  assert.equal(await page.getByLabel('Workspace to review').count(),0);
  checks.push({account:accounts[i].display_name,device:i?'mobile':'desktop',realLogin:true,role:'admin',sections:5,signOutClearsData:true});await context.close();
 }
 for(const [path,method,status] of [['/api/members','GET',401],['/api/members','POST',401],['/api/caller/sessions','GET',401],['/api/caller/sessions/reconcile','POST',401],['/.env.local','GET',404],['/scripts/deploy-member-provision.mjs','GET',404]]){
  const r=await fetch(origin+path,{method,redirect:'manual'});assert.equal(r.status,status);checks.push({path,method,status:r.status});
 }
 for(const path of ['/','/caller','/lead-engine','/academy','/ask-anas','/integrations']){const r=await fetch(origin+path,{redirect:'manual'});assert.equal(r.status,200);checks.push({path,status:r.status});}
 assert.equal(errors.length,0);
 writeFileSync(out+'/browser-live.json',JSON.stringify({at:new Date().toISOString(),origin,checks,errors,passed:true,interceptedRequests:0},null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,interceptedRequests:0}));
}finally{await browser.close();}
