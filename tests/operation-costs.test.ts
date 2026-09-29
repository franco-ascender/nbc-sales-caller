import './caller-test-loader.mjs';
import test from'node:test';import assert from'node:assert/strict';
import type{CostOperation,CostCheck}from'../src/lib/operation-costs.ts';
const{operationCosts}=await import('../src/lib/operation-costs.ts');
const operation=(key:string):CostOperation=>({round_id:'r',key,state:'completed',reserved_cents:75,reported_microusd:100000,result:{},created_at:'2026-09-26',updated_at:'2026-09-26'});
test('provider totals exclude reservations and charge a reused phone only once; unknown prices remain unknown',()=>{
 const check:CostCheck={round_id:'r',slot_key:'a',phone10:'3055551234',state:'completed',reserved_cents:1,rate_microusd:7000,verification:null};const report=operationCosts([operation('a'),operation('b')],[],[check,{...check,phone10:'3055551235',rate_microusd:null},{...check,phone10:'3055551236',state:'uncertain'}]);assert.equal(report.reportedMicrousd,200000);assert.equal(report.estimatedMicrousd,7000);assert.equal(report.missing,2);assert.equal(report.rows[1].estimatedMicrousd,0);assert.equal(report.rows[0].reservedMicrousd,780000);assert.equal(report.rows[0].costPerQualifiedMicrousd,null);
});
test('phone total uses provider components once and unknown cost prevents a misleading per-minute price',()=>{
 const op={...operation('call'),reported_microusd:140000,result:{voiceUsd:.014,agentUsd:.12,durationSeconds:60}};const slot={round_id:'r',key:'call',kind:'phone',title:'Call',config:{approvedCeilingCents:250}};let report=operationCosts([op],[slot],[]);assert.equal(report.reportedMicrousd,134000);assert.equal(report.rows[0].costPerMinuteMicrousd,134000);assert.equal(report.rows[0].approvedMicrousd,2500000);report=operationCosts([{...op,result:{voiceUsd:.014,durationSeconds:60}}],[slot],[]);assert.equal(report.missing,1);assert.equal(report.rows[0].costPerMinuteMicrousd,null);
});
test('operation costs require admin before reading data',async()=>{const {readOperationCosts}=await import('../src/services/operation-costs.service.ts');await assert.rejects(()=>readOperationCosts({role:'student'} as never),/Administrator/);});
test('Retell bundled cost is not charged again as Twilio or ElevenLabs',()=>{const report=operationCosts([{...operation('call'),result:{phoneEngine:'retell',retellCostMicrousd:122800,durationSeconds:60}}],[{round_id:'r',key:'call',kind:'phone',title:'Call',config:{}}],[]);assert.equal(report.reportedMicrousd,122800);assert.deepEqual(report.providers.map(p=>p.provider),['Retell']);assert.equal(report.rows[0].costPerMinuteMicrousd,122800);});
