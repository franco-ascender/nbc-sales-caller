// Real database invariants, all mutations rolled back. No provider requests.
import {loadEnvFile} from 'node:process';import assert from 'node:assert/strict';loadEnvFile('.env.local');
const query=`begin;
do $$
declare owner uuid; r text:='2026-09-25-first-live-tests'; foreign_key text:='dial-'||gen_random_uuid()::text; req uuid:=gen_random_uuid(); k text; claim jsonb; cfg jsonb:='{"agentId":"fixture","maximumCents":250}';
begin
 select owner_id into strict owner from nbc_pilot_rounds where id=r;
 if has_function_privilege('authenticated','nbc_portal_phone_scenario_slot(uuid,uuid,text,integer,uuid,jsonb)','execute') or has_function_privilege('authenticated','nbc_portal_phone_reserve(uuid,text)','execute') then raise exception 'client access leaked';end if;
 insert into nbc_pilot_slots(round_id,key,kind,title,allocation_cents,reserve_cents,config) values(r,foreign_key,'phone','External rollback fixture',250,250,'{"phoneEngine":"neuron","destination":"+13055550123"}');
 insert into nbc_pilot_operations(round_id,key,state,reserved_cents,provider,result) values(r,foreign_key,'running',250,'{"engine":"neuron","callId":"req_fixture"}','{"callStatus":"queued"}');
 k:=nbc_portal_phone_scenario_slot(owner,req,'+13055550124',250,null,cfg);
 if nbc_portal_phone_scenario_slot(owner,req,'+13055550124',250,null,cfg)<>k then raise exception 'not idempotent';end if;
 claim:=nbc_portal_phone_reserve(owner,k);
 if not (claim->>'acquired')::boolean then raise exception 'external operation blocked portal';end if;
 if (nbc_portal_phone_reserve(owner,k)->>'acquired')::boolean then raise exception 'duplicate reservation';end if;
 begin perform nbc_portal_phone_scenario_slot(owner,gen_random_uuid(),'+13055550124',250,null,cfg);raise exception 'own active call bypassed';exception when others then if sqlerrm<>'pilot_operation_pending' then raise;end if;end;
 if not exists(select 1 from nbc_pilot_operations where round_id=r and key=foreign_key and state='running' and reserved_cents=250 and provider->>'callId'='req_fixture') then raise exception 'external operation changed';end if;
 if not exists(select 1 from nbc_pilot_operations where round_id=r and key=k and reserved_cents=250) then raise exception 'reservation lost';end if;
 begin perform nbc_portal_phone_reserve(owner,foreign_key);raise exception 'foreign dispatch accepted';exception when others then if sqlerrm<>'invalid_slot' then raise;end if;end;
end $$;
rollback;`;
const response=await fetch('https://api.supabase.com/v1/projects/'+process.env.SUPABASE_PROJECT_REF+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});assert.ok(response.ok,JSON.stringify(await response.json()));console.log('PASS: external workflow isolated; own-call lock, budget reservation, idempotency and admin-only access preserved. All writes rolled back.');
