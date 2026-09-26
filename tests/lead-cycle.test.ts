import test from 'node:test';import assert from 'node:assert/strict';
import {parseCycleInput,cyclePresentation,type LeadCycle} from '../src/lib/lead-cycle.ts';
import type {PilotSlotView} from '../src/lib/live-pilot.ts';
const input={action:'create',requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Miami clinics',industry:'chiropractor',city:'Miami',state:'FL',count:25,confirmed:true};
test('list input is bounded, explicit and rejects provider or budget overrides',()=>{
 assert.equal(parseCycleInput(input).count,25);
 for(const b of [{...input,confirmed:false},{...input,count:51},{...input,count:0},{...input,state:'XX'},{...input,city:'Miami\nOther'},{...input,budget:5000},{...input,provider:'outscraper'}])assert.throws(()=>parseCycleInput(b));
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
