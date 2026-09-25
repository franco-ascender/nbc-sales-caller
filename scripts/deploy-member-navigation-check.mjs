// Real temporary-member verification; no paid operations or permanent test data.
import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
loadEnvFile('.env.local');
const [origin,label='local']=process.argv.slice(2);if(!origin||!['local','vercel'].includes(label))throw Error('Supply origin and local|vercel');
const out='artifacts/lanes/I02/navigation';const stage=JSON.parse(readFileSync(out+'/staging.json')).path;
const require=createRequire(stage+'/package.json');const {chromium,expect}=require('@playwright/test');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const dir=readFileSync('artifacts/lanes/I02/private-access-location.txt','utf8').trim();const admins=JSON.parse(readFileSync(dir+'/auth-accounts.json')).accounts;
const accounts=[];const checks=[];const errors=[];let passed=false,cleaned=false;
function checked(r){if(r.error)throw Error('Database check '+r.error.code);return r.data;}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const [i,viewport]of [{width:1440,height:1000},{width:390,height:844}].entries()){
  const email=`nbc-navigation-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
  const {user}=checked(await db.auth.admin.createUser({email,password,email_confirm:true}));accounts.push(user.id);
  checked(await db.from('nbc_members').insert({id:user.id,display_name:'TEST Member',role:'student'}));
  checked(await db.rpc('nbc_credit_apply',{p_action:'grant',p_member:user.id,p_operation:randomUUID(),p_amount:17,p_reason:'Navigation verification',p_actor:admins[0].id}));
  const ctx=await browser.newContext({viewport});const page=await ctx.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.name));
  const login=async()=>{await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();await page.getByRole('link',{name:'NBC Credits: 17 available',exact:true}).waitFor();};
  const menu=async()=>{const button=page.getByRole('button',{name:'Open platform navigation',exact:true});if(await button.isVisible())await button.click();};
  await page.goto(origin+'/members');await login();
  await page.getByRole('heading',{name:'Start Here',exact:true}).waitFor();await menu();
  const start=page.getByRole('navigation',{name:'Platform navigation'}).getByRole('link',{name:'Start Here',exact:true});await expect(start).toBeVisible();assert.equal(await start.locator('svg.lucide-footprints').count(),1);
  if(i===1)await page.getByRole('button',{name:'Close platform navigation'}).click();
  assert.equal(await page.getByRole('navigation',{name:'Membership sections'}).count(),0);
  if(i===0){const footer=await page.getByRole('link',{name:'Support',exact:true}).boundingBox();assert(footer&&footer.y>=0&&footer.y+footer.height<=viewport.height,'Support stays in visible sidebar footer');}
  await page.screenshot({path:out+`/${label}-${i?'mobile':'desktop'}-start.png`,fullPage:true,animations:'disabled'});
  await page.getByLabel('What are you working on right now?').fill('TEST business');await page.getByLabel('What would you like to achieve next?').fill('TEST next goal');
  await page.getByRole('button',{name:'Save for later'}).click();await page.getByRole('status').filter({hasText:'Saved to your workspace.'}).waitFor();
  await page.reload();await login();await expect(page.getByLabel('What are you working on right now?')).toHaveValue('TEST business');
  await page.getByRole('button',{name:'Complete onboarding'}).click();await page.getByRole('heading',{name:'Roadmap charging',exact:true}).waitFor();await menu();
  const map=page.getByRole('navigation',{name:'Platform navigation'}).getByRole('link',{name:'Your Roadmap',exact:true});await expect(map).toBeVisible();assert.equal(await map.locator('svg.lucide-map').count(),1);
  if(i===1)await page.getByRole('button',{name:'Close platform navigation'}).click();
  await page.screenshot({path:out+`/${label}-${i?'mobile':'desktop'}-roadmap.png`,fullPage:true,animations:'disabled'});
  checks.push({device:i?'mobile':'desktop',draftPersisted:true,completionSwitchesLabelAndMap:true,roadmap:'Roadmap charging'});
  for(const [title,path]of [['Calendar','/calendar'],['Mentor Chat','/mentor-chat']]){await menu();await page.getByRole('navigation',{name:'Platform navigation'}).getByRole('link',{name:title,exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,path);assert.equal(await page.getByRole('navigation',{name:'Membership sections'}).count(),0);await page.getByRole('link',{name:'NBC Credits: 17 available'}).waitFor();}
  await menu();const support=page.getByRole('link',{name:'Support',exact:true});await expect(support).toBeVisible();assert((await support.locator('..').textContent()).includes('NBC workspace'));await support.click();await page.getByRole('heading',{name:'Support',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/support');
  const counter=page.getByRole('link',{name:'NBC Credits: 17 available'});await counter.click();await page.getByRole('heading',{name:'NBC Credits',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/credits');
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));const box=await counter.boundingBox();assert(box&&box.y>=0&&box.y<100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  checks.push({device:i?'mobile':'desktop',independentCalendarAndChat:true,supportAtWorkspaceFooter:true,creditsVisibleWhenScrolled:true,available:17});
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Enter NBC Sales'}).waitFor();assert.equal(await counter.count(),0);await ctx.close();
 }
 // Staff review must not replace the header's balance or journey with the student's.
 const ctx=await browser.newContext();const p=await ctx.newPage();p.setDefaultTimeout(20000);await p.goto(origin+'/credits');await p.getByLabel('Email address').fill(admins[0].email);await p.getByLabel('Password',{exact:true}).fill(admins[0].initialPassword);await p.getByRole('button',{name:'Enter NBC Sales'}).click();
 const counter=p.getByRole('link',{name:/^NBC Credits: \d.* available$/});await counter.waitFor();const before=await counter.getAttribute('aria-label');await p.getByText('Review a member',{exact:true}).click();await p.getByLabel('Workspace to review').selectOption(accounts[0]);await expect(p.getByText('17',{exact:true})).toBeVisible();assert.equal(await counter.getAttribute('aria-label'),before);checks.push({adminReviewKeepsOwnCreditBalance:true});await ctx.close();
 for(const path of ['/calendar','/mentor-chat','/support','/credits']){const c=await browser.newContext();const p=await c.newPage();await p.goto(origin+path);await p.getByRole('button',{name:'Enter NBC Sales'}).waitFor();await c.close();}
 const r=await fetch(origin+'/api/members/summary');assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');checks.push({newRoutesRequireLogin:true,anonymousSummary:401});assert.equal(errors.length,0);passed=true;
}finally{
 await browser.close();
 if(accounts.length){assert(accounts.every(id=>/^[0-9a-f-]{36}$/.test(id)));const ids=accounts.map(id=>`'${id}'`).join(',');const query=`begin; delete from public.nbc_onboarding where member_id in (${ids}); delete from public.nbc_credit_entries where member_id in (${ids}); delete from public.nbc_credit_operations where member_id in (${ids}); delete from public.nbc_credit_wallets where member_id in (${ids}); delete from public.nbc_members where id in (${ids}); commit;`;
  const r=await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:false})});if(!r.ok)throw Error('Temporary-data cleanup failed');for(const id of accounts)checked(await db.auth.admin.deleteUser(id));
 }cleaned=true;writeFileSync(out+`/${label}-checks.json`,JSON.stringify({at:new Date().toISOString(),origin,checks,errors,passed,temporaryAccountsRemoved:accounts.length,cleaned,interceptedRequests:0},null,2)+'\n');
}
console.log(JSON.stringify({passed,checks:checks.length,cleaned}));
