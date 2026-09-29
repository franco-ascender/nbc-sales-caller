import './caller-test-loader.mjs';import test from'node:test';import assert from'node:assert/strict';
const{readRetellReceipt}=await import('../src/services/retell-read.service.ts');
test('Retell receipt reader is GET-only, checks stored identity and never invents missing cost',async()=>{
 const oldFetch=globalThis.fetch,key=process.env.RETELL_API_KEY;process.env.RETELL_API_KEY='fixture';let calls=0,mismatch=false;
 globalThis.fetch=async(input,init)=>{calls++;assert.equal(String(input),'https://api.retellai.com/v2/get-call/call_fixture');assert.equal(init?.method,'GET');assert.equal(init?.redirect,'error');return Response.json({call_id:'call_fixture',agent_id:mismatch?'agent_other':'agent_fixture',call_status:'ended',duration_ms:1000});};
 try{await assert.rejects(()=>readRetellReceipt('../create-phone-call','agent_fixture'));assert.equal(calls,0);const receipt=await readRetellReceipt('call_fixture','agent_fixture');assert.equal(receipt.costMicrousd,null);assert.equal(receipt.durationMs,1000);mismatch=true;await assert.rejects(()=>readRetellReceipt('call_fixture','agent_fixture'),/does not match/);assert.equal(calls,2);}finally{globalThis.fetch=oldFetch;if(key===undefined)delete process.env.RETELL_API_KEY;else process.env.RETELL_API_KEY=key;}
});
