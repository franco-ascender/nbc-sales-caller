// Read-only UI review. Paid mutations blocked at browser routing.
import {chromium} from '@playwright/test';import {parseEnv} from 'node:util';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const e=parseEnv(readFileSync('.env.local','utf8')),b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage({viewport:{width:1440,height:1100}});const report={passed:false,blockedMutations:0};mkdirSync('artifacts/readiness/lead-redesign',{recursive:true});
await p.route(/\/api\/(pilot|lead-engine\/.*)/,async r=>{if(r.request().method()!=='GET'){report.blockedMutations++;await r.abort();}else await r.continue();});
try{
 await p.goto('https://nbc-sales-nbc-sales.vercel.app/lead-engine');await p.getByLabel('Email address',{exact:true}).fill(e.NBC_OPERATOR_EMAIL);await p.getByLabel('Password',{exact:true}).fill(e.NBC_OPERATOR_INITIAL_PASSWORD);await p.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();
 const tabs=p.getByRole('tablist',{name:'Lead Engine workspace'});await tabs.waitFor();
 if(await tabs.getByRole('tab').first().innerText()!=='Build Search')throw Error('Wrong first tab');
 if(await tabs.getByRole('tab',{name:'Build Search',exact:true}).getAttribute('aria-selected')!=='true')throw Error('Wrong default tab');
 await p.getByRole('heading',{name:'Choose your market',exact:true}).waitFor();
 await p.getByLabel('Search area',{exact:true}).selectOption('nationwide');
 if(await p.getByLabel('City',{exact:true}).count())throw Error('Nationwide requires city');
 await p.locator('form select').last().selectOption('5000');if(!await p.getByRole('button',{name:'Review cost & start',exact:true}).isDisabled())throw Error('Large-list guard lost');
 await p.locator('form select').last().selectOption('50');
 await p.screenshot({path:'artifacts/readiness/lead-redesign/desktop.png'});
 await p.getByRole('button',{name:'Advanced tools',exact:true}).click();await p.getByRole('tab',{name:'Evidence guide',exact:true}).click();await p.getByRole('heading',{name:'Know why a lead earns its score.'}).waitFor();await p.getByRole('button',{name:'Advanced tools',exact:true}).click();
 await tabs.getByRole('tab',{name:'Build Search',exact:true}).focus();await p.keyboard.press('ArrowRight');if(await tabs.getByRole('tab',{name:'Lead Lists',exact:true}).getAttribute('aria-selected')!=='true')throw Error('Keyboard tab failed');
 await tabs.getByRole('tab',{name:'Build Search',exact:true}).click();await p.setViewportSize({width:390,height:844});await p.screenshot({path:'artifacts/readiness/lead-redesign/mobile.png',fullPage:true});
 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)throw Error('Mobile page overflow');report.passed=true;
}catch(error){await p.screenshot({path:'artifacts/readiness/lead-redesign/failure.png',fullPage:true});throw error;}finally{await b.close();writeFileSync('artifacts/readiness/lead-redesign/report.json',JSON.stringify(report,null,2));console.log(report);}
