import { createRequire } from 'node:module';
import { mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [stage,output]=process.argv.slice(2);const require=createRequire(stage+'/package.json');const{chromium}=require('playwright');mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const report={at:new Date().toISOString(),environment:'Local build; all staff data and writes intercepted DEMO',checks:[]};
const student={id:'00000000-0000-4000-8000-000000000002',role:'student',status:'active',display_name:'DEMO Student',coach_id:'00000000-0000-4000-8000-000000000001'};
try{
 for(const role of ['admin','coach']){
  const actor={id:'00000000-0000-4000-8000-000000000001',role,status:'active',display_name:'DEMO '+role,coach_id:null};const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(10000);
  let selected=actor;const writes=[];
  function state(){return {member:actor,subject:selected,people:[student],onboarding:{business:'DEMO company',timezone:'America/New_York',goal:'DEMO goal',questions:'',completed_at:'2026-09-14T00:00:00Z'},events:[],messages:[],tickets:[],credits:{available:0,reserved:0,entries:[]},nextMessages:null};}
  await page.route('**/auth/v1/token?**',r=>r.fulfill({json:{access_token:'DEMO-staff',refresh_token:'DEMO-refresh',expires_in:3600,token_type:'bearer',user:{id:actor.id,email:'demo@example.invalid'}}}));
  await page.route('**/api/members?**',r=>{selected=new URL(r.request().url()).searchParams.get('member')===student.id?student:actor;return r.fulfill({json:state()});});
  await page.route('**/api/members',r=>{writes.push(r.request().postDataJSON());return r.fulfill({json:{saved:true}});});
  await page.goto('http://127.0.0.1:3102/members');await page.getByLabel('Email',{exact:true}).fill('demo@example.invalid');await page.getByLabel('Password',{exact:true}).fill('demo-password');await page.getByRole('button',{name:'Enter your workspace'}).click();
  await page.getByRole('navigation',{name:'Membership sections'}).getByRole('button',{name:'Calendar',exact:true}).waitFor();
  if(role==='admin'){
   await page.getByText('Add a session',{exact:true}).click();await page.getByLabel('Session title').fill('DEMO group coaching');await page.getByLabel('Starts',{exact:true}).fill('2026-09-20T10:00');await page.getByLabel('Ends',{exact:true}).fill('2026-09-20T11:00');await page.getByLabel('Meeting link').fill('https://example.invalid/demo-meeting');await page.getByRole('button',{name:'Add session',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved to your workspace.'}).waitFor();assert.equal(writes.at(-1).action,'event');assert.equal(writes.at(-1).memberId,undefined);
   await page.getByLabel('Workspace to review').selectOption(student.id);await page.getByRole('navigation',{name:'Membership sections'}).getByRole('button',{name:'NBC credits',exact:true}).click();await page.getByText('Add credits to DEMO Student',{exact:true}).click();await page.getByLabel('Credits',{exact:true}).fill('50');await page.getByLabel('Reason shown in the member’s history').fill('DEMO allocation');await page.getByRole('button',{name:'Record credit allocation'}).click();await page.getByRole('status').filter({hasText:'Saved to your workspace.'}).waitFor();assert.equal(writes.at(-1).action,'grant');assert.equal(writes.at(-1).memberId,student.id);assert.equal(writes.at(-1).amount,50);
   report.checks.push('Admin: program event form and credit grant target correct member');
  }else{
   assert.equal(await page.getByText('Add a session',{exact:true}).count(),0);await page.getByLabel('Workspace to review').selectOption(student.id);await page.getByRole('navigation',{name:'Membership sections'}).getByRole('button',{name:'Calendar',exact:true}).click();await page.getByText('Add a session',{exact:true}).waitFor();await page.getByRole('navigation',{name:'Membership sections'}).getByRole('button',{name:'NBC credits',exact:true}).click();assert.equal(await page.getByText('Add credits to DEMO Student',{exact:true}).count(),0);report.checks.push('Coach: private student schedule available, no program-wide session or credit grant control');
  }
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/DEMO-${role}.png`,fullPage:true});await context.close();
 }
 report.passed=true;
}catch(e){report.passed=false;report.failure=e.message;process.exitCode=1;}finally{await browser.close();writeFileSync(output+'/staff-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
