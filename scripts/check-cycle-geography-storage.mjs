import{readFileSync}from'node:fs';import{parseEnv}from'node:util';import{CYCLE_NICHES}from'../src/lib/lead-cycle-niches.ts';
const e=parseEnv(readFileSync('.env.local','utf8')),migration=readFileSync('supabase/migrations/202609260600_lead_cycle_geography.sql','utf8');
const sql=`begin;${migration.replace(/^begin;/,'').replace(/commit;\s*$/,'')}
do $$declare r nbc_pilot_rounds;k text;n jsonb;begin
select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' for update;
update nbc_pilot_rounds set paused=false where id=r.id;
update nbc_lead_cycles set status='paused' where round_id=r.id;
update nbc_pilot_operations set state='completed',reserved_cents=1 where round_id=r.id;
update nbc_pilot_phone_checks set state='completed',reserved_cents=1 where round_id=r.id;
for n in select value from jsonb_array_elements('[{"city":"","state":"","scope":"nationwide","location":"United States"},{"city":"","state":"TX","scope":"state","location":"TX, USA"},{"city":"Miami","state":"FL","scope":"city","location":"Miami, FL, USA"}]'::jsonb) loop
k:=nbc_lead_cycle_create(r.owner_id,gen_random_uuid(),jsonb_build_object('industry','roofing','name','Scope fixture','city',n->>'city','state',n->>'state','count',50));
if (select config->>'location' from nbc_pilot_slots where round_id=r.id and key=k) is distinct from n->>'location' or (select config->>'scope' from nbc_pilot_slots where round_id=r.id and key=k) is distinct from n->>'scope' then raise exception 'scope mismatch';end if;
update nbc_lead_cycles set status='paused' where round_id=r.id and key=k;
end loop;
begin perform nbc_lead_cycle_create(r.owner_id,gen_random_uuid(),'{"industry":"roofing","name":"Large","count":5000}');raise exception 'volume gate failed';exception when others then if sqlerrm<>'testing_volume_limit' then raise;end if;end;
begin perform nbc_lead_cycle_create(r.owner_id,gen_random_uuid(),'{"industry":"roofing","name":"City without state","city":"Miami","count":50}');raise exception 'scope gate failed';exception when others then if sqlerrm<>'invalid_list' then raise;end if;end;
end $$;rollback;`;
const r=await fetch(`https://api.supabase.com/v1/projects/${e.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});if(!r.ok)throw Error((await r.json()).message??'Storage assertions failed');console.log('Nationwide/state/city mappings + large-volume and incomplete-scope rejection passed; rolled back; no paid requests.');
