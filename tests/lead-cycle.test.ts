import test from 'node:test';import assert from 'node:assert/strict';
import {parseCycleInput,cyclePresentation,type LeadCycle} from '../src/lib/lead-cycle.ts';
import type {PilotSlotView} from '../src/lib/live-pilot.ts';
const input={action:'create',requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Miami clinics',industry:'chiropractor',city:'Miami',state:'FL',count:25,confirmed:true};
test('list input is bounded, explicit and rejects provider or budget overrides',()=>{
 assert.equal(parseCycleInput(input).count,25);
 for(const b of [{...input,confirmed:false},{...input,count:5001},{...input,count:0},{...input,state:'XX'},{...input,city:'Miami\nOther'},{...input,budget:5000},{...input,provider:'outscraper'}])assert.throws(()=>parseCycleInput(b));
});
test('progress uses saved stages/checks, freezes on completion and never promises an expired zero countdown',()=>{
 const now=Date.now();const run:LeadCycle={key:'list-'+input.requestId,name:'Fixture',industry:'chiropractor',city:'Miami',state:'FL',count:25,status:'running',phase:'discover',message:null,started_at:new Date(now-600000).toISOString(),phase_started_at:new Date(now-30000).toISOString(),finished_at:null,events:[]};
 assert.match(cyclePresentation(run,undefined,now).eta,/Taking longer/);
 assert.ok(cyclePresentation(run,undefined,now).percent<100);
 run.status='waiting_rate';assert.match(cyclePresentation(run,undefined,now).eta,/paused/);
 run.status='running';run.phase='verify';
 const row={name:'Fixture',city:'Miami',state:'FL',phone10:'3055551234',website:null,sourceUrl:null,rejection:null,duplicate:false,chain:null};
 const slot:PilotSlotView={key:run.key,kind:'scrape',title:'Fixture',state:'completed',allocationCents:100,reserveCents:75,count:25,reportedMicrousd:null,result:{rows:[row,{...row,phone10:'3055551235'}],phoneChecks:[{phone10:'3055551234',state:'completed',verification:{phone10:'3055551234',lineType:'Mobile',dnc:false,tcpa:false,reachable:true,verifiedAt:new Date(now-1000).toISOString()}}]}};
 const view=cyclePresentation(run,slot,now);assert.equal(view.counts.checked,1);assert.equal(view.counts.remaining,1);assert.equal(view.counts.qualified,1);assert.equal(view.percent,72);
 run.status='completed';run.phase='done';run.finished_at=new Date(now).toISOString();assert.equal(cyclePresentation(run,slot,now+999999).elapsed,600);assert.equal(cyclePresentation(run,slot,now).percent,100);
});
test('all 36 catalog niches and the legacy medspa ID are accepted with explicit search terms',async()=>{
 const {CYCLE_NICHES,cycleNiche}=await import('../src/lib/lead-cycle-niches.ts');
 assert.equal(CYCLE_NICHES.length,36);assert.equal(new Set(CYCLE_NICHES.map(n=>n.id)).size,36);
 for(const niche of CYCLE_NICHES){assert.equal(parseCycleInput({...input,industry:niche.id}).industry,niche.id);assert.ok(niche.searchTerm?.length);assert.ok(!niche.searchTerm.includes('_'));}
 assert.equal(cycleNiche('medspa')?.searchTerm,'med spa');assert.equal(parseCycleInput({...input,industry:'medspa'}).industry,'medspa');assert.throws(()=>parseCycleInput({...input,industry:'invented_niche'}));
});

test('optional geography and large-list plans retain a separate execution gate',async()=>{
 const {assertCycleExecutable,cycleVolumePlan}=await import('../src/lib/lead-cycle.ts');
 const national=parseCycleInput({...input,city:undefined,state:undefined,count:50});assert.equal(national.city,'');assert.equal(national.state,'');
 assert.equal(parseCycleInput({...input,city:'',state:'tx'}).state,'TX');assert.throws(()=>parseCycleInput({...input,state:''}));
 assert.equal(parseCycleInput({...input,city:'',state:'',count:5000}).count,5000);
 assert.equal(cycleVolumePlan(5000).length,100);assert.deepEqual(cycleVolumePlan(51),[50,1]);assert.throws(()=>assertCycleExecutable(51),/Testing limit/);assert.doesNotThrow(()=>assertCycleExecutable(50));
});
test('nationwide filtering accepts multiple US states without dropping the country guard',async()=>{
 const {parseDiscoveryCandidate}=await import('../src/lib/lead-engine-scrape.ts');
 const plan={industry:'roofing',metro:'United States',target:50,hardBudgetCents:125,exclusions:[]};
 const row={title:'Fixture Roofing',city:'Miami',state:'FL',countryCode:'US',phoneUnformatted:'3055551234',url:'https://www.google.com/maps?cid=1',categoryName:'Roofing contractor',permanentlyClosed:false,temporarilyClosed:false};
 assert.equal(parseDiscoveryCandidate(row,plan,'nationwide').rejection,null);
 assert.equal(parseDiscoveryCandidate({...row,city:'Austin',state:'TX'},plan,'nationwide').rejection,null);
 assert.equal(parseDiscoveryCandidate({...row,countryCode:'CA'},plan,'nationwide').rejection,'incomplete_source');
 assert.equal(parseDiscoveryCandidate({...row,state:'TX'},{...plan,metro:', FL'}).rejection,'outside_requested_state');
});

test('Garage Doors search uses the existing trade filter',async()=>{
 const {cycleNiche}=await import('../src/lib/lead-cycle-niches.ts');
 const {classifyRelevance}=await import('../src/lib/lead-engine-industries.ts');
 const niche=cycleNiche('garage_doors')!;assert.equal(niche.title,'Garage Doors');assert.equal(niche.searchTerm,'garage door');
 assert.equal(parseCycleInput({...input,industry:niche.id,city:'',state:''}).industry,'garage_doors');
 assert.equal(classifyRelevance('Overhead door repair service',niche.searchTerm),'core');
 assert.equal(classifyRelevance('Garage door supplier',niche.searchTerm),'core');
 assert.equal(classifyRelevance('Parking garage',niche.searchTerm),null);
});
