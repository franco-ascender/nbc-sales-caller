// No paid actions. --reconcile only reads saved Apify/Retell receipts and updates billing fields.
import {chromium} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {parseEnv} from 'node:util';
const env=parseEnv(readFileSync('.env.local','utf8')),base=process.env.NBC_CHECK_ORIGIN||'http://127.0.0.1:3131';
const report={passed:false,blockedPaidActions:0,views:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const auth=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.NBC_OPERATOR_EMAIL,password:env.NBC_OPERATOR_INITIAL_PASSWORD})});const session=await auth.json();if(!auth.ok)throw Error('Auth failed');
 const headers={Authorization:'Bearer '+session.access_token};
 if(process.argv.includes('--reconcile')){const response=await fetch(base+'/api/admin/costs',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action:'reconcile'})});report.reconciliation=await response.json();if(!response.ok||report.reconciliation.unavailable)throw Error('Provider receipts did not reconcile');}
 const response=await fetch(base+'/api/admin/costs',{headers});const data=await response.json();if(!response.ok)throw Error('Cost report unavailable');
 report.report={rows:data.rows.length,browser:data.rows.filter(r=>r.kind==='Browser voice').length,reportedMicrousd:data.reportedMicrousd,missing:data.missing,invoices:data.statements.length,coverage:data.coverage.length,incomplete:data.rows.filter(r=>!r.receiptComplete).length};
 if(data.rows.some(r=>!r.receiptComplete&&(r.costPerMinuteMicrousd!==null||r.costPerQualifiedMicrousd!==null)))throw Error('Incomplete unit price exposed');
 if(!data.statements.some(s=>s.provider==='Outscraper'&&s.total_microusd===305100000&&s.due_microusd===217630000))throw Error('Invoice mapping missing');
 report.anonymous=(await fetch(base+'/api/admin/costs')).status;if(report.anonymous!==401)throw Error('Anonymous costs exposed');
 const context=await browser.newContext();await context.route(/\/api\/(pilot|caller\/phone-test|caller\/sessions|lead-engine\/runs)(?:\?.*)?$/,async route=>{if(route.request().method()!=='GET'){report.blockedPaidActions++;await route.abort();}else await route.continue();});
 const page=await context.newPage();await page.goto(base+'/lead-engine#costs');await page.getByLabel('Email address',{exact:true}).fill(env.NBC_OPERATOR_EMAIL);await page.getByLabel('Password',{exact:true}).fill(env.NBC_OPERATOR_INITIAL_PASSWORD);await page.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();
 const section=page.getByRole('region',{name:'Operation cost breakdown'});await section.getByText(/Saved snapshot:/).waitFor({timeout:30000});
 mkdirSync('artifacts/readiness/cost-dashboard',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(400);report.views.push({view:'costs',width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await page.screenshot({path:`artifacts/readiness/cost-dashboard/costs-${width}.png`,fullPage:false});}
 await section.getByRole('combobox').first().selectOption('Browser voice');await section.getByRole('cell',{name:/Voice practice/}).first().waitFor();
 await section.getByRole('button',{name:'Record document',exact:true}).click();await section.getByLabel('Invoice / receipt number').fill('DO-NOT-SAVE-FIXTURE');await section.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('tab',{name:'Build Search',exact:true}).click();await page.getByRole('region',{name:'Selected list performance'}).waitFor({timeout:30000});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});report.views.push({view:'scraper',width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await page.screenshot({path:`artifacts/readiness/cost-dashboard/scraper-${width}.png`,fullPage:false});}
 await page.goto(base+'/caller#analytics');await page.getByRole('region',{name:'Operation cost breakdown'}).getByText(/Saved snapshot:/).waitFor({timeout:30000});
 report.passed=!report.blockedPaidActions&&!report.views.some(v=>v.overflow);
}catch(e){report.failure=e.message;}finally{await browser.close();mkdirSync('artifacts/readiness/cost-dashboard',{recursive:true});writeFileSync('artifacts/readiness/cost-dashboard/check.json',JSON.stringify(report,null,2));console.log(report);if(!report.passed)process.exitCode=1;}
