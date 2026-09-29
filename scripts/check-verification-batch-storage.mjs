// All fixture mutations and function creation are rolled back; no provider calls.
import{readFileSync}from'node:fs';import{parseEnv}from'node:util';
const e=parseEnv(readFileSync('.env.local','utf8'));
const migration=readFileSync('supabase/migrations/202609260400_phone_verification_batches.sql','utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'').replace('create function','create or replace function');
const query=`begin; ${migration}
do $$declare r nbc_pilot_rounds; receipt jsonb; used integer; begin
select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' for update;
if has_function_privilege('authenticated','nbc_pilot_claim_phone_batch(uuid,text,text[])','EXECUTE') then raise exception 'role isolation failed';end if;
-- Synthetic state exists only inside this rollback transaction.
update nbc_pilot_operations set state='completed' where round_id=r.id;
update nbc_pilot_phone_checks set state='completed' where round_id=r.id;
update nbc_pilot_rounds set paused=false,settings=jsonb_set(settings,'{verification}',jsonb_build_object('provider','batchdata','unitCents',1,'confirmedAt',now())) where id=r.id;
update nbc_pilot_operations set result=jsonb_set(result,'{rows}','[{"phone10":"3055551234"},{"phone10":"3055551235"},{"phone10":"3055551236"}]'::jsonb) where round_id=r.id and key='roofing-miami';
begin perform nbc_pilot_claim_phone_batch('00000000-0000-4000-8000-000000000000','roofing-miami',array['3055551234']);raise exception 'owner guard failed';exception when others then if sqlerrm<>'pilot_not_found' then raise;end if;end;
begin perform nbc_pilot_claim_phone_batch(r.owner_id,'roofing-miami',array['3055551234','8005551234']);raise exception 'eligibility guard failed';exception when others then if sqlerrm<>'ineligible_phone' then raise;end if;end;
if exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and phone10='3055551234') then raise exception 'partial claim escaped';end if;
begin perform nbc_pilot_claim_phone_batch(r.owner_id,'roofing-miami',array_fill('3055551234'::text,array[11]));raise exception 'batch bound failed';exception when others then if sqlerrm<>'invalid_batch' then raise;end if;end;
select (select coalesce(sum(reserved_cents),0) from nbc_pilot_operations where round_id=r.id)+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id) into used;
update nbc_pilot_operations set reserved_cents=reserved_cents+r.cap_cents-used-2 where round_id=r.id and key='caller-1';
receipt:=nbc_pilot_claim_phone_batch(r.owner_id,'roofing-miami',array['3055551234','3055551234','3055551235','3055551236']);
if receipt->'phones'<>'["3055551234","3055551235"]'::jsonb then raise exception 'budget truncation/dedupe failed';end if;
receipt:=nbc_pilot_claim_phone_batch(r.owner_id,'roofing-miami',array['3055551234','3055551235']);if(receipt->>'acquired')::boolean then raise exception 'replay acquired';end if;
begin perform nbc_pilot_claim_phone_batch(r.owner_id,'roofing-miami',array['3055551236']);raise exception 'pending guard failed';exception when others then if sqlerrm<>'pilot_operation_pending' then raise;end if;end;
perform nbc_pilot_finish_phone(r.owner_id,'3055551234','{"phone10":"3055551234"}'::jsonb);perform nbc_pilot_finish_phone(r.owner_id,'3055551235',null);
begin perform nbc_pilot_claim_phone_batch(r.owner_id,'roofing-miami',array['3055551236']);raise exception 'uncertain guard failed';exception when others then if sqlerrm<>'pilot_operation_pending' then raise;end if;end;
update nbc_pilot_phone_checks set state='completed' where round_id=r.id and phone10='3055551235';
begin perform nbc_pilot_claim_phone_batch(r.owner_id,'roofing-miami',array['3055551236']);raise exception 'budget guard failed';exception when others then if sqlerrm<>'pilot_budget_exceeded' then raise;end if;end;
end $$;rollback;`;
const r=await fetch(`https://api.supabase.com/v1/projects/${e.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error((await r.json()).message??'Storage check failed');console.log('Batch storage checks passed; all changes rolled back; zero provider requests.');
