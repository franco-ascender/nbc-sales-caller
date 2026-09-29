// Read-only production UI check; never starts paid work.
import {chromium} from '@playwright/test';
import {parseEnv} from 'node:util';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const e=parseEnv(readFileSync('.env.local','utf8'));
const b=await chromium.launch({channel:'chrome',headless:true});
const p=await b.newPage({viewport:{width:1440,height:1000}});
const report={pages:[],paidActions:0};
await p.route(/\/api\/(caller\/phone-test|pilot|lead-engine\/.*)/,async r=>{if(r.request().method()!=='GET'){report.paidActions++;await r.abort();}else await r.continue();});
try{
 await p.goto('https://nbc-sales-nbc-sales.vercel.app/');
 await p.getByLabel('Email address',{exact:true}).fill(e.NBC_OPERATOR_EMAIL);
 await p.getByLabel('Password',{exact:true}).fill(e.NBC_OPERATOR_INITIAL_PASSWORD);
 await p.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();
 await p.getByRole('navigation',{name:'Platform navigation'}).waitFor({state:'attached'});
 for(const path of ['/','/lead-engine','/caller']){
  await p.goto('https://nbc-sales-nbc-sales.vercel.app'+path);
  const nav=p.getByRole('navigation',{name:'Platform navigation'});
  await nav.waitFor({state:'attached'});
  const labels=await nav.getByRole('link').allTextContents();
  if(JSON.stringify(labels)!==JSON.stringify(['Overview','Lead Engine','Caller']))throw Error('Unexpected navigation '+labels);
  if(path==='/'){
   await p.getByRole('button',{name:'Edit',exact:true}).waitFor();
   for(const id of ['roadmap','lesson','calendar','credits'])if(await p.locator(`[data-widget="${id}"]`).count())throw Error('Hidden widget rendered');
   await p.getByRole('button',{name:'Edit',exact:true}).click();
   await p.getByRole('button',{name:'Add widget',exact:true}).click();
   if(await p.getByRole('button',{name:'Learning',exact:true}).count())throw Error('Learning gallery still visible');
  }
  report.pages.push(path);
 }
 await p.setViewportSize({width:390,height:844});
 await p.getByRole('button',{name:'Open platform navigation'}).click();
 await p.getByRole('navigation',{name:'Platform navigation'}).getByRole('link',{name:'Overview',exact:true}).waitFor({state:'visible'});
 report.mobile=true;
 report.passed=report.paidActions===0;
}finally{await b.close();mkdirSync('artifacts/readiness/focused-navigation',{recursive:true});writeFileSync('artifacts/readiness/focused-navigation/report.json',JSON.stringify(report,null,2));console.log(report);}
