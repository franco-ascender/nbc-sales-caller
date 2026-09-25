import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
loadEnvFile('.env.local');
const [origin,mode='fixture']=process.argv.slice(2);if(!origin||!['fixture','live'].includes(mode))throw Error('Supply origin and fixture|live');
const out='artifacts/lanes/I03',stage=JSON.parse(readFileSync(out+'/staging.json')).path;
const require=createRequire(stage+'/package.json');const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[],errors=[];
const day=n=>new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate()-n)).toISOString();
const stages=['new','queued','contacted','qualified','booked','won','lost','do_not_call'];
const leads=Array.from({length:80},(_,i)=>({id:String(i),stage:stages[i%8],name:'DEMO',phone:'',created_at:day(1)}));leads.push({id:'excluded',stage:'new',is_demo:true});
const sessions=Array.from({length:24},(_,i)=>({id:String(i),channel:i%2?'phone':'web',status:'completed',duration_seconds:180,created_at:day(i%12)}));sessions.push({id:'failed',channel:'web',status:'failed',duration_seconds:9999,created_at:day(0)},{id:'demo',channel:'web',status:'completed',duration_seconds:9999,is_demo:true,created_at:day(0)});
try{
 for(const [i,viewport]of [{width:1440,height:1080},{width:390,height:844}].entries()){
  const ctx=await browser.newContext({viewport});const page=await ctx.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  let crmError=false,callsError=false,empty=false;
  if(mode==='fixture'){
   await page.route('**/auth/v1/token?**',r=>r.fulfill({json:{access_token:'DEMO-token',refresh_token:'DEMO-refresh',expires_in:3600,token_type:'bearer',user:{id:'00000000-0000-4000-8000-000000000001'}}}));
   await page.route('**/api/workspace/session',r=>r.fulfill({json:{user:{id:'00000000-0000-4000-8000-000000000001',name:'DEMO Member',role:'admin'}}}));
   await page.route('**/api/members/summary',r=>r.fulfill({json:{completed:true,available:240}}));
   await page.route('**/api/caller/leads',r=>r.fulfill(crmError?{status:503,json:{error:'DEMO unavailable'}}:{json:{leads:empty?[]:leads,configured:true}}));
   await page.route('**/api/caller/sessions',r=>r.fulfill(callsError?{status:503,json:{error:'DEMO unavailable'}}:{json:{sessions:empty?[]:sessions,nextCursor:null}}));
  }
  await page.goto(origin);await page.getByRole('button',{name:'Enter NBC Sales',exact:true}).waitFor();
  if(mode==='fixture'){await page.getByLabel('Email address').fill('demo@example.invalid');await page.getByLabel('Password',{exact:true}).fill('DEMO');}
  else{await page.getByLabel('Email address').fill(process.env.NBC_OPERATOR_EMAIL);await page.getByLabel('Password',{exact:true}).fill(process.env.NBC_OPERATOR_INITIAL_PASSWORD);}
  await page.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();await page.getByRole('heading',{name:'Resumen.',exact:true}).waitFor();
  const refresh=page.getByRole('button',{name:'Refresh summary',exact:true});await expect(refresh).toBeEnabled();
  const metric=label=>page.getByRole('region',{name:'Your saved activity'}).locator('article').filter({hasText:label}).locator(':scope > strong');
  if(mode==='fixture'){
   await expect(metric('Your leads')).toHaveText('80');await expect(metric('Ready for outreach')).toHaveText('20');await expect(metric('Conversations')).toHaveText('24');await expect(metric('Practice minutes')).toHaveText('36');
   await page.getByRole('button',{name:'7D',exact:true}).click();await expect(page.getByRole('button',{name:'7D',exact:true})).toHaveAttribute('aria-pressed','true');
   const activity=page.locator('article').filter({has:page.getByRole('heading',{name:'Conversation activity',exact:true})});await expect(activity.locator('strong').first()).toHaveText('14');
   await page.getByRole('button',{name:'30D',exact:true}).click();await expect(activity.locator('strong').first()).toHaveText('24');
   const graph=page.locator('svg[tabindex="0"]');await graph.focus();await page.keyboard.press('ArrowLeft');await expect(graph).not.toHaveAttribute('aria-label',/Use left and right/);await page.keyboard.press('Escape');
   const group=page.getByRole('button',{name:'New & queued 20',exact:true});await group.click();await expect(group).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('img',{name:/^Pipeline: 80/}).locator('strong')).toHaveText('20');await group.click();
   checks.push({device:i?'mobile':'desktop',metricsAccurate:true,demoExcluded:true,period7:14,period30:24,keyboardChart:true,interactivePipeline:true});
  }else{await expect(page.locator('#workspace-content [role="alert"]')).toHaveCount(0);checks.push({device:i?'mobile':'desktop',operatorLogin:true,realDataLoaded:true});}
  await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:out+`/${mode}-${i?'mobile':'desktop'}.png`,fullPage:true,animations:'disabled'});
  if(mode==='fixture'){
   crmError=true;await refresh.click();await page.getByRole('alert').filter({hasText:'Conversation activity is still available.'}).waitFor();await expect(metric('Conversations')).toHaveText('24');await expect(metric('Your leads')).toHaveText('—');
   crmError=false;callsError=true;await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('alert').filter({hasText:'Your pipeline is still available.'}).waitFor();await expect(metric('Your leads')).toHaveText('80');await expect(metric('Conversations')).toHaveText('—');
   callsError=false;empty=true;await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByText('Your next conversation starts the curve.',{exact:true}).waitFor();await expect(metric('Your leads')).toHaveText('0');await expect(metric('Conversations')).toHaveText('0');await expect(page.locator('#workspace-content [role="alert"]')).toHaveCount(0);
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+`/empty-${i?'mobile':'desktop'}.png`,fullPage:true,animations:'disabled'});
   await page.emulateMedia({reducedMotion:'reduce'});assert(await page.evaluate(()=>Array.from(document.querySelectorAll('#workspace-content *')).every(el=>getComputedStyle(el).animationName==='none')));
   checks.push({device:i?'mobile':'desktop',partialFailuresIndependent:true,retryRestoresData:true,emptyUsesZeroNotFakeChart:true,reducedMotion:true});
  }
  const support=page.getByRole('link',{name:'Support',exact:true});if(i===1)await page.getByRole('button',{name:'Open platform navigation'}).click();await expect(page.getByRole('navigation',{name:'Platform navigation'}).getByRole('link',{name:'Resumen',exact:true})).toBeVisible();await expect(support).toBeVisible();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Enter NBC Sales'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Resumen.',exact:true}).count(),0);await ctx.close();
 }
 assert.equal(errors.length,0);writeFileSync(out+`/${mode}-checks.json`,JSON.stringify({at:new Date().toISOString(),origin,mode,checks,errors,passed:true,writes:0,interceptedData:mode==='fixture'},null,2)+'\n');console.log(JSON.stringify({passed:true,scenarios:checks.length,mode}));
}finally{await browser.close();}
