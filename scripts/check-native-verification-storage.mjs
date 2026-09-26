// Transactional DB assertions only. Always rolls back. No provider requests or real verification.
import{readFileSync,writeFileSync}from'node:fs';import{parseEnv}from'node:util';
const e=parseEnv(readFileSync('.env.local','utf8'));
const query=`begin;
do $$declare r nbc_pilot_rounds; receipt jsonb; begin
select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' for update;
if has_table_privilege('authenticated','nbc_pilot_phone_checks','SELECT') or has_function_privilege('authenticated','nbc_pilot_claim_phone(uuid,text,text)','EXECUTE') then raise exception 'role isolation failed'; end if;
update nbc_pilot_rounds set settings=settings-'verification' where id=r.id;
begin perform nbc_pilot_claim_phone(r.owner_id,'roofing-miami','3055551234');raise exception 'price guard failed';exception when others then if sqlerrm<>'verification_pricing_required' then raise;end if;end;
begin perform nbc_pilot_claim_phone('00000000-0000-4000-8000-000000000000','roofing-miami','3055551234');raise exception 'owner guard failed';exception when others then if sqlerrm<>'pilot_not_found' then raise;end if;end;
update nbc_pilot_rounds set settings=jsonb_set(settings,'{verification}',jsonb_build_object('provider','batchdata','unitCents',1,'confirmedAt',now())) where id=r.id;
update nbc_pilot_operations set result=jsonb_set(result,'{rows}',coalesce(result->'rows','[]')||'[{"name":"Fixture","phone10":"3055551234","rejection":null,"duplicate":false,"chain":null},{"name":"Other","phone10":"3055551235","rejection":null,"duplicate":false,"chain":null}]'::jsonb) where round_id=r.id and key='roofing-miami';
begin perform nbc_pilot_claim_phone(r.owner_id,'roofing-miami','8005551234');raise exception 'filter guard failed';exception when others then if sqlerrm<>'ineligible_phone' then raise;end if;end;
receipt:=nbc_pilot_claim_phone(r.owner_id,'roofing-miami','3055551234');if not(receipt->>'acquired')::boolean then raise exception 'claim failed';end if;
receipt:=nbc_pilot_claim_phone(r.owner_id,'roofing-miami','3055551234');if(receipt->>'acquired')::boolean then raise exception 'duplicate acquired';end if;
begin perform nbc_pilot_reserve(r.owner_id,'medspa-miami');raise exception 'shared active guard failed';exception when others then if sqlerrm<>'pilot_operation_pending' then raise;end if;end;
perform nbc_pilot_finish_phone(r.owner_id,'3055551234',null);
begin perform nbc_pilot_claim_phone(r.owner_id,'roofing-miami','3055551235');raise exception 'uncertain guard failed';exception when others then if sqlerrm<>'pilot_operation_pending' then raise;end if;end;
update nbc_pilot_phone_checks set state='completed' where round_id=r.id and phone10='3055551234';
update nbc_pilot_operations set reserved_cents=2499 where round_id=r.id and key='caller-1';
begin perform nbc_pilot_claim_phone(r.owner_id,'roofing-miami','3055551235');raise exception 'budget guard failed';exception when others then if sqlerrm<>'pilot_budget_exceeded' then raise;end if;end;
end $$;
rollback;`;
const r=await fetch(`https://api.supabase.com/v1/projects/${e.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});
if(!r.ok){const body=await r.json();console.error(body.message??'Storage assertions failed');process.exitCode=1;}else{const report={passed:true,checks:9,rolledBack:true,paidRequests:0,at:new Date().toISOString()};writeFileSync('artifacts/readiness/feedback-20260926/verification-storage.json',JSON.stringify(report,null,2));console.log(report);}
