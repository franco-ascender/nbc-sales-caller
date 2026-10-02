import './caller-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {contactIntake,opportunityFromWebhook} from '../src/lib/onboarding-ghl.ts';
const {POST,GET}=await import('../src/app/api/onboarding/ghl/route.ts');

test('GHL payload mapping requires an explicit opportunity ID and retains only intake fields',()=>{
 assert.equal(opportunityFromWebhook({customData:{nbc_opportunity_id:'opportunity123'}}),'opportunity123');
 assert.equal(opportunityFromWebhook({nbc_opportunity_id:'opportunity123'}),'opportunity123');
 for(const input of [{id:'ambiguous123'},{nbc_opportunity_id:'{{opportunity.id}}'},{nbc_opportunity_id:'../contacts'},{nbc_opportunity_id:'opportunity123',customData:{nbc_opportunity_id:'different123'}}])assert.throws(()=>opportunityFromWebhook(input));
 const mapped=contactIntake({firstName:'Example',lastName:'Client',email:'EXAMPLE@example.test',customFields:[{id:'recording',value:'https://fathom.video/share/example'}],notes:'Do not retain'},'recording');
 assert.equal(mapped.intake.company,'Example Client');assert.equal(mapped.intake.email,'example@example.test');assert.deepEqual(mapped.issues,[]);assert.ok(!JSON.stringify(mapped).includes('Do not retain'));
 assert.ok(contactIntake({name:'Example'},'').issues.includes('Missing email.'));
 assert.ok(contactIntake({name:'Example',email:'bad'},'').issues.length);
});

test('capture authenticates, verifies exact stage through GHL, deduplicates, and never dispatches',async()=>{
 const original=globalThis.fetch,old={...process.env};
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://database.fixture.test',SUPABASE_SECRET_KEY:'fixture',ONBOARDING_GHL_API_TOKEN:'fixture-ghl',ONBOARDING_GHL_WEBHOOK_SECRET:'fixture-webhook-secret-at-least-32-characters',ONBOARDING_GHL_LOCATION_ID:'location123',ONBOARDING_GHL_PIPELINE_ID:'pipeline123',ONBOARDING_GHL_STAGE_ID:'stage12345'});
 let mode='normal',reads=0,writes=0,authCalls=0;const receipts=new Map<string,unknown>();
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const opportunity={id:'opportunity123',locationId:'location123',pipelineId:'pipeline123',pipelineStageId:'stage12345',contactId:'contact123',status:'open'};
 globalThis.fetch=async(input,init={})=>{
  const u=new URL(input instanceof Request?input.url:String(input)),method=init.method??'GET';
  if(u.host==='services.leadconnectorhq.com'){
   assert.equal(method,'GET');reads++;assert.equal(new Headers(init.headers).get('Authorization'),'Bearer fixture-ghl');assert.equal(init.redirect,'error');
   if(mode==='unavailable')return json({},503);
   if(u.pathname.startsWith('/opportunities/'))return json({opportunity:{...opportunity,...(mode==='foreign'?{locationId:'otherlocation'}:{}),...(mode==='otherstage'?{pipelineStageId:'different123'}:{})}});
   return json({contact:{id:'contact123',locationId:mode==='foreigncontact'?'otherlocation':'location123',name:'Example Client',email:mode==='missing'?'':'fixture@example.test'}});
  }
  assert.equal(u.host,'database.fixture.test','Unexpected service: capture must not call Zapier, Slack or ClickUp');
  if(u.pathname==='/auth/v1/user'){authCalls++;return json({id:'actor',email_confirmed_at:'2026-01-01',email:'fixture@example.test'});}
  if(u.pathname.endsWith('/nbc_members'))return json({id:'actor',role:mode==='nonadmin'?'coach':'admin',status:'active',display_name:'Fixture'});
  assert.ok(u.pathname.endsWith('/nbc_onboarding_ghl_receipts'));
  if(method==='POST'){
   writes++;assert.match(new Headers(init.headers).get('prefer')??'',/resolution=ignore-duplicates/);
   const row=JSON.parse(String(init.body));assert.equal(row.mode,'capture');assert.equal(row.intake.company,'Example Client');
   if(receipts.has(row.opportunity_id))return json([]);
   receipts.set(row.opportunity_id,row);return json([{id:'receipt123'}]);
  }
  return json([...receipts.values()]);
 };
 const req=(body:unknown={customData:{nbc_opportunity_id:'opportunity123'}},auth=true)=>new Request('https://portal.fixture.test/api/onboarding/ghl',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+process.env.ONBOARDING_GHL_WEBHOOK_SECRET}:{})},body:JSON.stringify(body)});
 try{
  assert.equal((await POST(req({},false))).status,401);assert.equal(reads,0);assert.equal(writes,0);
  assert.equal((await POST(req({id:'ambiguous123'}))).status,400);assert.equal(reads,0);
  const pair=await Promise.all([POST(req()),POST(req())]);const out=await Promise.all(pair.map(r=>r.json()));
  assert.deepEqual(out.map(r=>r.duplicate).sort(),[false,true]);assert.equal(receipts.size,1);assert.ok(out.every(r=>r.automation_started===false&&r.mode==='capture'));
  assert.equal((await POST(req())).status,200);assert.equal(receipts.size,1);
  const before=writes;mode='otherstage';assert.equal((await (await POST(req())).json()).ignored,true);assert.equal(writes,before);
  for(const wrong of ['foreign','foreigncontact']){mode=wrong;assert.equal((await POST(req())).status,403);assert.equal(writes,before);}
  mode='unavailable';assert.equal((await POST(req())).status,502);assert.equal(writes,before);
  mode='missing';assert.equal((await (await POST(req())).json()).needs_details,true);
  assert.equal((await POST(req({padding:'x'.repeat(66000)}))).status,413);
  assert.equal((await POST(new Request('https://portal.fixture.test',{method:'POST',headers:{Authorization:'Bearer '+process.env.ONBOARDING_GHL_WEBHOOK_SECRET},body:'not json'}))).status,415);
  assert.equal((await GET(new Request('https://portal.fixture.test'))).status,401);assert.equal(authCalls,0);
  mode='nonadmin';assert.equal((await GET(new Request('https://portal.fixture.test',{headers:{Authorization:'Bearer fixture'}}))).status,403);
  mode='normal';const admin=await GET(new Request('https://portal.fixture.test',{headers:{Authorization:'Bearer fixture'}}));assert.equal(admin.status,200);assert.equal((await admin.json()).receipts.length,1);
 }finally{globalThis.fetch=original;for(const key of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SECRET_KEY','ONBOARDING_GHL_API_TOKEN','ONBOARDING_GHL_WEBHOOK_SECRET','ONBOARDING_GHL_LOCATION_ID','ONBOARDING_GHL_PIPELINE_ID','ONBOARDING_GHL_STAGE_ID']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
