import assert from "node:assert/strict";
import test from "node:test";
import { parseLeadCsv, normalizePhone, validateLead } from "../src/lib/caller-crm.ts";
import { conversationQuality, conversationSignals } from "../src/lib/caller-reasons.ts";
import { openingDisclosure, TRANSCRIPT_NOTICE, RECORDING_NOTICE } from "../src/lib/caller-disclosure.ts";
import type { CallSession } from "../src/lib/caller-types.ts";
const session = (id: string, message: string, extra: Partial<CallSession> = {}): CallSession => ({ id,provider:"elevenlabs",provider_call_id:id,channel:"web",status:"completed",created_at:new Date().toISOString(),started_at:null,ended_at:null,duration_seconds:15,transcript:[{role:"user",message,time_in_call_secs:3}],summary:null,failure_code:null,synced_at:new Date().toISOString(),...extra });
test("CSV respects quoted commas/newlines, normalizes US numbers, reports invalid rows and duplicates", () => {
 const result=parseLeadCsv('name,phone,email,company\r\n"Demo, One",(212) 555-0100,one@example.test,"Demo\nCompany"\r\nDuplicate,+12125550100,,\r\nDemo Two,4155550101,,Demo\r\nBroken,abc,,Demo');
 assert.equal(result.leads.length,2);assert.equal(result.leads[0].name,"Demo, One");assert.equal(result.leads[0].company,"Demo\nCompany");assert.equal(result.duplicates,1);assert.equal(result.errors.length,1);
 assert.equal(normalizePhone("+1 415 555 0101"),"+14155550101");
 for(const phone of ["911","+442071234567","11115550101","4155550101 ext 2"])assert.throws(()=>normalizePhone(phone));
 for(const csv of ['name,name,phone\na,b,c','name,phone\n"broken,123','name,phone\n"Demo"oops,2125550100','name,phone\n'+Array(501).fill('Demo,2125550100').join('\n'),'name,phone\n'+"a".repeat(524288)])assert.throws(()=>parseLeadCsv(csv));
 assert.throws(()=>validateLead({name:"Demo",phone:"2125550100",email:"invalid"}));
});
test("Insights uses final verified user turns, exact evidence and one count per session", () => {
 const fixture=session("one","I can't afford it. Can you send me more information?");
 const result=conversationSignals([fixture,fixture,session("two","not too expensive"),session("three","I need more time",{status:"processing"}),session("four","I need more time",{synced_at:null}),session("five","You need more time",{transcript:[{role:"agent",message:"too expensive",time_in_call_secs:1}]}),session("six","I don't want to cancel my appointment")]);
 assert.equal(result.analyzed,4);assert.equal(result.signals.find(item=>item.key==="budget_or_price")?.evidence.length,1);assert.equal(result.signals.find(item=>item.key==="information_requested")?.evidence[0].quote,fixture.transcript[0].message);assert.ok(!result.signals.some(item=>item.key==="appointment_change"));
});
test("Insights merges structured post-call analysis with phrase evidence and flags repetition", () => {
 const analysis={version:"nbc-analysis-v1" as const,data:{primary_objection:"trust_or_past_bad_experience",objection_detail:"A previous agency failed them.",customer_issue_category:"none",next_step:"follow_up_requested"},evaluations:{discovery_quality:{result:"success" as const,rationale:"",score:80,maxScore:100},objection_handling:{result:"success" as const,rationale:"",score:null,maxScore:null}},sentiment:{label:"positive" as const,score:.5,frustration:.1}};
 const first=session("structured-one","We were burned by our last agency.",{post_call_analysis:analysis});
 const second=session("structured-two","The previous agency wasted our time.",{post_call_analysis:analysis});
 const result=conversationSignals([first,second]);
 assert.equal(result.analyzedByProvider,2);assert.equal(result.recurring,2);
 assert.equal(result.signals.find(item=>item.key==="trust_or_past_bad_experience")?.evidence.length,2);
 assert.equal(result.signals.find(item=>item.key==="follow_up_requested")?.recurring,true);
 const quality=conversationQuality([first,second]);assert.equal(quality.enriched,2);assert.equal(quality.metrics.find(metric=>metric.key==="discovery_quality")?.value,80);assert.equal(quality.metrics.find(metric=>metric.key==="objection_handling")?.value,100);
});
test("Opening notice precedes greeting and truthfully distinguishes text/audio", () => {assert.ok(openingDisclosure(false).startsWith(TRANSCRIPT_NOTICE));assert.ok(openingDisclosure(true).startsWith(RECORDING_NOTICE));assert.ok(!openingDisclosure(false).includes("going to be recorded"));});
