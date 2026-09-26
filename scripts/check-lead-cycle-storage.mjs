// SQL fixtures only. Always rolls back; never calls a discovery/verification provider.
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{parseEnv}from'node:util';
const e=parseEnv(readFileSync('.env.local','utf8'));
const query=`begin;
do $$declare r nbc_pilot_rounds;k text;input jsonb;lease1 uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';lease2 uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';begin
select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' for update;
if has_table_privilege('authenticated','nbc_lead_cycles','SELECT') or has_function_privilege('authenticated','nbc_lead_cycle_create(uuid,uuid,jsonb)','EXECUTE') then raise exception 'isolation failed';end if;
input:='{"name":"Fixture list","industry":"chiropractor","city":"Miami","state":"FL","count":25}';
begin perform nbc_lead_cycle_create('00000000-0000-4000-8000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',input);raise exception 'owner failed';exception when others then if sqlerrm<>'pilot_not_found' then raise;end if;end;
k:=nbc_lead_cycle_create(r.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',input);
if k<>nbc_lead_cycle_create(r.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',input) then raise exception 'replay failed';end if;
if exists(select 1 from nbc_pilot_operations where round_id=r.id and key=k) then raise exception 'creation dispatched';end if;
begin perform nbc_lead_cycle_create(r.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',jsonb_set(input,'{count}','50'));raise exception 'changed request failed';exception when others then if sqlerrm<>'request_conflict' then raise;end if;end;
begin perform nbc_lead_cycle_create(r.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',input);raise exception 'active list guard failed';exception when others then if sqlerrm<>'pilot_operation_pending' then raise;end if;end;
if not nbc_lead_cycle_claim(r.owner_id,k,lease1) then raise exception 'claim failed';end if;
if nbc_lead_cycle_claim(r.owner_id,k,lease2) then raise exception 'second lease acquired';end if;
perform nbc_lead_cycle_control(r.owner_id,k,'pause');
perform nbc_lead_cycle_finish(r.owner_id,k,lease1,'running','filter','Fixture discovery finished');
if not exists(select 1 from nbc_lead_cycles where key=k and status='paused' and phase='filter') then raise exception 'pause overwritten';end if;
if nbc_lead_cycle_claim(r.owner_id,k,lease2) then raise exception 'paused claim acquired';end if;
perform nbc_lead_cycle_control(r.owner_id,k,'resume');
if not nbc_lead_cycle_claim(r.owner_id,k,lease2) then raise exception 'resume claim failed';end if;
begin perform nbc_lead_cycle_finish(r.owner_id,k,lease1,'completed','done','Stale');raise exception 'stale finish accepted';exception when others then if sqlerrm<>'stale_step' then raise;end if;end;
perform nbc_lead_cycle_finish(r.owner_id,k,lease2,'completed','done','Fixture completed');
if not exists(select 1 from nbc_lead_cycles where key=k and status='completed' and finished_at is not null and jsonb_array_length(events)=3) then raise exception 'completion audit failed';end if;
update nbc_pilot_operations set reserved_cents=2499 where round_id=r.id and key='caller-1';
begin perform nbc_lead_cycle_create(r.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',input);raise exception 'budget guard failed';exception when others then if sqlerrm<>'pilot_budget_exceeded' then raise;end if;end;
end $$;
rollback;`;
const r=await fetch(`https://api.supabase.com/v1/projects/${e.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});
if(!r.ok){console.error((await r.json()).message);process.exitCode=1;}else{const report={passed:true,rolledBack:true,providerRequests:0,checks:14};mkdirSync('artifacts/readiness/lead-cycle-20260926',{recursive:true});writeFileSync('artifacts/readiness/lead-cycle-20260926/storage.json',JSON.stringify(report,null,2));console.log(report);}
