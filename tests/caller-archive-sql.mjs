// Explicitly run against the configured database; every mutation is rolled back.
import {loadEnvFile} from 'node:process';import assert from 'node:assert/strict';loadEnvFile('.env.local');
const query=`begin;
do $$
declare owner uuid; other_user uuid; req uuid:=gen_random_uuid(); scenario uuid:=gen_random_uuid(); k text; brief jsonb; cfg jsonb:='{"agentId":"fixture","maximumCents":250}';
begin
 select owner_id into strict owner from nbc_pilot_rounds where id='2026-09-25-first-live-tests';
 select id into strict other_user from auth.users where id<>owner limit 1;
 if (select public from storage.buckets where id='caller-recordings') is distinct from false then raise exception 'bucket is not private';end if;
 if has_table_privilege('authenticated','caller_call_assets','select') or has_function_privilege('authenticated','nbc_phone_scenario_slot(uuid,uuid,text,integer,uuid,jsonb)','execute') then raise exception 'client access leaked';end if;
 insert into caller_conversation_scenarios(id,request_id,created_by,title,conversation_type,brief) values(scenario,scenario,owner,'Archive rollback fixture','outbound_prospecting','{"title":"Archive rollback fixture","offer":"Original"}');
 k:=nbc_phone_scenario_slot(owner,req,'+13055550123',250,scenario,cfg);
 if nbc_phone_scenario_slot(owner,req,'+13055550123',250,scenario,cfg)<>k then raise exception 'not idempotent';end if;
 update caller_conversation_scenarios set brief='{"title":"Edited","offer":"Changed"}' where id=scenario;
 select config->'scenarioBrief' into brief from nbc_pilot_slots where key=k and round_id='2026-09-25-first-live-tests';
 if brief->>'offer'<>'Original' then raise exception 'scenario was not snapshotted';end if;
 begin perform nbc_phone_scenario_slot(owner,req,'+13055550123',250,null,cfg);raise exception 'changed scenario accepted';exception when others then if sqlerrm<>'scenario_request_conflict' then raise;end if;end;
 begin perform nbc_phone_scenario_slot(other_user,gen_random_uuid(),'+13055550123',250,scenario,cfg);raise exception 'foreign owner accepted';exception when others then if sqlerrm<>'pilot_not_found' then raise;end if;end;
 update caller_conversation_scenarios set created_by=other_user where id=scenario;
 begin perform nbc_phone_scenario_slot(owner,gen_random_uuid(),'+13055550123',250,scenario,cfg);raise exception 'foreign scenario accepted';exception when others then if sqlerrm<>'scenario_not_found' then raise;end if;end;
 begin perform nbc_phone_scenario_slot(owner,gen_random_uuid(),'+13055550123',null,null,cfg);raise exception 'missing approval accepted';exception when others then if sqlerrm<>'approval_required' then raise;end if;end;
 perform nbc_save_call_event(owner,k,200,'ended','[{"role":"agent","message":"Final"}]');
 update caller_call_assets set note='Keep my note',note_version=1 where owner_id=owner and resource_key=k;
 perform nbc_save_call_event(owner,k,100,'ongoing','[]');
 perform nbc_save_call_event(owner,k,300,'ongoing','[]');
 if not exists(select 1 from caller_call_assets where owner_id=owner and resource_key=k and live_status='ended' and note='Keep my note' and note_version=1 and jsonb_array_length(live_transcript)=1) then raise exception 'event regressed data';end if;
end $$;
rollback;`;
const r=await fetch('https://api.supabase.com/v1/projects/'+process.env.SUPABASE_PROJECT_REF+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});const result=await r.json();assert.ok(r.ok,JSON.stringify(result));console.log('PASS: private bucket, client access denied, scenario snapshot, idempotency, ownership, approval, ordered events and note preservation. All SQL writes rolled back.');
