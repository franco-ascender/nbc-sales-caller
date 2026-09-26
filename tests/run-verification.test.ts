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
   if(u.pathname.endsWith('/nbc_pilot_claim_phone')){assert.equal(body.p_phone,base.phone10);if(checks.some(c=>c.phone10===body.p_phone))return Response.json({acquired:false});checks.push({phone10:body.p_phone,state:'dispatching'});return Response.json({acquired:true});}
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
  checks.length=0;ambiguous=true;await assert.rejects(verifyRunPhone(owner,'roofing-miami'),/reservation is retained/);assert.equal(checks[0].state,'uncertain');const previous=paid;
  await verifyRunPhone(owner,'roofing-miami');assert.equal(paid,previous);
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
