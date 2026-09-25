import {test} from "node:test";
import assert from "node:assert/strict";
import {activityDays, summaryMetrics} from "../src/lib/summary-metrics.ts";
import type {CallSession} from "../src/lib/caller-types.ts";
import type {CallerLead} from "../src/lib/caller-crm.ts";

const session=(fields: Partial<CallSession>): CallSession => ({id:"test",provider:"elevenlabs",provider_call_id:null,channel:"web",status:"completed",created_at:"2026-09-15T01:00:00Z",started_at:null,ended_at:null,duration_seconds:120,transcript:[],summary:null,failure_code:null,synced_at:null,...fields});
const lead=(stage:CallerLead["stage"],is_demo=false):CallerLead=>({id:stage,stage,is_demo,name:"TEST",phone:"",email:"",company:"",source:"",notes:"",created_at:"",updated_at:""});
test("summary separates demo records, failed calls, phone time and do-not-call leads",()=>{
 const result=summaryMetrics([lead("new"),lead("queued"),lead("do_not_call"),lead("won"),lead("new",true)],[session({}),session({channel:"phone",duration_seconds:600}),session({status:"failed"}),session({is_demo:true})]);
 assert.equal(result.leads,4);assert.equal(result.ready,2);assert.equal(result.conversations,2);assert.equal(result.practiceMinutes,2);assert.equal(result.pipeline.reduce((sum,group)=>sum+group.value,0),4);assert.equal(result.pipeline.at(-1)?.value,1);
});
test("daily chart uses UTC dates, inclusive window and only completed real sessions",()=>{
 const rows=activityDays([session({created_at:"2026-09-09T00:00:00Z"}),session({created_at:"2026-09-08T23:59:59Z"}),session({created_at:"2026-09-14T23:30:00-04:00",channel:"phone"}),session({created_at:"2026-09-16T00:00:00Z"}),session({status:"active"}),session({is_demo:true}),session({created_at:"invalid"})],7,new Date("2026-09-15T12:00:00Z"));
 assert.equal(rows.length,7);assert.equal(rows[0].date,"2026-09-09");assert.equal(rows[0].practice,1);assert.equal(rows[6].phone,1);assert.equal(rows.reduce((sum,row)=>sum+row.total,0),2);
});
test("empty chart remains zero and no negative or missing durations are invented",()=>{
 assert(activityDays([],30,new Date("2026-09-15T12:00:00Z")).every(row=>row.total===0));
 assert.equal(summaryMetrics([],[session({duration_seconds:null}),session({duration_seconds:-30})]).practiceMinutes,0);
});

test('independent C04 do-not-call flag excludes outreach even in an active stage', () => {
 const blocked = { id: 'blocked', stage: 'new', do_not_call: true } as CallerLead;
 const metrics = summaryMetrics([blocked], []);
 assert.equal(metrics.ready, 0); assert.equal(metrics.pipeline[0].value, 0); assert.equal(metrics.pipeline[4].value, 1);
});
