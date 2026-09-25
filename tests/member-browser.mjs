import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [stage, output] = process.argv.slice(2);
const require = createRequire(stage+'/package.json');
const { chromium } = require('playwright');
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const member={id:'00000000-0000-4000-8000-000000000001',display_name:'DEMO Student',role:'student',status:'active',coach_id:'00000000-0000-4000-8000-000000000002'};
const report={at:new Date().toISOString(),environment:'Isolated local build; authenticated data is intercepted DEMO, not persistence evidence',checks:[],errors:[]};
let activePage;
try {
 for(const [device,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport});const page=await context.newPage();activePage=page;page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(e.message));
  let state={member,subject:member,people:[member],onboarding:null,events:[],messages:[],tickets:[],credits:{available:0,reserved:0,entries:[]},nextMessages:null};
  let failSave=false;
  await page.route('**/auth/v1/token?**',route=>route.fulfill({json:{access_token:'DEMO-token',refresh_token:'DEMO-refresh',expires_in:3600,token_type:'bearer',user:{id:member.id,email:'demo@example.invalid'}}}));
  await page.route('**/api/members?**',route=>route.fulfill({json:state}));
  await page.route('**/api/members',async route=>{
   const body=route.request().postDataJSON();
   if(failSave){await route.fulfill({status:503,json:{error:'DEMO: save unavailable; your draft is preserved.'}});return;}
   if(body.action==='onboarding')state.onboarding={business:body.business,timezone:body.timezone,goal:body.goal,questions:body.questions,completed_at:body.complete?'2026-09-14T00:00:00Z':null};
   if(body.action==='message')state.messages.push({id:body.id,author_id:member.id,body:body.body,created_at:'2026-09-14T12:00:00Z'});
   if(body.action==='ticket')state.tickets.push({id:body.id,member_id:member.id,title:body.title,body:body.body,status:'open',created_at:'2026-09-14T12:00:00Z'});
   if(body.action==='ticketStatus'){const ticket=state.tickets.find(t=>t.id===body.id);assert(ticket,'Ticket id must be preserved');ticket.status=body.status;}
   await route.fulfill({json:{saved:true}});
  });
  await page.goto('http://127.0.0.1:3102/members',{waitUntil:'networkidle'});
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/${device}-public-entry.png`,fullPage:true});
  await page.getByLabel('Email',{exact:true}).fill('demo@example.invalid');await page.getByLabel('Password',{exact:true}).fill('DEMO-password');await page.getByRole('button',{name:'Enter your workspace'}).click();
  await page.getByLabel('Business or company').fill('DEMO Company');await page.getByLabel('Time zone').fill('America/New_York');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('What would you like to achieve?').fill('DEMO: develop a consistent sales process');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('What questions are on your mind?').fill('DEMO: where should I start?');
  assert.equal(state.onboarding,null,"Continue must never auto-complete onboarding");failSave=true;await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('alert').filter({hasText:'DEMO: save unavailable'}).waitFor();assert.equal(await page.getByLabel('What questions are on your mind?').inputValue(),'DEMO: where should I start?');failSave=false;
  await page.getByRole('button',{name:'Complete onboarding'}).click();await page.getByRole('status').filter({hasText:'Saved to your workspace.'}).waitFor();
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/${device}-DEMO-onboarding.png`,fullPage:true});report.checks.push(device+': onboarding completion and failed-save draft preservation');
  for(const tab of ['Calendar','Mentor chat','Support','NBC credits']){
   await page.getByRole('navigation',{name:'Membership sections'}).getByRole('button',{name:tab,exact:true}).click();
   if(tab==='Mentor chat'){await page.getByLabel('Your message',{exact:true}).fill('DEMO question for my coach');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByText('DEMO question for my coach',{exact:true}).waitFor();}
   if(tab==='Support'){await page.getByLabel('What do you need help with?').fill('DEMO support request');await page.getByLabel('Details',{exact:true}).fill('DEMO ticket details');await page.getByRole('button',{name:'Open ticket',exact:true}).click();await page.getByRole('heading',{name:'DEMO support request'}).waitFor();await page.getByRole('button',{name:'Mark resolved',exact:true}).click();await page.getByRole('button',{name:'Reopen ticket',exact:true}).waitFor();}
   const width=await page.evaluate(()=>({screen:innerWidth,body:document.documentElement.scrollWidth}));assert(width.body<=width.screen,`${device} ${tab} overflow`);
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/${device}-DEMO-${tab.toLowerCase().replaceAll(' ','-')}.png`,fullPage:true});report.checks.push(device+': '+tab);
  }
  assert.equal(await page.getByText('Record credit allocation',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Enter your workspace'}).waitFor();assert.equal(await page.getByText('DEMO Student',{exact:false}).count(),0);report.checks.push(device+': student has no admin credit action; sign-out clears private UI');await context.close();
 }
 const response=await fetch('http://127.0.0.1:3102/api/members');assert.equal(response.status,401);
 const post=await fetch('http://127.0.0.1:3102/api/members',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"grant","amount":1000000}'});assert.equal(post.status,401);report.checks.push('Actual API: anonymous GET and POST rejected 401');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.failure=error.message;if(activePage){report.buttons=await activePage.getByRole("button").allTextContents();await activePage.screenshot({path:output+"/DEMO-failure.png",fullPage:true});}process.exitCode=1;}finally{await browser.close();writeFileSync(output+'/browser-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
