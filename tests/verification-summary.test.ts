import test from 'node:test';
import assert from 'node:assert/strict';
import {verificationSummary,verificationSummaryCsv,verificationPercent,qualifiedRows} from '../src/lib/run-review.ts';
import type {PilotResult,PilotRow} from '../src/lib/live-pilot.ts';
const row=(phone10:string):PilotRow=>({name:'Example',phone10,city:'Miami',state:'FL',website:null,sourceUrl:null,rejection:null,duplicate:false,chain:null});
test('summary separates reachability from mobile qualification and excludes unchecked phones from percentages',()=>{
 const result:PilotResult={rows:Array.from({length:6},(_,i)=>row(`305555120${i}`)),phoneChecks:[]};
 result.rows!.push(row('3055551200'),{...row('8005551200'),rejection:'toll_free'});
 result.phoneChecks=[
  {phone10:'3055551200',state:'completed',verification:{phone10:'3055551200',lineType:'Land Line',reachable:true,dnc:false,tcpa:false,verifiedAt:new Date().toISOString()}},
  {phone10:'3055551201',state:'completed',verification:{phone10:'3055551201',lineType:'Mobile',reachable:false,dnc:false,tcpa:false,verifiedAt:new Date().toISOString()}},
  {phone10:'3055551202',state:'completed',verification:{phone10:'3055551202',lineType:null,reachable:null,dnc:null,tcpa:null,verifiedAt:new Date().toISOString()}},
  {phone10:'3055551203',state:'uncertain',verification:null},
  {phone10:'3055551204',state:'completed',verification:{phone10:'3055551204',lineType:'Mobile',reachable:true,dnc:false,tcpa:false,verifiedAt:'2020-01-01T00:00:00Z'}},
 ];
 assert.deepEqual(verificationSummary(result),{total:6,checked:4,pending:1,unresolved:1,reachable:1,unreachable:1,unknown:2,mobile:1,landline:1,other:2,qualified:0});
 assert.equal(verificationPercent(1,4),'25.0%');assert.equal(verificationPercent(0,0),'—');assert.equal(qualifiedRows(result).length,0);
 assert.match(verificationSummaryCsv(result),/"Reachable \(provider reported\)","1","25.0%"/);
});
