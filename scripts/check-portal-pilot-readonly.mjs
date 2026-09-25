// Live UI/access/readiness inspection. This script NEVER clicks Start or sends a paid action.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
const e=parseEnv(readFileSync('.env.local','utf8'));
const base='https://nbc-sales-nbc-sales.vercel.app';
const browser=await chromium.launch({channel:'chrome',headless:true});
const out='artifacts/readiness/first-live-tests';mkdirSync(out,{recursive:true});
const report={base,errors:[],blockedPaidActions:0,connections:[],snapshots:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/api/pilot',async route=>{
   const req=route.request();if(req.method()==='POST'){
     const body=req.postDataJSON();if(body.action!=='check'){report.blockedPaidActions++;await route.abort();throw Error('Disallowed action in read-only inspection');}
   }
   await route.continue();
 });
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto(base+'/test-center',{waitUntil:'domcontentloaded'});
 await page.getByLabel('Email address',{exact:true}).fill(e.NBC_OPERATOR_EMAIL);
 await page.getByLabel('Password',{exact:true}).fill(e.NBC_OPERATOR_INITIAL_PASSWORD);
 await page.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();
 await page.getByRole('heading',{name:'Test Center',exact:true}).waitFor({timeout:45000});
 await page.getByRole('heading',{name:'Your live Nalify call',exact:true}).waitFor({timeout:30000});
 const budget=await page.getByRole('region',{name:'Shared test budget'}).innerText();
 if(!budget.includes('$25.00')||!budget.includes('$3.25'))throw Error('Prior spend or budget not present in portal.');
 await page.getByRole('button',{name:'Download CSV',exact:true}).waitFor();
 report.phoneButtonEnabled=await page.getByRole('button',{name:'Call my phone · $2.50 limit',exact:true}).isEnabled();
 if(!report.phoneButtonEnabled)throw Error('Phone action is not enabled.');
 report.sampleButtons=await page.getByRole('button',{name:'Start sample · $0.75 limit',exact:true}).count();
 report.enabledSampleButtons=await page.getByRole('button',{name:'Start sample · $0.75 limit',exact:true}).evaluateAll(buttons=>buttons.filter(b=>!b.disabled).length);
 if(report.enabledSampleButtons!==5)throw Error('Expected five enabled listing samples.');
 // Use the authenticated session the UI actually established. Do not emit/store its token.
 const checks=await page.evaluate(async()=>{
   const envelope=JSON.parse(localStorage.getItem('nbc-workspace-session-v1')||'null');
   const token=envelope?.value?JSON.parse(envelope.value).access_token:'';
   if(!token)throw Error('Authenticated session not found for connection check.');
   const output=[];
   for(const key of ['caller-2','roofing-charlotte']){
     const r=await fetch('/api/pilot',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'check',key})});
     const b=await r.json();output.push({key,status:r.status,error:b.error??null});
   }return output;
 });report.connections=checks;
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(400);await page.screenshot({path:out+'/portal-'+name+'.png',fullPage:true});
   report.snapshots.push({name,layout:await page.evaluate(()=>{const a=document.querySelector('aside'),m=document.querySelector('#workspace-content');return {sidebarRight:a?.getBoundingClientRect().right,contentLeft:m?.getBoundingClientRect().left,wrapClass:m?.parentElement?.className,wrapMargin:m?.parentElement?getComputedStyle(m.parentElement).marginLeft:null};}),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 }
 const anonymous=await context.request.get(base+'/api/pilot');report.anonymousStatus=anonymous.status();
 if(report.snapshots.some(s=>s.name==='desktop'&&s.layout.contentLeft<s.layout.sidebarRight)||report.errors.length||report.blockedPaidActions||report.connections.some(c=>c.status!==200)||report.snapshots.some(s=>s.overflow)||report.anonymousStatus!==401)throw Error('Portal readiness check failed; see private evidence.');
 report.passed=true;
}catch(error){report.passed=false;report.failure=error.message;process.exitCode=1;}
finally{await browser.close();writeFileSync(out+'/portal-readonly-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
