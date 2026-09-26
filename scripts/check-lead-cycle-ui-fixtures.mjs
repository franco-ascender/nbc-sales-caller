// Deployed UI, fully intercepted search APIs. No real paid request reaches the server.
import{chromium}from'playwright';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{parseEnv}from'node:util';
const e=parseEnv(readFileSync('.env.local','utf8')),out='artifacts/readiness/lead-cycle-20260926';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={passed:false,fixtureCreates:0,fixtureAdvances:0,paidActions:0,errors:[],views:[]};
const pilot={capCents:2500,reservedCents:800,availableCents:1700,reportedMicrousd:0,paused:false,pending:false,destinationLast4:'0000',verification:{configured:true,unitCents:1,blocker:null},slots:[]};
let runs=[],stage=0;
const row={name:'Fixture Clinic',city:'Miami',state:'FL',phone10:'3055551234',website:null,sourceUrl:'https://example.test/clinic',rejection:null,chain:null,duplicate:false};
const rows=[row,{...row,name:'Second Clinic',phone10:'3055551235'},{...row,name:'Missing Phone',phone10:null}];
function checked(phone10){return {phone10,state:'completed',verification:{phone10,lineType:'Mobile',dnc:false,tcpa:false,reachable:true,verifiedAt:new Date(Date.now()-1000).toISOString()}};}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
 await context.route('**/api/pilot',async route=>{if(route.request().method()!=='GET'){report.paidActions++;await route.abort();return;}await route.fulfill({json:pilot});});
 await context.route('**/api/lead-engine/runs',async route=>{
  if(route.request().method()==='POST'){
   const b=route.request().postDataJSON();
   if(b.action==='create'){
    report.fixtureCreates++;if(!b.confirmed)throw Error('Missing confirmation');
    const key='list-'+b.requestId;pilot.slots=[{key,kind:'scrape',industry:b.industry,title:b.name,state:'ready',count:b.count,allocationCents:100,reserveCents:75,reportedMicrousd:null,result:{}}];
    runs=[{key,name:b.name,industry:b.industry,city:b.city,state:b.state,count:b.count,status:'running',phase:'discover',started_at:new Date().toISOString(),phase_started_at:new Date().toISOString(),finished_at:null,message:'Search authorized.',events:[]}];
    // Lost create response: client must read saved state and never start a second list.
    await route.fulfill({status:503,json:{error:'Fixture lost response'}});return;
   }else if(b.action==='pause'){runs[0].status='paused';runs[0].message='Paused after current step.';}
   else if(b.action==='resume'){runs[0].status='running';}
   else if(b.action==='advance'){
    report.fixtureAdvances++;stage++;const run=runs[0],slot=pilot.slots[0];
    slot.state=stage===1?'running':'completed';pilot.pending=stage===1;
    if(stage>=2)slot.result.rows=rows;
    run.phase=stage<2?'discover':stage===2?'filter':stage===3?'research':stage<6?'verify':stage===6?'deliver':'done';
    run.message=stage<2?'Finding business listings.':stage===2?'Data received: 3 businesses.':stage===3?'Filtered: one missing phone excluded.':stage<6?'Verifying eligible phone numbers.':'Preparing your saved results.';
    if(stage>=5)slot.result.phoneChecks=[checked('3055551234')];
    if(stage>=6)slot.result.phoneChecks.push(checked('3055551235'));
    if(stage>=7){run.status='completed';run.finished_at=new Date().toISOString();}
    run.events.push({phase:run.phase,message:run.message,at:new Date().toISOString()});
   }else throw Error('Unexpected fixture action');
  }
  await route.fulfill({json:{runs,pilot}});
 });
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto('https://nbc-sales-nbc-sales.vercel.app/lead-engine#search');
 await page.getByLabel('Email address',{exact:true}).fill(e.NBC_OPERATOR_EMAIL);await page.getByLabel('Password',{exact:true}).fill(e.NBC_OPERATOR_INITIAL_PASSWORD);await page.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();
 const panel=page.getByRole('region',{name:'Lead search runs'});await panel.getByRole('heading',{name:'Build a qualified lead list'}).waitFor();
 await panel.getByLabel('List name',{exact:true}).fill('My full-cycle fixture');
 await panel.getByRole('checkbox').check();
 await panel.getByRole('button',{name:'Start search · reserve $0.75',exact:true}).evaluate(button=>{button.click();button.click();});
 const progress=panel.getByRole('region',{name:'List progress'});await progress.waitFor();
 await progress.getByRole('button',{name:'Pause after current step'}).click();
 const pausedAt=report.fixtureAdvances;await page.waitForTimeout(3500);if(report.fixtureAdvances!==pausedAt)throw Error('Paused workflow advanced');
 await progress.getByRole('button',{name:'Resume saved list'}).click();
 await page.reload();await progress.waitFor();
 if(report.fixtureCreates!==1)throw Error('Reload or double click created a second list');
 await progress.getByRole('heading',{name:'Verifying phone numbers',exact:true}).waitFor({timeout:45000});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1050});await page.waitForTimeout(200);report.views.push({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await progress.screenshot({path:out+'/progress-'+width+'.png'});}
 await progress.getByRole('heading',{name:'Your list is ready',exact:true}).waitFor({timeout:45000});
 if(await progress.getByRole('progressbar').getAttribute('aria-valuenow')!=='100')throw Error('Completion progress missing');
 await panel.getByRole('button',{name:'Export phone-qualified (2)',exact:true}).waitFor();
 const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Export phone-qualified (2)',exact:true}).click();const file=await download;const csv=readFileSync(await file.path(),'utf8');if(csv.includes('Missing Phone')||csv.split('\r\n').length!==3)throw Error('Qualified export contains excluded rows');
 if(report.errors.length||report.paidActions||report.views.some(v=>v.overflow))throw Error('UI assertions failed');report.passed=true;
}catch(error){report.failure=error.message;process.exitCode=1;}finally{await browser.close();writeFileSync(out+'/ui-fixtures.json',JSON.stringify(report,null,2));console.log(report);}
