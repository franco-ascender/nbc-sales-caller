import './caller-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {verifyRunPhone}=await import('../src/services/run-verification.service.ts');
test('verification reserves before POST and does not repeat an ambiguous charge (HTTP fixtures)',async()=>{
 const original=globalThis.fetch,saved={...process.env};
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://verify-fixture.supabase.co',SUPABASE_SECRET_KEY:'fixture',BATCHDATA_API_KEY:'fixture'});
 const owner='11111111-1111-4111-8111-111111111111';
 let price=false,paid=0,ambiguous=false;
 const checks:Array<{phone10:string;state:string;verification?:unknown}>=[];
 const base={name:'Example',city:'Miami',state:'FL',phone10:'3055551234',duplicate:false,rejection:null,chain:null};
 const rows=[{...base,phone10:null},{...base,phone10:'8005551234'},base];
 globalThis.fetch=async(input,init)=>{
  const u=new URL(String(input));
  if(u.hostname==='verify-fixture.supabase.co'){
   if(u.pathname.endsWith('/nbc_pilot_rounds'))return Response.json(u.searchParams.get('owner_id')==='eq.'+owner?[{settings:{verification:price?{provider:'batchdata',unitCents:1,confirmedAt:new Date().toISOString()}:null}}]:[]);
   if(u.pathname.endsWith('/nbc_pilot_operations'))return Response.json([{state:'completed',result:{rows}}]);
   if(u.pathname.endsWith('/nbc_pilot_phone_checks'))return Response.json(checks);
   const body=JSON.parse(String(init?.body));
   if(u.pathname.endsWith('/nbc_pilot_claim_phone_batch')){assert.deepEqual(body.p_phones,[base.phone10]);if(checks.some(c=>c.phone10===base.phone10))return Response.json({acquired:false});checks.push({phone10:base.phone10,state:'dispatching'});return Response.json({acquired:true,phones:[base.phone10]});}
   if(u.pathname.endsWith('/nbc_pilot_finish_phone')){const c=checks.find(c=>c.phone10===body.p_phone)!;c.state=body.p_verification?'completed':'uncertain';c.verification=body.p_verification;return Response.json(null);}
  }
  if(u.hostname==='api.batchdata.com'){
   assert.equal(checks[0].state,'dispatching');assert.deepEqual(JSON.parse(String(init?.body)),{requests:[base.phone10]});paid++;
   if(ambiguous)throw Error('Lost response');
   return Response.json({results:{phoneNumbers:[{number:base.phone10,type:'Mobile',dnc:false,tcpa:false,reachable:true}]}});
  }
  throw Error('Unexpected fixture endpoint');
 };
 try{
  await assert.rejects(verifyRunPhone(owner,'roofing-miami'),/confirmed account rate/);assert.equal(paid,0);assert.equal(checks.length,0);
  price=true;await assert.rejects(verifyRunPhone('wrong-owner','roofing-miami'),/not assigned/);assert.equal(paid,0);
  await Promise.all([verifyRunPhone(owner,'roofing-miami'),verifyRunPhone(owner,'roofing-miami')]);assert.equal(paid,1);assert.equal(checks[0].state,'completed');
  await verifyRunPhone(owner,'roofing-miami');assert.equal(paid,1);
  checks.length=0;ambiguous=true;await assert.rejects(verifyRunPhone(owner,'roofing-miami'),/unresolved reservations/);assert.equal(checks[0].state,'uncertain');const previous=paid;
  await verifyRunPhone(owner,'roofing-miami');assert.equal(paid,previous);
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
test('23 phones use three provider requests; a lost receipt preserves saved results and holds the rest',async()=>{
 const original=globalThis.fetch,saved={...process.env};
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://batch-fixture.supabase.co',SUPABASE_SECRET_KEY:'fixture',BATCHDATA_API_KEY:'fixture'});
 const rows=Array.from({length:23},(_,i)=>({name:'Example',phone10:`305555${String(1200+i)}`,rejection:null,chain:null,duplicate:false}));
 const checks:Array<{phone10:string;state:string;verification?:unknown}>=[];const batches:number[]=[];let failSave=false;
 globalThis.fetch=async(input,init)=>{
  const u=new URL(String(input));
  if(u.hostname==='batch-fixture.supabase.co'){
   if(u.pathname.endsWith('/nbc_pilot_rounds'))return Response.json([{settings:{verification:{provider:'batchdata',unitCents:1,confirmedAt:new Date().toISOString()}}}]);
   if(u.pathname.endsWith('/nbc_pilot_operations'))return Response.json([{state:'completed',result:{rows}}]);
   if(u.pathname.endsWith('/nbc_pilot_phone_checks'))return Response.json(checks);
   const b=JSON.parse(String(init?.body));
   if(u.pathname.endsWith('/nbc_pilot_claim_phone_batch')){if(checks.some(c=>c.state!=='completed'))return Response.json({message:'pilot_operation_pending'},{status:400});const phones=b.p_phones.filter((p:string)=>!checks.some(c=>c.phone10===p));checks.push(...phones.map((phone10:string)=>({phone10,state:'dispatching'})));return Response.json({acquired:phones.length>0,phones});}
   if(u.pathname.endsWith('/nbc_pilot_finish_phone')){if(failSave&&b.p_phone===rows[1].phone10&&b.p_verification)return Response.json({message:'Fixture save failed'},{status:400});const c=checks.find(c=>c.phone10===b.p_phone)!;c.state=b.p_verification?'completed':'uncertain';c.verification=b.p_verification;return Response.json(null);}
  }
  if(u.hostname==='api.batchdata.com'){const phones=JSON.parse(String(init?.body)).requests as string[];batches.push(phones.length);assert.ok(phones.length<=10);assert.ok(phones.every(p=>checks.find(c=>c.phone10===p)?.state==='dispatching'));return Response.json({results:{phoneNumbers:phones.toReversed().map(number=>({number,type:'Land Line',reachable:true,dnc:false,tcpa:false}))}});}
  throw Error('Unexpected fixture endpoint');
 };
 try{
  for(let i=0;i<4;i++)await verifyRunPhone('owner','roofing-miami');
  assert.deepEqual(batches,[10,10,3]);assert.equal(checks.filter(c=>c.state==='completed').length,23);
  checks.length=0;failSave=true;
  await assert.rejects(verifyRunPhone('owner','roofing-miami'),/unresolved reservations/);
  assert.equal(checks[0].state,'completed');assert.equal(checks.filter(c=>c.state==='uncertain').length,9);
  await assert.rejects(verifyRunPhone('owner','roofing-miami'),/reconciliation/);assert.deepEqual(batches,[10,10,3,10]);
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
