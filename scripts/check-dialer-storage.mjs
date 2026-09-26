// Database fixtures only, rolled back. Never contacts Twilio, ElevenLabs or discovery providers.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
const e=parseEnv(readFileSync('.env.local','utf8'));
const query=`begin;
do $$declare r nbc_pilot_rounds;k text;k2 text;k3 text;receipt jsonb;begin
select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' for update;
if has_function_privilege('authenticated','nbc_pilot_phone_slot(uuid,uuid,text)','EXECUTE') or has_table_privilege('authenticated','nbc_pilot_rate_confirmations','SELECT') then raise exception 'isolation failed';end if;
begin perform nbc_pilot_phone_slot('00000000-0000-4000-8000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','+13055550123');raise exception 'owner failed';exception when others then if sqlerrm<>'pilot_not_found' then raise;end if;end;
-- Fixture changes are inside the transaction and always roll back.
update nbc_pilot_operations set created_at=now()-interval '2 days' where round_id=r.id;
k:=nbc_pilot_phone_slot(r.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','+13055550123');
if k<>nbc_pilot_phone_slot(r.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','+13055550123') then raise exception 'idempotency failed';end if;
begin perform nbc_pilot_phone_slot(r.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','+13055550124');raise exception 'destination failed';exception when others then if sqlerrm<>'destination_conflict' then raise;end if;end;
k2:=nbc_pilot_phone_slot(r.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','+13055550124');
k3:=nbc_pilot_phone_slot(r.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','+13055550125');
receipt:=nbc_pilot_reserve(r.owner_id,k);if not(receipt->>'acquired')::boolean then raise exception 'reserve failed';end if;
receipt:=nbc_pilot_reserve(r.owner_id,k);if(receipt->>'acquired')::boolean then raise exception 'duplicate reserve failed';end if;
begin perform nbc_pilot_reserve(r.owner_id,k2);raise exception 'active guard failed';exception when others then if sqlerrm<>'pilot_operation_pending' then raise;end if;end;
update nbc_pilot_operations set state='completed' where round_id=r.id and key=k;
perform nbc_pilot_reserve(r.owner_id,k2);
update nbc_pilot_operations set state='completed' where round_id=r.id and key=k2;
begin perform nbc_pilot_reserve(r.owner_id,k3);raise exception 'daily guard failed';exception when others then if sqlerrm<>'phone_daily_limit' then raise;end if;end;
update nbc_pilot_operations set created_at=now()-interval '2 days',reserved_cents=2499 where round_id=r.id and key=k;
begin perform nbc_pilot_reserve(r.owner_id,k3);raise exception 'budget guard failed';exception when others then if sqlerrm<>'pilot_budget_exceeded' then raise;end if;end;
perform nbc_pilot_set_verification_rate(r.owner_id,7000,'Fixture invoice reference');
if(select (settings#>>'{verification,unitCents}')::integer from nbc_pilot_rounds where id=r.id)<>1 then raise exception 'rounding failed';end if;
if not exists(select 1 from nbc_pilot_rate_confirmations where round_id=r.id and source='Fixture invoice reference' and unit_microusd=7000) then raise exception 'audit failed';end if;
if(select cap_cents from nbc_pilot_rounds where id=r.id)<>2500 then raise exception 'cap changed';end if;
begin perform nbc_pilot_set_verification_rate(r.owner_id,100001,'Fixture invoice reference');raise exception 'rate cap failed';exception when others then if sqlerrm<>'invalid_price' then raise;end if;end;
end $$;
rollback;`;
const r=await fetch(`https://api.supabase.com/v1/projects/${e.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});
if(!r.ok){console.error((await r.json()).message??'Storage assertion failed');process.exitCode=1;}
else{const report={passed:true,checks:13,rolledBack:true,providerRequests:0,at:new Date().toISOString()};mkdirSync('artifacts/readiness/dialer-20260926',{recursive:true});writeFileSync('artifacts/readiness/dialer-20260926/storage.json',JSON.stringify(report,null,2));console.log(report);}
