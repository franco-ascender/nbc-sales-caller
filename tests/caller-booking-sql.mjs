// Executes only a transaction that rolls back. No provider calls, messages or appointments.
import {loadEnvFile} from 'node:process';import assert from 'node:assert/strict';loadEnvFile('.env.local');
const query=`begin;
do $$
declare owner uuid; request uuid:=gen_random_uuid(); scenario uuid; k text; booking uuid:=gen_random_uuid(); cfg jsonb:='{"agentId":"booking_fixture","maximumCents":250}';
begin
 select owner_id into strict owner from nbc_pilot_rounds where id='2026-09-25-first-live-tests';
 select id into scenario from caller_conversation_scenarios where created_by=owner and archived_at is null limit 1;
 if scenario is null then raise exception 'A saved scenario is required for this rollback check';end if;
 if has_function_privilege('authenticated','nbc_portal_phone_booking_slot(uuid,uuid,text,integer,uuid,jsonb,boolean)','execute') then raise exception 'RPC access leaked';end if;
 if has_table_privilege('authenticated','caller_booking_connections','select') or has_table_privilege('anon','caller_bookings','select') then raise exception 'Booking credentials/data leaked';end if;
 insert into caller_booking_connections(owner_id,config,token_ciphertext,retell_config) values(owner,'{"enabled":true,"calendarId":"calendar-fixture"}','encrypted-fixture',cfg) on conflict(owner_id) do update set config=excluded.config,token_ciphertext=excluded.token_ciphertext,retell_config=excluded.retell_config;
 k:=nbc_portal_phone_booking_slot(owner,request,'+13055550124',250,scenario,cfg,true);
 if not exists(select 1 from caller_booking_calls where operation_key=k and owner_id=owner and config->>'calendarId'='calendar-fixture') then raise exception 'Binding was not created atomically';end if;
 if nbc_portal_phone_booking_slot(owner,request,'+13055550124',250,scenario,cfg,true)<>k then raise exception 'Idempotency failure';end if;
 begin perform nbc_portal_phone_booking_slot(owner,request,'+13055550124',250,scenario,cfg,false);raise exception 'Booking intent changed';exception when others then if sqlerrm<>'booking_request_conflict' then raise;end if;end;
 update caller_booking_connections set config='{"enabled":true,"calendarId":"different-calendar"}' where owner_id=owner;
 if not exists(select 1 from caller_booking_calls where operation_key=k and config->>'calendarId'='calendar-fixture') then raise exception 'Snapshot mutated';end if;
 insert into caller_bookings(id,operation_key,owner_id,request,state) values(booking,k,owner,'{}','booking');
 begin insert into caller_bookings(operation_key,owner_id,request,state) values(k,owner,'{}','booking');raise exception 'Duplicate booking allowed';exception when unique_violation then null;end;
 insert into caller_booking_steps(booking_id,kind,state) values(booking,'sms','running');
 begin insert into caller_booking_steps(booking_id,kind,state) values(booking,'sms','running');raise exception 'Duplicate message allowed';exception when unique_violation then null;end;
end $$;
rollback;`;
const response=await fetch('https://api.supabase.com/v1/projects/'+process.env.SUPABASE_PROJECT_REF+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});assert.ok(response.ok,JSON.stringify(await response.json()));console.log('PASS: atomic booking permission snapshot, immutable replay, one booking/message per operation, server-only access. All writes rolled back.');
