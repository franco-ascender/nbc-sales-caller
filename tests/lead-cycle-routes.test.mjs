import './caller-test-loader.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
const routes=await import('../src/app/api/lead-engine/runs/route.ts');
test('full-cycle API: replay, serialized advances, missing rate, completion and ambiguous check (HTTP fixtures only)',async()=>{
 const saved={...process.env},original=fetch;
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://cycle-fixture.supabase.co',SUPABASE_SECRET_KEY:'fixture',APIFY_API_TOKEN:'fixture',BATCHDATA_API_KEY:'fixture'});
 const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',round='2026-09-25-first-live-tests';
 const slots=[],operations=[],runs=[],checks=[];let price=false,searches=0,paidChecks=0,uncertain=false;
 const key='list-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const body={action:'create',requestId:key.slice(5),name:'Fixture clinics',industry:'chiropractor',city:'Miami',state:'FL',count:25,confirmed:true};
 const request=(body,token='owner')=>new Request('https://fixture.test/api/lead-engine/runs',{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const send=async body=>{const r=await routes.POST(request(body));assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return r.json();};
 const json=(value,status=200)=>Response.json(value,{status});
 globalThis.fetch=async(input,init)=>{
  const u=new URL(String(input)),method=init?.method??'GET';
  if(u.hostname==='cycle-fixture.supabase.co'){
   if(u.pathname==='/auth/v1/user')return json({id:new Headers(init?.headers).get('authorization')==='Bearer other'?other:owner,email:'fixture@example.test',email_confirmed_at:new Date().toISOString()});
   if(u.pathname.endsWith('/nbc_members'))return json([{id:owner,role:'admin',status:'active',display_name:'Fixture'}]);
   if(u.pathname.endsWith('/nbc_pilot_rounds'))return json(u.searchParams.get('owner_id')==='eq.'+owner?[{id:round,owner_id:owner,cap_cents:2500,paused:false,settings:{destination:'+13055550123',verification:price?{provider:'batchdata',unitCents:1,confirmedAt:new Date().toISOString()}:null}}]:[]);
   if(u.pathname.endsWith('/nbc_pilot_slots'))return json(slots);
   if(u.pathname.endsWith('/nbc_pilot_operations'))return json(operations);
   if(u.pathname.endsWith('/nbc_lead_cycles'))return json(runs);
   if(u.pathname.endsWith('/nbc_pilot_phone_checks'))return json(checks);
   const b=JSON.parse(String(init?.body));assert.equal(b.p_owner,owner);
   if(u.pathname.endsWith('/nbc_lead_cycle_create')){if(!runs.length){const d=b.p_input;slots.push({key,kind:'scrape',title:d.name,reserve_cents:75,allocation_cents:325,config:{...d,location:'Miami, FL, USA'}});runs.push({key,...d,status:'running',phase:'discover',started_at:new Date().toISOString(),phase_started_at:new Date().toISOString(),finished_at:null,events:[]});}return json(key);}
   if(u.pathname.endsWith('/nbc_lead_cycle_claim')){const r=runs[0];if(r.lease||r.status!=='running')return json(false);r.lease=b.p_lease;return json(true);}
   if(u.pathname.endsWith('/nbc_lead_cycle_finish')){const r=runs[0];assert.equal(r.lease,b.p_lease);r.status=r.status==='paused'?'paused':b.p_status;r.phase=b.p_phase;r.message=b.p_message;r.lease=null;return json(null);}
   if(u.pathname.endsWith('/nbc_lead_cycle_control')){runs[0].status=b.p_action==='pause'?'paused':'running';return json(null);}
   if(u.pathname.endsWith('/nbc_pilot_reserve')){if(operations.length)return json({acquired:false,operation:operations[0]});const o={key,state:'dispatching',reserved_cents:75,reported_microusd:null,version:0,result:{},provider:{}};operations.push(o);return json({acquired:true,operation:o});}
   if(u.pathname.endsWith('/nbc_pilot_observe')){Object.assign(operations[0],{state:b.p_state,result:b.p_result,provider:b.p_provider,version:operations[0].version+1,reported_microusd:b.p_reported??null});return json(operations[0]);}
   if(u.pathname.endsWith('/nbc_pilot_claim_phone_batch')){const phones=b.p_phones.filter(p=>!checks.some(c=>c.phone10===p));if(!phones.length)return json({acquired:false});checks.push(...phones.map(phone10=>({phone10,state:'dispatching',reserved_cents:1,verification:null})));return json({acquired:true,phones});}
   if(u.pathname.endsWith('/nbc_pilot_finish_phone')){const c=checks.find(c=>c.phone10===b.p_phone);c.verification=b.p_verification;c.state=b.p_verification?'completed':'uncertain';return json(null);}
  }
  if(u.hostname==='api.apify.com'){
   if(u.pathname.endsWith('/users/me/limits'))return json({data:{limits:{maxMonthlyUsageUsd:25},current:{monthlyUsageUsd:0,activeActorJobCount:0}}});
   if(u.pathname.endsWith('/users/me'))return json({data:{plan:{id:'free'}}});
   if(u.pathname.endsWith('/acts/nwua9Gu5YrADL7ZDj'))return json({data:{pricingInfos:[{startedAt:'2020-01-01',pricingModel:'PAY_PER_EVENT',minimalMaxTotalChargeUsd:.5,pricingPerEvent:{actorChargeEvents:{'place-scraped':{eventPriceUsd:.004}}}}]}});
   if(method==='POST'){assert.equal(operations[0].state,'dispatching');searches++;}
   if(u.pathname.includes('/datasets/'))return json(Array.from({length:30},()=>({title:'Fixture Chiropractic',city:'Miami',state:'Florida',countryCode:'US',phoneUnformatted:'+13055551234',url:'https://www.google.com/maps?cid=123',categoryName:'Chiropractor',permanentlyClosed:false,temporarilyClosed:false})));
   return json({data:{id:'FixtureRun1234567',defaultDatasetId:'FixtureData123456',actId:'nwua9Gu5YrADL7ZDj',buildNumber:'0.14.757',status:method==='POST'?'RUNNING':'SUCCEEDED',usageTotalUsd:.004}});
  }
  if(u.hostname==='npiregistry.cms.hhs.gov')return json({results:[]});
  if(u.hostname==='api.batchdata.com'){paidChecks++;assert.equal(checks[0].state,'dispatching');if(uncertain)throw Error('Fixture connection lost');return json({results:{phoneNumbers:[{number:'3055551234',type:'Mobile',dnc:false,tcpa:false,reachable:true}]}});}
  throw Error('Unexpected endpoint '+method+' '+u.hostname+u.pathname);
 };
 try{
  assert.equal((await routes.GET(request(undefined,null))).status,401);assert.equal((await routes.GET(request(undefined,'other'))).status,403);
  assert.equal((await routes.POST(request({...body,confirmed:false}))).status,400);
  assert.equal((await routes.POST(request({...body,city:'',state:'',count:5000}))).status,409);assert.equal(searches,0);assert.equal(runs.length,0);
  await send(body);await send(body);assert.equal(runs.length,1);assert.equal(searches,0);
  await Promise.all([send({action:'advance',key}),send({action:'advance',key})]);assert.equal(searches,1);
  for(let i=0;i<6&&runs[0].status==='running';i++)await send({action:'advance',key});
  assert.equal(runs[0].status,'waiting_rate');assert.equal(paidChecks,0);assert.equal(operations[0].result.rows.length,25);assert.equal(operations[0].result.rawBusinesses,30);
  await send({action:'advance',key});assert.equal(paidChecks,0);
  price=true;await send({action:'resume',key,confirmed:true});
  for(let i=0;i<5&&runs[0].status==='running';i++)await send({action:'advance',key});
  assert.equal(runs[0].status,'completed');assert.equal(searches,1);assert.equal(paidChecks,1);assert.equal(checks[0].state,'completed');
  const read=await routes.GET(request());assert.equal(read.status,200);assert.equal(paidChecks,1);
  checks.length=0;runs[0].phase='verify';runs[0].status='running';uncertain=true;
  await send({action:'advance',key});assert.equal(runs[0].status,'needs_attention');assert.equal(checks[0].state,'uncertain');
  await send({action:'resume',key,confirmed:true});await send({action:'advance',key});assert.equal(paidChecks,2);assert.equal(runs[0].status,'needs_attention');
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
