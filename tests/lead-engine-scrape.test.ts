import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { parseDiscoveryCandidate,parseScrapeInput,parseResearchQuery } from '../src/lib/lead-engine-scrape.ts';
import { LeadEngineError } from '../src/lib/lead-engine-storage.ts';
import { createLeadDatasetReader } from '../src/services/lead-engine-dataset.ts';
import { createLeadResearchStore } from '../src/services/lead-engine-scrape-store.ts';
import type { LeadResearchStore } from '../src/services/lead-engine-scrape-store.ts';
import { leadResearchHandler } from '../src/services/lead-engine-scrape-http.ts';
import type { ResearchAction } from '../src/services/lead-engine-scrape-http.ts';
const id='aaaaaaaa-aaaa-4aaa-8aaa-000000000001',owner='bbbbbbbb-bbbb-4bbb-8bbb-000000000001';
const input={version:1,quoteId:id,planId:id,folderId:null,name:'Roofing pilot',count:50};
const plan={industry:'Roofing',metro:'Charlotte, NC',target:50,hardBudgetCents:1000,exclusions:[]};
const fixture={title:'Example Roofing',city:'Charlotte',state:'North Carolina',countryCode:'US',phoneUnformatted:'+12025550123',placeId:'synthetic-place',
  url:'https://www.google.com/maps?cid=123',website:'https://example.com',categoryName:'Roofing contractor',permanentlyClosed:false,temporarilyClosed:false};
test('quotes reject client price, approval, account/owner flags, invalid counts and unexpected fields',()=>{
  assert.equal(parseScrapeInput(input).count,50);
  for(const patch of [{maxCostCents:1},{approved:true},{operatorId:owner},{count:'50'},{count:0},{count:301},{count:1.5},{folderId:'other'},{name:'\n'},{version:2}])assert.throws(()=>parseScrapeInput({...input,...patch}));
  for(const query of ['?offset=-1','?offset=0&offset=1','?folder=bad','?approved=true'])assert.throws(()=>parseResearchQuery(`http://local/lists${query}`,true));
  assert.deepEqual(parseResearchQuery('http://local/lists?offset=20&folder=unfiled',true),{offset:20,folder:'unfiled'});
});
test('published business parser keeps owner and phone verification unconfirmed and rejects incomplete/off-target sources',()=>{
  const parsed=parseDiscoveryCandidate(fixture,plan);assert.equal(parsed.rejection,null);assert.equal(parsed.phone10,'2025550123');assert.equal(parsed.state,'NC');
  assert.equal('owner' in parsed,false);assert.equal('lineType' in parsed,false);
  for(const patch of [{permanentlyClosed:undefined},{temporarilyClosed:true},{countryCode:'CA'},{phoneUnformatted:'bad'},{url:'javascript:alert(1)'},{state:'Florida'},
    {title:'Example Restaurant',categoryName:'Restaurant'}])assert.ok(parseDiscoveryCandidate({...fixture,...patch},plan).rejection);
  assert.equal(parseDiscoveryCandidate(fixture,{...plan,exclusions:['example']}).rejection,'operator_exclusion');
  assert.equal(parseDiscoveryCandidate({...fixture,website:'https://user:pass@example.com'},plan).website,null);
  assert.ok(parseDiscoveryCandidate(null,plan).rejection);
});
function page(rows:unknown[],offset=0,total=rows.length){return Response.json(rows,{headers:{'x-apify-pagination-offset':String(offset),'x-apify-pagination-count':String(rows.length),'x-apify-pagination-total':String(total)}});}
test('dataset reader validates fixed origin, private token, stable raw pagination and empty completion',async()=>{
  const calls:string[]=[];
  const read=createLeadDatasetReader('synthetic',async(url,options)=>{calls.push(String(url));assert.equal(options?.redirect,'error');assert.equal(options?.cache,'no-store');assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer synthetic');return page([fixture]);});
  assert.equal((await read('DatasetSynthetic1',0,50)).rows.length,1);
  const url=new URL(calls[0]);assert.equal(url.origin,'https://api.apify.com');assert.equal(url.searchParams.get('clean'),'false');assert.equal(url.searchParams.get('limit'),'50');assert.equal(url.searchParams.has('token'),false);
  assert.deepEqual(await createLeadDatasetReader('synthetic',async()=>page([],0,0))('DatasetSynthetic1',0,50),{offset:0,total:0,rows:[]});
});
test('dataset malformed pages, overshoot, wrong cursor, missing headers and HTTP failures preserve existing cursor',async()=>{
  for(const response of [page([fixture],1,1),page([fixture],0,301),page([],0,1),Response.json([fixture]),new Response('private',{status:401}),new Response('x'.repeat(2097153))]){
    let calls=0;await assert.rejects(createLeadDatasetReader('synthetic',async()=>{calls++;return response;})('DatasetSynthetic1',0,50));assert.equal(calls,1);
  }
  let calls=0;await assert.rejects(createLeadDatasetReader('synthetic',async()=>{calls++;return page([]);})('../other',0,50));assert.equal(calls,0);
});
const request=(body:unknown={})=>new Request('http://local/api/lead-engine/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function dependencies(){
  const events:string[]=[];
  const store:LeadResearchStore={
    folders:async()=>[],createFolder:async(_op,id,name)=>({id,name}),
    quote:async()=>{events.push('quote');return {id,planId:id,folderId:null,name:'Roofing',maxResults:50,minCostCents:25,maxCostCents:100,expiresAt:'2099-01-01T00:00:00Z',blockers:[],scope:'discovery_only'};},
    approve:async()=>{events.push('approve');return id;},lists:async()=>({lists:[],nextOffset:null}),
    get:async()=>{events.push('get');return {list:{id,name:'Roofing',planId:id,folderId:null,status:'running',importStatus:'waiting',processed:0,maxResults:50,reservedCents:100,consumedCents:0,createdAt:'2026-09-15T00:00:00Z'},records:[],nextOffset:null};},
    move:async()=>{events.push('move');},ingest:async()=>{},
  };
  const deps={authorize:async()=>owner,readBody:(req:Request)=>req.json(),store:()=>store,ready:()=>true,start:async()=>{events.push('start');},sync:async()=>store.get(owner,id,0)};
  return {events,store,deps};
}
test('all research actions authenticate before parsing, storage, pricing or provider access',async()=>{
  const f=dependencies();f.deps.authorize=async()=>{throw new LeadEngineError(401,'auth','Sign in');};
  f.deps.store=()=>{throw Error('must not access');};
  for(const action of ['folders','createFolder','quote','approve','lists','get','sync','move'] as ResearchAction[]){const response=await leadResearchHandler(f.deps)(action,request(),id);assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');}
  assert.deepEqual(f.events,[]);
});
test('cost review never approves, reserves or starts; missing account blocks confirmation',async()=>{
  const f=dependencies();f.deps.ready=()=>false;const handler=leadResearchHandler(f.deps);
  const response=await handler('quote',request(input));assert.equal(response.status,200);assert.equal((await response.json()).quote.maxCostCents,100);assert.deepEqual(f.events,['quote']);
  assert.equal((await handler('approve',request(),id)).status,503);assert.deepEqual(f.events,['quote']);
});
test('approval uses only immutable quote identity, records approval before start and rejects client override',async()=>{
  const f=dependencies(),handler=leadResearchHandler(f.deps);
  assert.equal((await handler('approve',request({approved:true,maxCostCents:1}),id)).status,400);assert.deepEqual(f.events,[]);
  assert.equal((await handler('approve',request(),id)).status,200);assert.deepEqual(f.events,['approve','start','get']);
});
test('expired quotes, changed budget and provider failure cannot be presented as successful scraping',async()=>{
  for(const code of ['quote_expired','hard_budget_exceeded']){
    const f=dependencies();f.store.approve=async()=>{throw new LeadEngineError(409,code,'Approval refused');};assert.equal((await leadResearchHandler(f.deps)('approve',request(),id)).status,409);assert.deepEqual(f.events,[]);
  }
  const f=dependencies();f.deps.start=async()=>{throw Error('private-provider-details');};const response=await leadResearchHandler(f.deps)('approve',request(),id);assert.equal(response.status,503);assert.equal((await response.text()).includes('private-provider-details'),false);
});
test('folder and list endpoints reject malformed ownership/destination without mutations',async()=>{
  const f=dependencies(),handler=leadResearchHandler(f.deps);
  assert.equal((await handler('move',request({folderId:null,operatorId:owner}),id)).status,400);
  assert.equal((await handler('createFolder',request({id,name:'\n'}))).status,400);
  assert.equal((await handler('move',request({folderId:null}),id)).status,200);assert.deepEqual(f.events,['move']);
});
test('SDK quote sends no client pricing; pricing_pending remains a dependency with zero provider call',async()=>{
  const calls:Array<{url:URL;body:Record<string,unknown>}>=[];
  const db=createClient('http://127.0.0.1:1','synthetic',{auth:{persistSession:false},global:{fetch:async(url,init)=>{calls.push({url:new URL(String(url)),body:JSON.parse(String(init?.body))});return Response.json({code:'P0001',message:'pricing_pending'},{status:400});}}});
  await assert.rejects(createLeadResearchStore(db).quote(owner,parseScrapeInput(input)),{code:'pricing_pending',status:503});
  assert.equal(calls.length,1);assert.equal(calls[0].url.pathname,'/rest/v1/rpc/lead_engine_quote');
  assert.deepEqual(calls[0].body,{p_operator:owner,p_id:id,p_plan:id,p_folder:null,p_name:'Roofing pilot',p_count:50});
});
