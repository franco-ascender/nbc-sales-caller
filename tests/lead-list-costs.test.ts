import './caller-test-loader.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {leadListCosts,listCostMoney} from '../src/lib/lead-list-costs.ts';
import type {CostCheck,CostOperation} from '../src/lib/operation-costs.ts';
const {operationCosts}=await import('../src/lib/operation-costs.ts');
const phone='3055551234',now=new Date().toISOString();
const op=(key:string):CostOperation=>({round_id:'r',key,state:'completed',reserved_cents:75,reported_microusd:100200,result:{rows:[{name:'Business',city:'Miami',state:'FL',website:null,sourceUrl:null,phone10:phone,rejection:null,duplicate:false,chain:null}]},created_at:now,updated_at:now});
const check:CostCheck={round_id:'r',slot_key:'a',phone10:phone,state:'completed',reserved_cents:1,rate_microusd:10000,verification:{phone10:phone,lineType:'Mobile',dnc:false,tcpa:false,reachable:true,verifiedAt:now}};
test('list cost includes all new checks, counts shared checks only at origin, and ignores budget reservations',()=>{
 const rows=operationCosts([op('a'),op('b')],[],[check,{...check,phone10:'3055559876',verification:{...check.verification!,lineType:'Land Line'}}]).rows;
 const a=leadListCosts(rows[0],1,2,0),b=leadListCosts(rows[1],1,0,1);
 assert.equal(a.totalMicrousd,130200);assert.equal(a.perMobileMicrousd,130200);assert.equal(a.verificationMicrousd,20000);assert.equal(a.status,'estimated');assert.equal(leadListCosts(rows[0],1,2,0,3).status,'partial');assert.equal(b.totalMicrousd,110200);assert.equal(b.verificationMicrousd,0);assert.equal(b.reusedChecks,1);assert.equal(b.verifiedMobiles,1);
 assert.equal(listCostMoney(52040),'$0.052');assert.equal(listCostMoney(null),'Pending');
});
test('unknown charges and missing storage remain partial, and zero mobiles never produces an infinite price',()=>{
 const row=operationCosts([op('a')],[],[{...check,rate_microusd:null}]).rows[0];const c=leadListCosts(row,undefined,1);assert.equal(c.status,'partial');assert.equal(c.totalMicrousd,100200);assert.equal(c.verificationMicrousd,null);assert.equal(c.missingCharges,1);
 const empty=operationCosts([{...op('a'),reported_microusd:null,result:{}}],[],[]).rows[0];const pending=leadListCosts(empty);assert.equal(pending.totalMicrousd,null);assert.equal(pending.perMobileMicrousd,null);
 const noMobile=leadListCosts({...row,qualified:0},1);assert.equal(noMobile.perMobileMicrousd,null);
});
test('current filters or duplicate business rows do not inflate mobile denominator; pending checks are not completed spend',()=>{
 const o=op('a');o.result.rows!.push({...o.result.rows![0],name:'Second listing'});
 const r=operationCosts([o],[],[check,{...check,phone10:'3055559876',state:'uncertain',rate_microusd:10000}]).rows[0];const c=leadListCosts(r,1,1);
 assert.equal(c.verifiedMobiles,1);assert.equal(c.totalMicrousd,120200);assert.equal(c.status,'partial');assert.equal(c.missingCharges,1);
});
