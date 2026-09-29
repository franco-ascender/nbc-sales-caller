// UI reads only: never Start, Verify, Research, send, book, purchase or call a paid provider.
import{chromium}from'playwright';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{parseEnv}from'node:util';
const e=parseEnv(readFileSync('.env.local','utf8')),base='https://nbc-sales-nbc-sales.vercel.app',out='artifacts/readiness/feedback-20260926';mkdirSync(out,{recursive:true});
const report={errors:[],paidActions:0,views:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route(/\/api\/(pilot|caller\/phone-test|lead-engine\/(?:verification-rate|runs))(?:\?.*)?$/,async route=>{if(route.request().method()!=='GET'){report.paidActions++;await route.abort();return;}await route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/caller#ai-caller');await page.getByLabel('Email address',{exact:true}).fill(e.NBC_OPERATOR_EMAIL);await page.getByLabel('Password',{exact:true}).fill(e.NBC_OPERATOR_INITIAL_PASSWORD);await page.getByRole('button',{name:'Enter NBC Sales',exact:true}).click();
 await page.getByRole('heading',{name:'Calls & outcomes',exact:true}).waitFor({timeout:45000});
 const call=page.getByRole('region',{name:'Telephone calls'});
 await call.getByRole('heading',{name:'Conversation transcript',exact:true}).waitFor();
 if(await page.getByRole('link',{name:'Test Center',exact:true}).count())throw Error('Standalone navigation still present');
 await call.getByRole('heading',{name:'Known offer was not answered',exact:true}).waitFor();
 if(await call.getByText('Appointment not confirmed',{exact:true}).count()!==1)throw Error('Unconfirmed booking not shown');
 await call.screenshot({path:out+'/caller-native.png'});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);report.views.push({page:'caller',width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
 const dialerResponse=page.waitForResponse(r=>r.url().endsWith('/api/caller/phone-test')&&r.request().method()==='GET');
 await page.goto(base+'/caller#dialer');
 const dialerData=await(await dialerResponse).json();
 const dialer=page.getByRole('region',{name:'AI phone trial'});
 await dialer.getByRole('heading',{name:'Let Anas try the caller.',exact:true}).waitFor({timeout:30000});
 await dialer.getByLabel('Recipient’s phone number',{exact:true}).fill('+1 (305) 555-0123');
 await dialer.getByRole('checkbox').check();
 await page.waitForTimeout(800);
 report.confirmationLayout=await dialer.getByRole('checkbox').evaluate(input=>({display:getComputedStyle(input.parentElement).display,direction:getComputedStyle(input.parentElement).flexDirection}));
 if(report.confirmationLayout.display!=='flex'||report.confirmationLayout.direction!=='row')throw Error('Confirmation layout inherited incompatible styles');
 report.dialerStartEnabled=await dialer.getByRole('button',{name:'Start AI test call',exact:true}).isEnabled();
 const today=new Date().toISOString().slice(0,10);const todayCalls=dialerData.slots.filter(s=>s.kind==='phone'&&s.state!=='ready'&&s.createdAt?.startsWith(today)).length;
 const canStart=!dialerData.pending&&!dialerData.paused&&dialerData.availableCents>=250&&todayCalls<3;
 report.dialerLimitEnforced=report.dialerStartEnabled===canStart;
 if(!report.dialerLimitEnforced)throw Error('Dialer availability differs from its saved budget/daily limits');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);report.views.push({page:'dialer',width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await dialer.screenshot({path:out+'/dialer-'+width+'.png'});}
 await page.reload();await dialer.getByRole('heading',{name:'Let Anas try the caller.',exact:true}).waitFor();
 if(await dialer.getByLabel('Recipient’s phone number',{exact:true}).inputValue())throw Error('Recipient was unnecessarily persisted');
 await page.goto(base+'/lead-engine#search');
 await page.getByRole('heading',{name:'Build a qualified lead list',exact:true}).waitFor({timeout:30000});
 const lead=page.getByRole('region',{name:'Lead search runs'});
 await lead.getByRole('heading',{name:'Results & evidence',exact:true}).waitFor();
 report.verificationBlocked=!(await lead.getByRole('button',{name:'Verify eligible phones',exact:true}).isEnabled());
 await lead.getByText('Set the verification account rate',{exact:true}).click();
 await lead.getByLabel('Verification price per phone',{exact:true}).waitFor();
 report.qualifiedExportDisabled=!(await lead.getByRole('button',{name:'Export phone-qualified (0)',exact:true}).isEnabled());
 report.freeResearchAvailable=await lead.getByRole('button',{name:'Research registry evidence · free',exact:true}).isEnabled();
 await lead.getByLabel('Filter lead results',{exact:true}).selectOption('excluded');
 report.exclusionRows=await lead.locator('tbody tr').count();
 await lead.getByLabel('Filter lead results',{exact:true}).selectOption('all');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);report.views.push({page:'lead-engine',width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await lead.screenshot({path:out+'/lead-native-'+width+'.png'});}
 await page.goto(base+'/test-center');await page.waitForURL('**/caller#ai-caller');report.oldUrlRedirects=true;
 const anonymous=await context.request.get(base+'/api/pilot');report.anonymousStatus=anonymous.status();
 if(report.errors.length||report.paidActions||report.views.some(v=>v.overflow)||report.anonymousStatus!==401||!report.verificationBlocked||!report.freeResearchAvailable)throw Error('Native flow assertions failed');
 report.passed=true;
}catch(e){report.passed=false;report.failure=e.message;process.exitCode=1;}finally{await browser.close();writeFileSync(out+'/native-ui.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
