import './caller-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseIntake,emptyIntake,FIELDS,LIST_ID,SPACE_ID,taskPayload,marker} from '../src/lib/client-onboarding.ts';
const {ClickUpOnboarding}=await import('../src/services/onboarding-clickup.ts');
const {saveOnboarding,startOnboarding,reconcileOnboarding}=await import('../src/services/client-onboarding.ts');
const {GET,POST}=await import('../src/app/api/onboarding/route.ts');
const base={...emptyIntake(),company:'Acme Doors',name:'Client Example',email:'client@example.test'};
const actor='11111111-1111-4111-8111-111111111111';
test('intake validates identity, partner pairs and reference URLs',()=>{
 assert.equal(parseIntake({...base,email:' CLIENT@example.test '}).email,base.email);
 for(const patch of [{email:'bad'},{name:''},{partnerName:'Someone'},{partnerEmail:base.email,partnerName:'Copy'},{recording:'https://evil.test/x'},{transcript:'javascript:alert(1)'},{company:'x\nnew'},{email:'a@b.test\r\nBcc:x'}])assert.throws(()=>parseIntake({...base,...patch}));
 const p=taskPayload(base,randomUUID());assert.equal(p.custom_fields.length,2);assert.equal(p.custom_fields[0].id,FIELDS.email.id);assert.ok(!('parent'in p));assert.equal(p.check_required_custom_fields,true);
});
test('draft, duplicate click, ambiguity, recovery, existing clients and auth are isolated from real providers',async()=>{
 const original=globalThis.fetch;const old={...process.env};process.env.NEXT_PUBLIC_SUPABASE_URL='https://database.fixture.test';process.env.SUPABASE_SECRET_KEY='fixture-secret';process.env.CLICKUP_API_KEY='fixture-clickup';
 const records=new Map<string,any>(),tasks:any[]=[];let writes=0,mode='normal',role='admin',authCalls=0;
 const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
 globalThis.fetch=async(input:any,init:any={})=>{
  const u=new URL(typeof input==='string'?input:input.url??String(input)),method=init.method??'GET',body=init.body?JSON.parse(init.body):null;
  if(u.host==='database.fixture.test'){
   if(u.pathname==='/auth/v1/user'){authCalls++;return json({id:actor,email:'fixture@example.test',email_confirmed_at:new Date().toISOString()});}
   if(u.pathname.endsWith('/nbc_members'))return json({id:actor,display_name:'Fixture',role,status:'active'});
   assert.ok(u.pathname.endsWith('/nbc_client_onboardings'),u.pathname);
   const matches=[...records.values()].filter(r=>['id','revision','state'].every(k=>!u.searchParams.has(k)||String(r[k])===u.searchParams.get(k)!.slice(3)));
   if(method==='POST'){if(records.has(body.id)||[...records.values()].some(r=>r.intake.email===body.intake.email))return json({code:'23505'},409);const now=new Date().toISOString();const r={...body,state:'draft',revision:1,task_id:null,issue:null,created_at:now,updated_at:now};records.set(r.id,r);return json(r,201);}
   if(method==='PATCH'){if(!matches.length)return json(null);Object.assign(matches[0],body);return json({...matches[0]});}
   if(new Headers(init.headers).get('accept')?.includes('object')||u.searchParams.has('id'))return json(matches[0]??null);
   return json(matches);
  }
  assert.equal(u.host,'api.clickup.com');assert.equal(init.redirect,'error');
  if(u.pathname.endsWith('/field'))return json({fields:Object.values(FIELDS)});
  if(u.pathname===`/api/v2/list/${LIST_ID}`)return json({id:LIST_ID,space:{id:SPACE_ID},statuses:[{status:'pending '}]});
  if(method==='POST'){writes++;const task={id:'task'+writes,name:body.name,description:body.description,list:{id:LIST_ID},custom_fields:body.custom_fields};tasks.push(task);if(mode==='timeout')throw Error('network timeout after commit');return json(task);}
  if(u.pathname===`/api/v2/list/${LIST_ID}/task`)return json({tasks,last_page:true});
  const task=tasks.find(t=>u.pathname.endsWith('/task/'+t.id));assert.ok(task,'unexpected request '+u);return json(task);
 };
 try{
  const id=randomUUID();const draft=await saveOnboarding(actor,{id,intake:base});assert.equal(writes,0);
  await assert.rejects(()=>startOnboarding(actor,id,{confirmed:false,revision:1}));assert.equal(writes,0);
  await assert.rejects(()=>saveOnboarding(actor,{id,intake:{...base,name:'Changed'},revision:8}));
  const requests=await Promise.allSettled([startOnboarding(actor,id,{confirmed:true,revision:1}),startOnboarding(actor,id,{confirmed:true,revision:1})]);
  assert.equal(writes,1);assert.ok(requests.some(r=>r.status==='fulfilled'&&r.value.state==='queued'));
  assert.equal((await startOnboarding(actor,id,{confirmed:true,revision:1})).state,'queued');assert.equal(writes,1);
  await assert.rejects(()=>saveOnboarding(actor,{id:randomUUID(),intake:base}));
  const prior={...base,company:'Prior Business',email:'prior@example.test'};tasks.push({id:'prior',name:prior.company,list:{id:LIST_ID},custom_fields:[{id:FIELDS.email.id,value:prior.email}]});
  const duplicate=await saveOnboarding(actor,{id:randomUUID(),intake:prior});assert.equal((await startOnboarding(actor,duplicate.id,{confirmed:true,revision:1})).state,'existing');assert.equal(writes,1);
  const sameName=await saveOnboarding(actor,{id:randomUUID(),intake:{...prior,email:'other@example.test'}});await assert.rejects(()=>startOnboarding(actor,sameName.id,{confirmed:true,revision:1}),/channel name/);assert.equal(writes,1);
  const uncertain=await saveOnboarding(actor,{id:randomUUID(),intake:{...base,company:'Network Example',email:'network@example.test'}});mode='timeout';assert.equal((await startOnboarding(actor,uncertain.id,{confirmed:true,revision:1})).state,'uncertain');assert.equal(writes,2);
  mode='normal';assert.equal((await startOnboarding(actor,uncertain.id,{confirmed:true,revision:1})).state,'uncertain');assert.equal(writes,2);assert.equal((await reconcileOnboarding(actor,uncertain.id)).state,'queued');assert.equal(writes,2);assert.ok(tasks.some(t=>t.description===marker(uncertain.id)));
  const missing=await saveOnboarding(actor,{id:randomUUID(),intake:{...base,company:'Missing',email:'missing@example.test'}});Object.assign(records.get(missing.id),{state:'uncertain'});assert.equal((await reconcileOnboarding(actor,missing.id)).state,'uncertain');assert.equal(writes,2);
  const denied=await GET(new Request('https://portal.test/api/onboarding'));assert.equal(denied.status,401);assert.equal(authCalls,0);
  for(role of ['student','coach']){const r=await GET(new Request('https://portal.test/api/onboarding',{headers:{Authorization:'Bearer fixture'}}));assert.equal(r.status,403);const write=await POST(new Request('https://portal.test/api/onboarding',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),intake:base})}));assert.equal(write.status,403);}
  role='admin';const allowed=await GET(new Request('https://portal.test/api/onboarding',{headers:{Authorization:'Bearer fixture'}}));assert.equal(allowed.status,200);assert.equal((await allowed.json()).connected,true);assert.equal(writes,2);
 }finally{globalThis.fetch=original;for(const k of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SECRET_KEY','CLICKUP_API_KEY']){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
