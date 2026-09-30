import test from 'node:test';
import assert from 'node:assert/strict';
import {publishedBusinessEmails} from '../src/lib/lead-business-emails.ts';
import {parseDiscoveryCandidate} from '../src/lib/lead-engine-scrape.ts';
import {priceSearch} from '../src/lib/lead-cycle-quote.ts';
import {parseCycleInput} from '../src/lib/lead-cycle.ts';
import {runEvidenceRows,phoneDecision} from '../src/lib/run-review.ts';
import {createApifyDiscoveryProvider} from '../src/services/lead-engine-apify.ts';
import type {DiscoveryJob} from '../src/lib/lead-engine-discovery.ts';

test('website emails are bounded and screened without inventing verification or owner identity',()=>{
 assert.deepEqual(publishedBusinessEmails([' Info@Example.com ','info@example.com','hello+sales@example.co.uk','bad\r\n@example.com','a..b@example.com','x@localhost','x@image.png',42,{value:'other@example.com'}]),['info@example.com','hello+sales@example.co.uk']);
 assert.equal(publishedBusinessEmails(Array.from({length:1000},(_,i)=>`person${i}@example.com`)).length,20);
 const row=parseDiscoveryCandidate({title:'Miami Pest Control',city:'Miami',state:'FL',countryCode:'US',url:'https://www.google.com/maps/place/example',website:'https://example.com',phoneUnformatted:'',phone:'(305) 555-1234',categoryName:'Pest control service',permanentlyClosed:false,temporarilyClosed:false,emails:['info@example.com']},{industry:'pest control',metro:'Miami, FL',target:25,hardBudgetCents:100,exclusions:[]});
 assert.equal(row.phone10,'3055551234');assert.equal(row.rejection,null);assert.deepEqual(row.emails,['info@example.com']);
 const noPhone={...row,phone10:null,rejection:'published_phone_missing',duplicate:false,chain:null};const cells=runEvidenceRows({rows:[noPhone]});assert.equal(cells[1][cells[0].indexOf('Business emails')],'info@example.com');assert.match(String(cells[1][cells[0].indexOf('Email status')]),/not deliverability verified/);
 assert.equal(phoneDecision({lineType:'',verifiedAt:new Date().toISOString()} as never).label,'Provider could not identify line type');
});
test('email discovery is explicitly priced and fails closed when the add-on rate is unavailable',()=>{
 const rates={placeMicrousd:4000,contactMicrousd:2000,startMicrousd:200,minimumCapCents:50,readMicrousd:.4,transferUsdPerGb:.2,storageUsdPerGbHour:.001,retentionHours:168,availableCents:10000,activeRuns:0,verificationUnitCents:1,checkedAt:new Date().toISOString()};
 const plain=priceSearch(25,rates),email=priceSearch(25,rates,true);assert.equal(email.emailEstimateCents,5);assert.equal(email.estimatedTotalCents-plain.estimatedTotalCents,5);assert.equal(email.maximumCents,plain.maximumCents,'provider minimum cap is not billed usage');
 assert.throws(()=>priceSearch(25,{...rates,contactMicrousd:undefined},true),/email pricing/);assert.throws(()=>priceSearch(25,{...rates,contactMicrousd:NaN},true),/email pricing/);
 const input={action:'create',requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Pest control',industry:'pest_control',city:'Miami',state:'FL',count:25,confirmed:true};
 assert.equal(parseCycleInput({...input,includeEmails:true}).includeEmails,true);assert.throws(()=>parseCycleInput({...input,includeEmails:'true'}));
});
test('approved website contact extraction cannot silently enable paid leads or mailbox verification',async()=>{
 const job:DiscoveryJob={operatorId:'11111111-1111-4111-8111-111111111111',batchId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',planId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actorId:'nwua9Gu5YrADL7ZDj',build:'0.14.757',searchTerm:'pest control',location:'Miami, FL',maxResults:25,maxCostCents:50,status:'dispatching',runId:null,datasetId:null,includeEmails:true};
 let requests=0;const provider=createApifyDiscoveryProvider('fixture',async(url,init)=>{requests++;const u=new URL(String(url)),body=JSON.parse(String(init?.body));assert.equal(body.scrapeContacts,true);assert.equal(body.maximumLeadsEnrichmentRecords,0);assert.equal(body.verifyLeadsEnrichmentEmails,false);assert.equal(u.searchParams.get('maxTotalChargeUsd'),'0.50');return Response.json({data:{id:'RunSynthetic12345',actId:job.actorId,buildNumber:job.build,defaultDatasetId:'DatasetSynthetic1',status:'RUNNING'}});});
 await provider.start(job);assert.equal(requests,1);
});
