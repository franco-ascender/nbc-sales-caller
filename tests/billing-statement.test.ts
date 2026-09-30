import './caller-test-loader.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
const {parseBillingStatement}=await import('../src/lib/billing-statement.ts');
const document={provider:'Outscraper',reference:'OSFEFA7B4B-0008',issued_on:'2026-09-08',currency:'USD',kind:'invoice',total:'305.10',applied:'87.47',due:'217.63',evidence:'invoice.pdf',note:'Historical account usage'};
test('invoice total, balance applied and amount due stay separate',()=>{const result=parseBillingStatement(document);assert.equal(result.total_microusd,305100000);assert.equal(result.applied_microusd,87470000);assert.equal(result.due_microusd,217630000);});
test('invalid amounts and dates fail closed',()=>{for(const patch of [{total:'NaN'},{due:'305.10'},{total:'1e2'},{total:'-1'},{issued_on:'2026-02-30'},{currency:'usd'},{evidence:''},{kind:'paid'}])assert.throws(()=>parseBillingStatement({...document,...patch}));});
test('prepaid cash outlay remains classified independently of usage',()=>assert.equal(parseBillingStatement({...document,kind:'prepayment'}).kind,'prepayment'));
test('only admins can record billing documents or reconcile provider receipts',async()=>{const {saveBillingStatement,reconcileCostReceipts}=await import('../src/services/operation-costs.service.ts');await assert.rejects(()=>saveBillingStatement({role:'student'} as never,document),/Administrator/);await assert.rejects(()=>reconcileCostReceipts({role:'coach'} as never),/Administrator/);});
