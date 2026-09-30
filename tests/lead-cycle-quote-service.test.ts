import './caller-test-loader.mjs';import test from 'node:test';import assert from 'node:assert/strict';
const {quoteSearch,verifySearchQuote}=await import('../src/services/lead-cycle-quote.service.ts');
test('quote only reads live account pricing; approval binds user, market, volume, price and signature',async()=>{
 const original=fetch,saved={...process.env};Object.assign(process.env,{APIFY_API_TOKEN:'fixture',BATCHDATA_API_KEY:'fixture',SUPABASE_SECRET_KEY:'fixture-signing-key',NEXT_PUBLIC_SUPABASE_URL:'https://quote.supabase.co'});const requests:string[]=[];
 globalThis.fetch=async(input,init)=>{assert.equal(init?.method??'GET','GET','quotes must not spend');const u=new URL(String(input));requests.push(u.pathname);
 if(u.hostname==='quote.supabase.co')return Response.json([{settings:{verification:{provider:'batchdata',unitCents:1,confirmedAt:new Date().toISOString()}}}]);
 if(u.pathname.endsWith('/nwua9Gu5YrADL7ZDj'))return Response.json({data:{pricingInfos:[{startedAt:'2020-01-01',pricingModel:'PAY_PER_EVENT',minimalMaxTotalChargeUsd:.5,pricingPerEvent:{actorChargeEvents:{'place-scraped':{eventPriceUsd:.004},'apify-actor-start':{eventPriceUsd:.00005}}}}]}});
 if(u.pathname.endsWith('/limits'))return Response.json({data:{limits:{maxMonthlyUsageUsd:100},current:{monthlyUsageUsd:0,activeActorJobCount:0}}});
 return Response.json({data:{plan:{id:'FREE',dataRetentionDays:7,planPricing:{chargeableServiceUnitPricesUsd:{DATASET_READS:.0000004,DATA_TRANSFER_EXTERNAL_GBYTES:.2,DATASET_TIMED_STORAGE_GBYTE_HOURS:.001}}}}});};
 try{const input={requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Roofing US',industry:'roofing',city:'',state:'',count:5000};const quote=await quoteSearch('owner',input);assert.equal(requests.length,4);const approved={...input,quoteToken:quote.token,approvedMaxCents:quote.maximumCents};assert.equal(verifySearchQuote('owner',approved).maximumCents,quote.maximumCents);for(const [owner,body] of [['other',approved],['owner',{...approved,count:50}],['owner',{...approved,state:'FL'}],['owner',{...approved,approvedMaxCents:1}],['owner',{...approved,quoteToken:quote.token+'x'}]] as const)assert.throws(()=>verifySearchQuote(owner,body),/fresh estimate/);}
 finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});

test('saved phone checks are read beyond the database default 1,000-row page',async()=>{
 const {readPilotChecks}=await import('../src/services/lead-cycle-checks.ts');let pages=0;
 const db={from:()=>({select:()=>({eq:()=>({order:()=>({range:async(from:number,to:number)=>{pages++;assert.equal(to-from,999);return {data:Array.from({length:Math.min(1000,2505-from)},(_,i)=>({phone10:String(from+i),state:'completed',verification:null,reserved_cents:1})),error:null};}})})})})};
 const rows=await readPilotChecks(db as never);assert.equal(rows.length,2505);assert.equal(pages,3);assert.equal(rows[2504].phone10,'2504');
});
