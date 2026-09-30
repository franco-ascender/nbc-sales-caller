import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import{mkdirSync,writeFileSync}from'node:fs';
const origin=process.env.TARGET_URL||'http://127.0.0.1:3148',out='artifacts/readiness/caller-booking';mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[],errors=[];let debugPage;
try{for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();debugPage=page;page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('console error',m.text());});const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,now=new Date().toISOString();let calls=[],assets=[],starts=0,notes=0,denyPhoneOnce=false;let saved=[];let config={businessName:'NBC Sales',locationId:'',calendarId:'',timezone:'America/New_York',pipelineId:'',stageId:'',tags:[],emailFrom:'',smsFrom:'',sendEmail:true,sendSms:true,enabled:false};let connected=false;let savedToken='';const view=()=>({phoneEngine:'retell',perOperationApproval:true,capCents:2500,reservedCents:0,reportedMicrousd:0,availableCents:2500,paused:false,pending:calls.some(c=>c.state==='running'&&c.canControl!==false),slots:calls,verification:{configured:true,unitCents:1},booking:{ready:false}});
await page.route('**/auth/v1/**',r=>r.fulfill({json:{access_token:'fixture-token',refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user:{id:id(1),email:'fixture@example.test'}}}));
await page.route('**/api/**',async r=>{const req=r.request(),u=new URL(req.url()),p=u.pathname,b=req.postData()?req.postDataJSON():null;
if(p==='/api/caller/booking/config'){if(req.method()==='PUT'){assert.equal(b.config.enabled,false);assert.equal(b.token,'fixture-private-token');savedToken=b.token;config=b.config;connected=true;}return r.fulfill({json:{config,connected,toolsReady:false,bookings:[],verifiedAt:null}});}
if(p==='/api/caller/booking/options'){assert.equal(b.token,'fixture-private-token');assert.equal(b.locationId,'fixture-location');return r.fulfill({json:{locationName:'NBC Sales fixture',calendars:[{id:'calendar',name:'NBC discovery'}],pipelines:[{id:'pipeline',name:'NBC pipeline',stages:[{id:'booked',name:'Meeting booked'}]}]}});}
if(p==='/api/workspace/session')return r.fulfill({json:{user:{id:id(1),name:'Fixture admin',role:'admin'}}});
if(p==='/api/admin/costs')return r.fulfill({json:{rows:[],providers:[],reportedMicrousd:0,estimatedMicrousd:0,missing:0,truncated:false,generatedAt:now,statements:[],coverage:[],unallocated:[]}});
if(p==='/api/caller/phone-test'){if(req.method()==='GET'&&denyPhoneOnce){denyPhoneOnce=false;return r.fulfill({status:403,json:{error:'Fixture access is being restored.'}});}if(req.method()==='POST'){starts++;assert.equal(b.scenarioId,id(2));assert.equal(b.approvedMaxCents,250);assert.equal(b.confirmed,true);calls=[{key:'dial-'+b.requestId,kind:'phone',title:'Phone trial · ending 0123',scenarioTitle:'Roofing consultation',state:'running',destinationLast4:'0123',createdAt:now,updatedAt:now,reportedMicrousd:null,result:{providerStatus:'ongoing'}}];assets=[{resource_key:calls[0].key,note:'',note_version:0,recording_status:'pending',live_status:'ongoing',live_transcript:[{role:'agent',message:'What would you like to improve this month?'}]}];}return r.fulfill({json:view()});}
if(p==='/api/pilot'){if(b?.action==='stop'){calls[0].state='completed';calls[0].result={...calls[0].result,durationSeconds:63,transcript:assets[0].live_transcript,summary:'Discussed new business goals.'};calls[0].reportedMicrousd=150000;assets[0].recording_status='saved';}return r.fulfill({json:view()});}
if(p==='/api/caller/archive'){if(req.method()==='PATCH'){notes++;assert.equal(b.version,notes-1);assets[0]={...assets[0],note:b.note,note_version:b.version+1};return r.fulfill({json:{note:b.note,note_version:b.version+1}});}if(u.searchParams.has('recording'))return r.fulfill({json:{url:'https://audio.fixture.test/recording.wav'}});return r.fulfill({json:{calls,assets}});}
if(p.endsWith('/scenarios')){if(req.method()==='POST'){const scenario={id:b.requestId,title:b.scenario.title,conversationType:b.scenario.conversationType,createdAt:now,brief:b.scenario};saved.unshift(scenario);return r.fulfill({status:201,json:{scenario}});}return r.fulfill({json:{configured:true,scenarios:saved}});}
if(p.endsWith('/leads'))return r.fulfill({json:{configured:true,leads:[],hasMore:false}});
if(p.endsWith('/sessions')||p.endsWith('/sessions/reconcile'))return r.fulfill({json:{configured:true,sessions:[],nextCursor:null,updated:0}});
if(p.endsWith('/demo'))return r.fulfill({json:{available:true,exists:false}});
if(p.endsWith('/pipeline'))return r.fulfill({json:{version:id(3),defaultId:id(4),buckets:[{id:id(4),name:'New leads',color:'slate',outcome:'active',position:0,default_key:'new'}]}});
if(p.endsWith('/lists'))return r.fulfill({json:{lists:[]}});
if(p.endsWith('/views'))return r.fulfill({json:{view:null}});
if(p.endsWith('/knowledge'))return r.fulfill({json:{configured:true,sources:[]}});
return r.fulfill({json:{configured:true,voices:[],sessions:[],sources:[],assets:[],scenarios:[]}});
});
await page.goto(origin+'/caller');await page.getByLabel('Email address',{exact:true}).fill('fixture@example.test');await page.getByLabel('Password',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Enter NBC Sales'}).click();
await page.getByRole('heading',{name:'Start a conversation.',exact:true}).waitFor();
await page.getByRole('button',{name:'Advanced tools',exact:true}).click();
await page.getByRole('tab',{name:'Booking',exact:true}).click();
await page.getByRole('heading',{name:'Turn a conversation into a meeting.'}).waitFor();
assert.ok(await page.getByLabel('Enable booking for new phone calls').isDisabled());
await page.getByLabel('Location ID',{exact:true}).fill('fixture-location');
await page.getByLabel('Private integration token',{exact:true}).fill('fixture-private-token');
await page.getByRole('button',{name:'Load calendars & pipelines',exact:true}).click();
await page.getByRole('status').filter({hasText:'Connected to NBC Sales fixture'}).waitFor();
await page.getByLabel('Calendar',{exact:true}).selectOption('calendar');
await page.getByLabel('Pipeline',{exact:true}).selectOption('pipeline');
await page.getByLabel('Stage after booking',{exact:true}).selectOption('booked');
await page.getByLabel('Connected sender email',{exact:true}).fill('meetings@example.test');
await page.getByLabel('Connected GHL SMS number',{exact:true}).fill('+13055550100');
await page.getByLabel('Tags to add',{exact:true}).fill('meeting booked, nbc caller');
await page.getByRole('button',{name:'Save booking settings',exact:true}).click();
await page.getByRole('status').filter({hasText:'Booking settings saved.'}).waitFor();
assert.equal(await page.getByLabel('Private integration token',{exact:true}).inputValue(),'');
assert.equal(savedToken,'fixture-private-token');assert.equal(config.enabled,false);
assert.ok(await page.getByLabel('Enable booking for new phone calls').isDisabled());
assert.equal(starts,0,'Configuring GHL never initiates calls');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
await page.screenshot({path:out+`/booking-${width}.png`,fullPage:true});
await page.getByRole('tab',{name:'Make a Call',exact:true}).click();
await page.getByRole('heading',{name:'Start a conversation.',exact:true}).waitFor();
assert.equal(starts,0);checks.push(`${width}px: NBC connection, real-option selection, save, secret cleared, activation gated, existing caller intact; no calls`);await context.close();}
assert.deepEqual(errors,[]);writeFileSync(out+'/browser.json',JSON.stringify({checks,errors,realCalls:0},null,2));console.log(checks.join('\n'));}catch(e){console.log('Page errors',errors);await debugPage.screenshot({path:out+'/failure.png',fullPage:true});throw e;}finally{await browser.close();}
