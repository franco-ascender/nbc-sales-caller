import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs';
const origin=process.env.TARGET_URL||'http://127.0.0.1:3157';const out='artifacts/client-onboarding';fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
try{for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1050}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let row=null,starts=0;
await page.route('**/auth/v1/**',r=>r.fulfill({json:{access_token:'fixture-token',refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.test'}}}));
await page.route('**/api/**',r=>{const req=r.request(),p=new URL(req.url()).pathname,b=req.postData()?req.postDataJSON():null;
if(p==='/api/workspace/session')return r.fulfill({json:{user:{id:'11111111-1111-4111-8111-111111111111',name:'Fixture admin',role:'admin'}}});
if(p==='/api/onboarding'){
 if(b){row={id:b.id,intake:b.intake,state:'draft',revision:1,task_id:null,issue:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};return r.fulfill({json:{record:row}});}
 return r.fulfill({json:{records:row?[row]:[],connected:true,connectionIssue:''}});
}
if(p.startsWith('/api/onboarding/')){if(b?.action==='start'){starts++;assert.equal(b.confirmed,true);row={...row,state:'queued',revision:4,task_id:'fixture-task'};}return r.fulfill({json:{record:row}});}
return r.fulfill({json:{allowed:false}});
});
await page.goto(origin+'/onboarding');await page.getByLabel('Email address',{exact:true}).fill('fixture@example.test');await page.getByLabel('Password',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Enter NBC Sales'}).click();
await page.getByRole('heading',{name:'Start a client’s onboarding'}).waitFor();
await page.getByLabel('Client / company name').fill('Fixture Doors');await page.getByLabel('Primary contact name').fill('Test Client');await page.getByLabel('Primary contact email').fill('client@example.test');
await page.getByRole('button',{name:'Save & review'}).click();await page.getByRole('heading',{name:'Review & start'}).waitFor();assert.equal(starts,0);assert.ok(await page.getByRole('button',{name:'Start onboarding',exact:true}).isDisabled());
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:`${out}/review-${width}.png`,fullPage:true});
await page.getByLabel('This is a confirmed ELITE client.').check();await page.getByRole('button',{name:'Start onboarding',exact:true}).click();await page.getByRole('heading',{name:'Your onboarding request'}).waitFor();assert.equal(starts,1);assert.ok(await page.getByText('Still handled by Elias').isVisible());await page.reload();await page.getByRole('heading',{name:'Your onboarding request'}).waitFor();assert.equal(starts,1);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:`${out}/result-${width}.png`,fullPage:true});await context.close();console.log(`${width}px: draft, explicit confirmation, receipt, refresh persistence, no overflow; fixture only`);}
assert.deepEqual(errors,[]);}finally{await browser.close();}
