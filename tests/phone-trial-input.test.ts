import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePhoneTrial} from '../src/lib/caller-phone-trial.ts';
import {parseVerificationRate} from '../src/lib/run-verification-rate.ts';
const requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('phone trials require explicit recipient confirmation and reject extensions, extra controls and premium destinations',()=>{
 assert.deepEqual(parsePhoneTrial({requestId,phone:'+1 (305) 555-0123',confirmed:true}),{requestId,phone:'+13055550123'});
 for(const b of [null,{}, {requestId,phone:'+13055550123',confirmed:false},{requestId,phone:'+18005550123',confirmed:true},{requestId,phone:'+19005550123',confirmed:true},{requestId,phone:'3055550123',confirmed:true},{requestId,phone:'+13055550123;ext=2',confirmed:true},{requestId,phone:'+13055550123',confirmed:true,budget:9999},{requestId:'bad',phone:'+13055550123',confirmed:true}])assert.throws(()=>parsePhoneTrial(b));
});
test('verification rate is precise and must be explicitly sourced and confirmed',()=>{
 assert.deepEqual(parseVerificationRate({rateUsd:'0.007',source:'Account price',confirmed:true}),{unitMicrousd:7000,source:'Account price'});
 for(const rateUsd of ['0','0.00','-0.1','NaN','1','0.100001','0.0000001'])assert.throws(()=>parseVerificationRate({rateUsd,source:'Account price',confirmed:true}));
 assert.throws(()=>parseVerificationRate({rateUsd:'0.01',source:'Account price',confirmed:false}));
 assert.throws(()=>parseVerificationRate({rateUsd:'0.01',source:'',confirmed:true}));
});
