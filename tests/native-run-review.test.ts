import test from 'node:test';
import assert from 'node:assert/strict';
import { excludeBeforeVerification, phoneDecision, reviewConversation, csvCell, qualifiedRows, runEvidenceCsv } from '../src/lib/run-review.ts';
import { matchRegistryEvidence } from '../src/lib/run-owner-evidence.ts';
import type {PilotResult, PilotRow} from '../src/lib/live-pilot.ts';
const row:PilotRow={name:'Example Chiropractic',city:'Miami',state:'FL',phone10:'3055551234',website:null,sourceUrl:null,rejection:null,duplicate:false,chain:null};
test('prefilter never sends missing, invalid, toll-free, duplicate or chain numbers to paid checks',()=>{
 assert.equal(excludeBeforeVerification(row),null);
 for(const change of [{phone10:null},{phone10:'8005551234'},{phone10:'123'},{duplicate:true},{chain:'Example chain'},{rejection:'closed'}])assert.ok(excludeBeforeVerification({...row,...change}));
});
test('phone clearance is unknown until every check passes; owner identity is a separate result',()=>{
 const v={phone10:row.phone10,lineType:'Mobile',dnc:false,tcpa:false,reachable:true,verifiedAt:new Date(Date.now()-1000).toISOString()};
 assert.equal(phoneDecision(v).accepted,true);
 for(const change of [{verifiedAt:null},{verifiedAt:new Date(Date.now()-32*86400000).toISOString()},{dnc:null},{dnc:true},{tcpa:null},{tcpa:true},{reachable:null},{reachable:false},{lineType:'Landline'},{lineType:null}])assert.equal(phoneDecision({...v,...change}).accepted,false);
});
test('findings link to prospect evidence and distinguish unconfirmed actions from agreement',()=>{
 const findings=reviewConversation({transcript:[{role:'user',message:'I tried a few agencies, but they never worked.'},{role:'user',message:'How much does this cost?'},{role:'agent',message:"I don't have the exact pricing details confirmed."},{role:'agent',message:'A team member will contact you.'},{role:'user',message:'Will I receive an invite?'}]});
 assert.ok(findings.some(f=>f.label==='Previous agency disappointment'&&f.turn===0));
 assert.ok(findings.some(f=>f.label==='Price / investment question'&&f.turn===1));
 assert.ok(findings.some(f=>f.kind==='gap'&&f.turn===2));
 assert.ok(findings.some(f=>f.label==='Unconfirmed callback promise'));
});
test('registry association needs a unique active local organization and never proves ownership',()=>{
 const record={number:1234567890,enumeration_type:'NPI-2',basic:{status:'A',organization_name:row.name,authorized_official_first_name:'Example',authorized_official_last_name:'Person',authorized_official_title_or_position:'Manager'},addresses:[{address_purpose:'LOCATION',city:'Miami',state:'FL'}]};
 const found=matchRegistryEvidence(row,[record],'2026-09-26');assert.equal(found.state,'association_found');assert.equal(found.ownerConfirmed,false);
 assert.equal(matchRegistryEvidence(row,[record,record],'2026-09-26').state,'ambiguous');
 assert.equal(matchRegistryEvidence({...row,city:'Charlotte'},[record],'2026-09-26').state,'not_found');
 assert.equal(matchRegistryEvidence(row,[{...record,basic:{...record.basic,status:'D'}}],'2026-09-26').state,'not_found');
});
test('CSV spreadsheet formulas cannot execute, including leading whitespace',()=>{
 for(const value of ['=SUM(1,2)',' +15551234','\t@SUM(A1)','-cmd'])assert.ok(csvCell(value).startsWith('"\''));
});

test('qualified export excludes duplicate, chain, stale and unconfirmed phones and retains registry provenance',()=>{
 const verification={phone10:row.phone10,lineType:'Mobile',dnc:false,tcpa:false,reachable:true,verifiedAt:new Date(Date.now()-1000).toISOString()};
 const result:PilotResult={rows:[row,{...row,name:'Duplicate'},{...row,name:'Chain',chain:'Franchise'}],phoneChecks:[{phone10:row.phone10!,state:'completed',verification}]};
 assert.equal(qualifiedRows(result).length,1);
 assert.equal(runEvidenceCsv(result,true).split('\r\n').length,2);
 assert.ok(runEvidenceCsv(result,true).includes('Not established'));
 result.phoneChecks![0].state='uncertain';assert.equal(qualifiedRows(result).length,0);
 result.phoneChecks![0].state='completed';verification.verifiedAt=new Date(Date.now()-32*86400000).toISOString();assert.equal(qualifiedRows(result).length,0);
});
