// Rollback-only financial authorization checks. No paid provider requests.
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{parseEnv}from'node:util';const e=parseEnv(readFileSync('.env.local','utf8')),migration=readFileSync('supabase/migrations/202609260900_per_operation_approval.sql','utf8').replace(/^begin;/,'').replace(/commit;\s*$/,'');
const query=`begin;${migration}
do $$declare r nbc_pilot_rounds;k text;receipt jsonb;begin
select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' for update;
update nbc_pilot_rounds set settings=settings||'{"perOperationApproval":true}'::jsonb,paused=false where id=r.id;
update nbc_lead_cycles set status='paused' where round_id=r.id;
update nbc_pilot_operations set state='completed',reserved_cents=2600 where round_id=r.id;
update nbc_pilot_phone_checks set state='completed' where round_id=r.id;
if has_function_privilege('authenticated','nbc_pilot_approve_slot(uuid,text,text,integer)','EXECUTE') then raise exception 'role leak';end if;
begin perform nbc_pilot_phone_slot(r.owner_id,gen_random_uuid(),'+13055550123',null);raise exception 'missing phone approval accepted';exception when others then if sqlerrm<>'approval_required' then raise;end if;end;
begin perform nbc_pilot_phone_slot(r.owner_id,gen_random_uuid(),'+13055550123',1);raise exception 'underquote accepted';exception when others then if sqlerrm<>'approval_required' then raise;end if;end;
k:=nbc_pilot_phone_slot(r.owner_id,gen_random_uuid(),'+13055550123',250);
receipt:=nbc_pilot_reserve(r.owner_id,k);if not(receipt->>'acquired')::boolean then raise exception 'old cap still blocks';end if;
receipt:=nbc_pilot_reserve(r.owner_id,k);if(receipt->>'acquired')::boolean then raise exception 'duplicate charged';end if;
update nbc_pilot_operations set state='completed' where round_id=r.id and key=k;
update nbc_pilot_rounds set settings=jsonb_set(settings,'{verification}',jsonb_build_object('provider','batchdata','unitCents',1,'confirmedAt',now())) where id=r.id;
begin perform nbc_lead_cycle_create(r.owner_id,gen_random_uuid(),'{"industry":"roofing","name":"Fixture","count":50}');raise exception 'missing list approval accepted';exception when others then if sqlerrm<>'approval_required' then raise;end if;end;
k:=nbc_lead_cycle_create(r.owner_id,gen_random_uuid(),'{"industry":"roofing","name":"Fixture","count":50,"approvedMaxCents":125}');
if(select config->>'approvedCeilingCents' from nbc_pilot_slots where round_id=r.id and key=k)<>'125' then raise exception 'quote not saved';end if;
perform nbc_pilot_reserve(r.owner_id,k);
update nbc_pilot_operations set state='completed',result='{"rows":[{"phone10":"3055551234"},{"phone10":"3055551235"}]}' where round_id=r.id and key=k;
receipt:=nbc_pilot_claim_phone_batch(r.owner_id,k,array['3055551234','3055551235']);if jsonb_array_length(receipt->'phones')<>2 then raise exception 'batch blocked by old cap';end if;
perform nbc_pilot_finish_phone(r.owner_id,'3055551234','{"phone10":"3055551234"}');perform nbc_pilot_finish_phone(r.owner_id,'3055551235','{"phone10":"3055551235"}');
update nbc_pilot_slots set config=config-'approvedCeilingCents' where round_id=r.id and key=k;
update nbc_pilot_operations set result='{"rows":[{"phone10":"3055551236"}]}' where round_id=r.id and key=k;
begin perform nbc_pilot_claim_phone_batch(r.owner_id,k,array['3055551236']);raise exception 'unapproved check accepted';exception when others then if sqlerrm<>'approval_required' then raise;end if;end;
begin perform nbc_pilot_approve_slot(r.owner_id,k,'verify',2);raise exception 'stale cost accepted';exception when others then if sqlerrm<>'approval_required' then raise;end if;end;
perform nbc_pilot_approve_slot(r.owner_id,k,'verify',1);perform nbc_pilot_claim_phone_batch(r.owner_id,k,array['3055551236']);
if(select cap_cents from nbc_pilot_rounds where id=r.id)<>2500 then raise exception 'historical cap rewritten';end if;
end $$;rollback;`;
const r=await fetch(`https://api.supabase.com/v1/projects/${e.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error((await r.json()).message??'Assertions failed');mkdirSync('artifacts/readiness/per-operation-approval',{recursive:true});writeFileSync('artifacts/readiness/per-operation-approval/storage.json',JSON.stringify({passed:true,rolledBack:true,providerRequests:0}));console.log('Per-operation storage assertions passed, rolled back, no provider requests.');
