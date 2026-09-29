import{readFileSync}from'node:fs';import{parseEnv}from'node:util';const e=parseEnv(readFileSync('.env.local','utf8')),sql=readFileSync('supabase/migrations/202609270100_retell_phone_snapshot.sql','utf8').replace(/^begin;/,'').replace(/commit;\s*$/,'');const query=`begin;${sql}
do $$declare owner uuid;k text;snapshot jsonb;begin
select owner_id into owner from nbc_pilot_rounds where id='2026-09-25-first-live-tests';
update nbc_pilot_operations set state='completed' where round_id='2026-09-25-first-live-tests';update nbc_pilot_phone_checks set state='completed' where round_id='2026-09-25-first-live-tests';
update nbc_pilot_rounds set settings=settings||'{"phoneEngine":"retell","retell":{"agentId":"agent_fixture","version":0}}',paused=false where id='2026-09-25-first-live-tests';
k:=nbc_pilot_phone_slot(owner,gen_random_uuid(),'+13055550123',250);
select config into snapshot from nbc_pilot_slots where round_id='2026-09-25-first-live-tests' and key=k;
if snapshot->>'phoneEngine'<>'retell' or snapshot#>>'{retell,agentId}'<>'agent_fixture' then raise exception 'snapshot missing';end if;
update nbc_pilot_rounds set settings=jsonb_set(settings,'{retell,agentId}','"agent_changed"') where id='2026-09-25-first-live-tests';
if exists(select 1 from nbc_pilot_slots where key=k and config#>>'{retell,agentId}'<>'agent_fixture') then raise exception 'snapshot mutated';end if;
if exists(select 1 from nbc_pilot_slots where key='caller-1' and config->>'phoneEngine'='retell') then raise exception 'legacy changed';end if;
end $$;rollback;`;
const r=await fetch(`https://api.supabase.com/v1/projects/${e.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error((await r.json()).message);console.log('Retell snapshot and legacy isolation passed; all changes rolled back.');
