import test from 'node:test';import assert from 'node:assert/strict';
import {priceSearch} from '../src/lib/lead-cycle-quote.ts';
import {readSearchPage} from '../src/services/lead-cycle-dataset.ts';
import {runEvidenceCsv,runEvidenceRows} from '../src/lib/run-review.ts';
import {writeWorkbook,readWorkbook} from '../src/lib/lead-engine-xlsx.ts';
const rates={placeMicrousd:4000,startMicrousd:200,minimumCapCents:50,readMicrousd:.4,transferUsdPerGb:.2,storageUsdPerGbHour:.001,retentionHours:168,availableCents:10000,activeRuns:0,verificationUnitCents:1,checkedAt:new Date().toISOString()};
test('quote includes start fee, account unit rate, verification and bounded delivery without calling minimum cap an actual charge',()=>{
 const q=priceSearch(50,rates);assert.equal(q.discoveryEstimateCents,21);assert.equal(q.discoveryCapCents,50);assert.equal(q.verificationMaxCents,50);assert.equal(q.maximumCents,101);assert.equal(q.estimatedTotalCents,72);
 const big=priceSearch(5000,rates);assert.equal(big.discoveryEstimateCents,2001);assert.equal(big.verificationMaxCents,5000);assert.ok(big.maximumCents>=7002);assert.deepEqual(big.blockers,[]);
 assert.ok(priceSearch(5000,{...rates,availableCents:239}).blockers.length);assert.throws(()=>priceSearch(5001,rates));assert.throws(()=>priceSearch(100,{...rates,verificationUnitCents:0}));
});
test('result ingestion handles >50 through bounded pages and never reads beyond approved count',async()=>{
 const calls:string[]=[];let output=0;
 const mock:typeof fetch=async url=>{const u=new URL(String(url));calls.push(u.href);const offset=Number(u.searchParams.get('offset')),limit=Number(u.searchParams.get('limit'));assert.ok(limit<=200);const rows=Array.from({length:Math.min(limit,550-offset)},(_,i)=>({title:'Business '+(offset+i)}));return new Response(JSON.stringify(rows),{headers:{'x-apify-pagination-offset':String(offset),'x-apify-pagination-count':String(rows.length),'x-apify-pagination-total':'550'}});};
 while(output<501){const page=await readSearchPage('fixture','DatasetFixture123',output,501,mock);output=page.nextOffset;}
 assert.equal(output,501);assert.equal(calls.length,3);assert.match(calls[2],/limit=101/);
 await assert.rejects(()=>readSearchPage('fixture','DatasetFixture123',0,501,async()=>new Response('[]',{headers:{'x-apify-pagination-offset':'0','x-apify-pagination-count':'0','x-apify-pagination-total':'501'}})));
});
test('CSV and Excel keep the same evidence and spreadsheet-like text remains text',()=>{
 const result={rows:[{name:'=EVIL()',city:'Miami',state:'FL',website:null,sourceUrl:null,phone10:'3055551234',rejection:null,duplicate:false,chain:null}]};
 const rows=runEvidenceRows(result),csv=runEvidenceCsv(result),xlsx=writeWorkbook([{name:'Contacts',rows:rows.map(r=>r.map(v=>v??null))}]);
 assert.match(csv,/'=EVIL/);assert.ok(xlsx.byteLength>100);const workbook=readWorkbook(xlsx);assert.ok(workbook);assert.equal(rows.length,2);
});
