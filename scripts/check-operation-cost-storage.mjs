import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{parseEnv}from'node:util';const e=parseEnv(readFileSync('.env.local','utf8'));const sql=readFileSync('supabase/migrations/202609261000_verification_rate_snapshot.sql','utf8').replace(/^begin;/,'').replace(/commit;\s*$/,'');const query=`begin;${sql}
do $$declare k text;v bigint;begin
 select key into k from nbc_pilot_slots where round_id='2026-09-25-first-live-tests' and kind='scrape' limit 1;
 update nbc_pilot_rounds set settings=jsonb_set(settings,'{verification}',jsonb_build_object('provider','batchdata','unitMicrousd',7000,'unitCents',1,'source','fixture','confirmedAt',now())) where id='2026-09-25-first-live-tests';
 insert into nbc_pilot_phone_checks(round_id,slot_key,phone10,state,reserved_cents) values('2026-09-25-first-live-tests',k,'3055550101','dispatching',1);
 select rate_microusd into v from nbc_pilot_phone_checks where phone10='3055550101';if v<>7000 or v is null then raise exception 'rate not captured';end if;
 update nbc_pilot_rounds set settings=jsonb_set(settings,'{verification,unitMicrousd}','9000') where id='2026-09-25-first-live-tests';
 update nbc_pilot_phone_checks set state='completed' where phone10='3055550101';
 select rate_microusd into v from nbc_pilot_phone_checks where phone10='3055550101';if v<>7000 then raise exception 'historical rate changed';end if;
 update nbc_pilot_rounds set settings=settings-'verification' where id='2026-09-25-first-live-tests';
 insert into nbc_pilot_phone_checks(round_id,slot_key,phone10,state,reserved_cents) values('2026-09-25-first-live-tests',k,'3055550102','dispatching',1);
 if exists(select 1 from nbc_pilot_phone_checks where phone10='3055550102' and rate_microusd is not null) then raise exception 'invented rate';end if;
 if has_table_privilege('authenticated','nbc_pilot_phone_checks','SELECT') then raise exception 'private data exposed';end if;
end $$;rollback;`;
const r=await fetch(`https://api.supabase.com/v1/projects/${e.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error((await r.json()).message);mkdirSync('artifacts/readiness/operation-costs',{recursive:true});writeFileSync('artifacts/readiness/operation-costs/storage.json',JSON.stringify({passed:true,rolledBack:true,paidActions:0}));console.log('Rate snapshot, immutable historical estimate and role isolation passed; rolled back.');
