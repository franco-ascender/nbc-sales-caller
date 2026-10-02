import './caller-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {emptyIntake,FIELDS,LIST_ID,SPACE_ID,type IntakeRecord} from '../src/lib/client-onboarding.ts';
const {saveOnboarding,startOnboarding,reconcileOnboarding}=await import('../src/services/client-onboarding.ts');
const {automationToken,automationPayload,zapierConfiguration}=await import('../src/services/onboarding-automation.ts');
const {POST}=await import('../src/app/api/onboarding/automation/[id]/route.ts');
const base={...emptyIntake(),company:'New Client',name:'Fixture',email:'fixture@example.test'};
const actor=randomUUID();
test('direct dispatch and callbacks: one transport, one claim, receipts, races, failures and authorization',async()=>{
 const old={...process.env},original=globalThis.fetch;
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://database.fixture.test',SUPABASE_SECRET_KEY:'fixture',CLICKUP_API_KEY:'fixture',ONBOARDING_TRANSPORT:'zapier',ONBOARDING_CALLBACK_SECRET:'fixture-secret-not-for-real-use-123456789',ONBOARDING_ZAPIER_WEBHOOK_URL:'https://hooks.zapier.com/hooks/catch/12345/fixture/'});
 const records=new Map<string,IntakeRecord>();let hooks=0,clickupWrites=0,mode='normal',payload:Record<string,unknown>={};
 const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
 async function callback(id:string,body:unknown,token=automationToken(id)) {return POST(new Request('https://portal.fixture.test/api/onboarding/automation/'+id,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id})});}
 const receipt={action:'complete',channel_id:'C0123456789',message_ts:'1790956800.000001'};
 globalThis.fetch=async(input,init={})=>{
  const u=new URL(input instanceof Request?input.url:String(input)),method=init.method??'GET',body=init.body?JSON.parse(String(init.body)):null;
  if(u.host==='database.fixture.test'){
   assert.ok(u.pathname.endsWith('/nbc_client_onboardings'));
   const matches=[...records.values()].filter(r=>['id','revision','state'].every(k=>!u.searchParams.has(k)||String(r[k as keyof IntakeRecord])===u.searchParams.get(k)!.slice(3)));
   if(method==='POST'){const now=new Date().toISOString();const r={...body,state:'draft',revision:1,task_id:null,transport:null,automation_claimed_at:null,slack_channel_id:null,welcome_message_ts:null,created_at:now,updated_at:now};records.set(r.id,r);return json(r);}
   if(method==='PATCH'){if(!matches.length)return json(null);Object.assign(matches[0],body);return json({...matches[0]});}
   return json(matches[0]??null);
  }
  if(u.host==='api.clickup.com'){
   if(method!=='GET'){clickupWrites++;throw Error('Direct flow must not write to ClickUp');}
   if(u.pathname.endsWith('/field'))return json({fields:Object.values(FIELDS)});
   if(u.pathname===`/api/v2/list/${LIST_ID}`)return json({id:LIST_ID,space:{id:SPACE_ID},statuses:[{status:'pending '}]});
   if(mode==='legacy')return json({tasks:[{id:'legacy',name:base.company,list:{id:LIST_ID},custom_fields:[{id:FIELDS.email.id,value:base.email}]}],last_page:true});
   return json({tasks:[],last_page:true});
  }
  assert.equal(u.host,'hooks.zapier.com');assert.equal(method,'POST');assert.equal(init.redirect,'error');hooks++;payload=body;
  assert.ok(body.callback_token);assert.equal(body.event_id,records.get(body.event_id)?.id);assert.ok(!JSON.stringify(body).includes('fixture-secret'));
  if(mode==='timeout')throw Error('Ambiguous transport timeout');
  if(mode==='race'){assert.deepEqual(await (await callback(body.event_id,{action:'claim'})).json(),{run:true});assert.equal((await callback(body.event_id,receipt)).status,200);}
  return json({status:'success'});
 };
 async function draft(){return saveOnboarding(actor,{id:randomUUID(),intake:base});}
 const start=(r:IntakeRecord)=>startOnboarding(actor,r.id,{confirmed:true,revision:r.revision,transport:'zapier'});
 try{
  for(const bad of ['http://hooks.zapier.com/hooks/catch/123/x/','https://hooks.zapier.com.evil.test/hooks/catch/123/x/','https://hooks.zapier.com/hooks/catch/123/x/?token=secret','https://user:pass@hooks.zapier.com/hooks/catch/123/x/','https://127.0.0.1/']){process.env.ONBOARDING_ZAPIER_WEBHOOK_URL=bad;assert.throws(zapierConfiguration);}
  process.env.ONBOARDING_ZAPIER_WEBHOOK_URL='https://hooks.zapier.com/hooks/catch/12345/fixture/';
  const badName=await saveOnboarding(actor,{id:randomUUID(),intake:{...base,company:'A & B'}});await assert.rejects(()=>start(badName),/unaccented/);assert.equal(records.get(badName.id)?.state,'draft');assert.equal(hooks,0);
  const first=await draft();assert.equal((await callback(first.id,{action:'claim'})).status,409);
  await assert.rejects(()=>startOnboarding(actor,first.id,{confirmed:true,revision:1}),/connection changed/);assert.equal(hooks,0);
  const both=await Promise.allSettled([start(first),start(first)]);assert.equal(hooks,1);assert.ok(both.some(r=>r.status==='fulfilled'&&r.value.state==='automation_pending'));assert.equal(clickupWrites,0);
  assert.equal((await start(first)).state,'automation_pending');assert.equal(hooks,1);
  assert.equal((await callback(first.id,receipt)).status,409);
  assert.equal((await callback(first.id,{action:'claim'},'')).status,401);
  assert.equal((await callback(first.id,{action:'claim'},automationToken(randomUUID()))).status,401);
  const claims=await Promise.all([callback(first.id,{action:'claim'}),callback(first.id,{action:'claim'})]);assert.deepEqual((await Promise.all(claims.map(r=>r.json()))).map(r=>r.run).sort(),[false,true]);
  assert.equal((await callback(first.id,{...receipt,channel_id:'https://evil.test'})).status,400);
  assert.equal((await callback(first.id,receipt)).status,200);assert.equal(records.get(first.id)?.state,'slack_ready');
  assert.equal((await callback(first.id,receipt)).status,200);assert.equal((await callback(first.id,{...receipt,channel_id:'C9876543210'})).status,409);
  assert.deepEqual(await (await callback(first.id,{action:'claim'})).json(),{run:false});
  mode='timeout';const ambiguous=await draft();assert.equal((await start(ambiguous)).state,'uncertain');assert.equal(hooks,2);
  process.env.ONBOARDING_TRANSPORT='clickup';assert.equal((await start(ambiguous)).state,'uncertain');assert.equal((await reconcileOnboarding(actor,ambiguous.id)).state,'uncertain');assert.equal(hooks,2);assert.equal(clickupWrites,0);
  assert.deepEqual(await (await callback(ambiguous.id,{action:'claim'})).json(),{run:true});assert.equal((await callback(ambiguous.id,receipt)).status,200);
  process.env.ONBOARDING_TRANSPORT='zapier';mode='race';const fast=await draft();assert.equal((await start(fast)).state,'slack_ready');assert.equal(hooks,3);
  mode='legacy';const existing=await draft();assert.equal((await start(existing)).state,'existing');assert.equal(records.get(existing.id)?.transport,'clickup');assert.equal(hooks,3);assert.equal((await callback(existing.id,{action:'claim'})).status,409);
  assert.ok(!JSON.stringify(await reconcileOnboarding(actor,fast.id)).includes(String(payload.callback_token)));
  const p=automationPayload(fast);assert.equal(p.schema_version,1);assert.equal(p.channel_name,'elite-new-client');
 }finally{globalThis.fetch=original;for(const key of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SECRET_KEY','CLICKUP_API_KEY','ONBOARDING_TRANSPORT','ONBOARDING_CALLBACK_SECRET','ONBOARDING_ZAPIER_WEBHOOK_URL']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
