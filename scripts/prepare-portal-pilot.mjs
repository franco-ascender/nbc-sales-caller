// One-time setup only: seeds the approved round and imports ALREADY completed evidence.
// No call, scrape, verification, top-up or number purchase is dispatched by this script.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {openPilotBudget,ROUND} from './lib/live-pilot-budget.mjs';
const e=parseEnv(readFileSync('.env.local','utf8'));
const db=createClient(e.NEXT_PUBLIC_SUPABASE_URL,e.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const pilot=JSON.parse(readFileSync('config/caller-pilot.local.json','utf8'));
const phone=JSON.parse(readFileSync('config/telephone-pilot.local.json','utf8'));
const {data:scenario,error}=await db.from('caller_conversation_scenarios').select('created_by').eq('id',pilot.scenario.id).single();
if(error||!scenario)throw Error('Scenario owner could not be verified.');
const {data:member,error:memberError}=await db.from('nbc_members').select('role,status').eq('id',scenario.created_by).single();
if(memberError||member.role!=='admin'||member.status!=='active')throw Error('Pilot owner must be an active admin.');
const ledger=openPilotBudget('config/first-live-tests.local.sqlite');
const oldPhone=ledger.get('caller-1:telephone'),oldScrape=ledger.get('roofing-miami:discovery');ledger.close();
if(oldPhone.state!=='completed'||oldScrape.state!=='completed')throw Error('Reconcile previous operations before import.');
const report=JSON.parse(readFileSync('artifacts/readiness/first-live-tests/roofing-miami-report.json','utf8'));
const rows=JSON.parse(readFileSync('artifacts/readiness/first-live-tests/roofing-miami-reviewed.json','utf8'));
const conversation=JSON.parse(readFileSync('artifacts/readiness/first-live-tests/phone-conversation.json','utf8'));
const charging=conversation.metadata.charging;
const agentUsd=charging.platform_price+charging.llm_price;
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const json=x=>quote(JSON.stringify(x))+'::jsonb';
const slots=[{key:'caller-1',kind:'phone',title:'Earlier attempt · voicemail',allocation:250,reserve:250,config:{}},{key:'caller-2',kind:'phone',title:'Your live Nalify call',allocation:250,reserve:250,config:{}}];
for(const [kind,label,count,allocation] of [['roofing','Roofing',50,200],['chiropractor','Chiropractors',25,200],['medspa','Med spas',25,600]]){
 for(const [city,state,region] of [['Miami','FL','Florida'],['Charlotte','NC','North Carolina']])slots.push({key:kind+'-'+city.toLowerCase(),kind:'scrape',title:label+' · '+city+', '+state,allocation,reserve:75,config:{industry:kind==='roofing'?'roofing contractor':kind==='medspa'?'medical spa':'chiropractor',city,state,location:city+', '+region+', United States',count}});
}
const settings={agentId:phone.agentId,from:phone.from,destination:pilot.destination};
const phoneResult={message:'Earlier attempt reached voicemail; no human conversation was tested.',outcome:'Voicemail',durationSeconds:21,agentUsd,agentCredits:conversation.metadata.cost,voiceUsd:null,costComplete:false,costNote:'Voice-agent usage reported; phone charges are pending. Reservation retained.',transcript:conversation.transcript.filter(t=>typeof t.message==='string').map(t=>({role:t.role,message:t.message})),summary:conversation.analysis?.transcript_summary};
const scrapeResult={message:'Existing Miami sample reused. Phone and owner verification have not run.',rawBusinesses:report.rawBusinesses,acceptedForReview:report.acceptedForReview,rows,costComplete:false,costNote:'Search receipt; data-read fees may arrive later. Reservation retained.'};
const sql=`begin;
insert into nbc_pilot_rounds(id,owner_id,cap_cents,paused,settings) values(${quote(ROUND)},${quote(scenario.created_by)},2500,true,${json(settings)}) on conflict do nothing;
do $$begin if not exists(select 1 from nbc_pilot_rounds where id=${quote(ROUND)} and owner_id=${quote(scenario.created_by)} and cap_cents=2500 and settings=${json(settings)}) then raise exception 'existing round differs';end if;end$$;
${slots.map(s=>`insert into nbc_pilot_slots(round_id,key,kind,title,allocation_cents,reserve_cents,config) values(${quote(ROUND)},${quote(s.key)},${quote(s.kind)},${quote(s.title)},${s.allocation},${s.reserve},${json(s.config)}) on conflict do nothing;`).join('\n')}
insert into nbc_pilot_operations(round_id,key,state,reserved_cents,reported_microusd,provider,result) values
(${quote(ROUND)},'caller-1','completed',250,${Math.ceil(agentUsd*1e6)},${json({callSid:oldPhone.receipt.callSid,agentId:phone.agentId,phase:'dispatched'})},${json(phoneResult)}),
(${quote(ROUND)},'roofing-miami','completed',75,${Math.ceil(report.runUsageUsd*1e6)},${json({job:oldScrape.receipt.job,phase:'dispatched'})},${json(scrapeResult)}) on conflict do nothing;
commit;`;
const r=await fetch(`https://api.supabase.com/v1/projects/${e.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});
if(!r.ok)throw Error('Pilot setup transaction failed: HTTP '+r.status);
mkdirSync('artifacts/readiness/first-live-tests',{recursive:true});
writeFileSync('artifacts/readiness/first-live-tests/portal-seeded.json',JSON.stringify({at:new Date().toISOString(),round:ROUND,slots:slots.length,priorOperationsImported:2,pausedUntilVerified:true})+'\n',{mode:0o600});
console.log('Seeded private portal round, 8 approved slots and prior evidence. Paused until engineering verification. No paid requests.');
