// Real deployed UI with intercepted phone APIs. No real call or provider dispatch.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const e=parseEnv(readFileSync('.env.local','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={passed:false,fixtureStarts:0,fixtureStops:0,paidActions:0,errors:[]};
const view={perOperationApproval:true,capCents:2500,reservedCents:3000,availableCents:0,reportedMicrousd:0,paused:false,pending:false,destinationLast4:'0000',slots:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/api/caller/phone-test',async route=>{
  if(route.request().method()==='POST'){
   report.fixtureStarts++;const b=route.request().postDataJSON();
   if(b.phone!=='+1 (305) 555-0123'||!b.confirmed||b.approvedMaxCents!==250)throw Error('Wrong fixture destination or confirmation');
   view.pending=true;view.reservedCents+=250;view.availableCents-=250;
   view.slots=[{key:'dial-'+b.requestId,kind:'phone',title:'Fixture phone trial',destinationLast4:'0123',allocationCents:250,reserveCents:250,count:null,createdAt:new Date().toISOString(),state:'running',reportedMicrousd:null,result:{message:'Fixture connected'}}];
   // Simulate dispatch success with a lost application response.
   await new Promise(resolve=>setTimeout(resolve,200));
   await route.fulfill({status:503,json:{error:'Fixture lost response — read saved state'}});return;
  }
  await route.fulfill({json:view});
 });
 await context.route('**/api/pilot',async route=>{
  if(route.request().method()==='POST'){
   const b=route.request().postDataJSON();
   if(!['sync','stop'].includes(b.action)||b.key!==view.slots[0]?.key)throw Error('Unexpected fixture action');
   if(b.action==='stop'){report.fixtureStops++;view.pending=false;view.slots[0].state='completed';}
  }
  await route.fulfill({json:view});
 });
 let approve=false;const page=await context.newPage();page.on('dialog',async d=>{if(!d.message().includes('$2.50'))throw Error('Missing cost');await(approve?d.accept():d.dismiss());});page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto('https://nbc-sales-nbc-sales.vercel.app/caller#dialer');
 await page.getByLabel('Email address',{exact:true}).fill(e.NBC_OPERATOR_EMAIL);
 await page.getByLabel('Password',{exact:true}).fill(e.NBC_OPERATOR_INITIAL_PASSWORD);
 await page.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();
 const panel=page.getByRole('region',{name:'AI phone trial'});
 await panel.getByRole('heading',{name:'Start a conversation.'}).waitFor();
 await panel.getByLabel('Recipient’s phone number',{exact:true}).fill('+1 (305) 555-0123');
 await panel.getByRole('checkbox').check();
 await panel.getByRole('button',{name:'Start AI test call',exact:true}).click();
 await page.waitForTimeout(300);if(report.fixtureStarts!==0)throw Error('Cancel dispatched');approve=true;
 await panel.getByRole('button',{name:'Start AI test call',exact:true}).evaluate(button=>{button.click();button.click();});
 await panel.getByRole('button',{name:'Stop call',exact:true}).waitFor();
 if(report.fixtureStarts!==1)throw Error('Repeated click sent more than one request');
 await page.reload();await panel.getByRole('button',{name:'Stop call',exact:true}).waitFor();
 if(report.fixtureStarts!==1||await panel.getByLabel('Recipient’s phone number',{exact:true}).isEnabled())throw Error('Reload lost active attempt');
 const savedStorageKey=await page.evaluate(()=>Object.keys(localStorage).find(k=>k.startsWith('nbc-phone-trial:')));
 await panel.getByRole('button',{name:'Stop call',exact:true}).click();
 await panel.getByLabel('Recipient’s phone number',{exact:true}).fill('+1 (305) 555-0124');
 if(await panel.getByRole('checkbox').isChecked())throw Error('New call reused recipient confirmation');
 if(!await panel.getByRole('button',{name:'Start AI test call',exact:true}).isDisabled())throw Error('New call bypassed confirmation');
 // Recreate a stale saved completed request, as in the reported screenshot.
 await page.evaluate(({key,id})=>localStorage.setItem(key,id),{key:savedStorageKey,id:view.slots[0].key.slice(5)});
 await page.reload();
 await panel.getByLabel('Recipient’s phone number',{exact:true}).fill('+1 (305) 555-0124');
 await panel.getByRole('checkbox').check();
 if(!await panel.getByRole('button',{name:'Start AI test call',exact:true}).isEnabled())throw Error('Completed history blocked new call');
 if(report.fixtureStarts!==1||report.fixtureStops!==1||report.errors.length)throw Error('Unexpected dispatch, stop or UI error');
 report.passed=true;
}catch(error){report.failure=error.message;process.exitCode=1;}
finally{await browser.close();writeFileSync('artifacts/readiness/dialer-20260926/ui-fixtures.json',JSON.stringify(report,null,2));console.log(report);}
