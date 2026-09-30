// Database-only regression: installs candidate functions and fixtures in a
// transaction which is ALWAYS rolled back. Never calls a paid provider.
import {loadEnvFile} from 'node:process';import{readFileSync}from'node:fs';loadEnvFile('.env.local');
const migration=readFileSync('supabase/migrations/202609300200_lead_search_quotes.sql','utf8').replace(/^begin;/,'').replace(/commit;\s*$/,'');
const query=`begin;${migration}
do $$
declare owner uuid;r text:='2026-09-25-first-live-tests';req uuid:=gen_random_uuid();k text;unit integer;total integer;b jsonb;claim jsonb;folder uuid:=gen_random_uuid();begin
 select owner_id,(settings#>>'{verification,unitCents}')::integer into strict owner,unit from nbc_pilot_rounds where id=r;
 total:=2005+5000*unit;
 b:=jsonb_build_object('name','Rollback 5000 fixture','industry','roofing','city','','state','','count',5000,'approvedMaxCents',total,'quote',jsonb_build_object('maximumCents',total,'discoveryReserveCents',2005,'discoveryCapCents',2002,'verificationUnitCents',unit,'expiresAt',now()+interval '15 minutes'));
 if has_function_privilege('authenticated','nbc_portal_scrape_reserve(uuid,text)','execute') or has_function_privilege('authenticated','nbc_lead_run_move(uuid,text,uuid)','execute') then raise exception 'public mutation access';end if;
 begin perform nbc_lead_cycle_create(owner,gen_random_uuid(),b||'{"count":5001}'::jsonb);raise exception 'oversized list accepted';exception when others then if sqlerrm<>'invalid_list' then raise;end if;end;
 begin perform nbc_lead_cycle_create(owner,gen_random_uuid(),b||'{"approvedMaxCents":1}'::jsonb);raise exception 'underapproved accepted';exception when others then if sqlerrm<>'approval_required' then raise;end if;end;
 begin perform nbc_lead_cycle_create(owner,gen_random_uuid(),jsonb_set(b,'{quote,expiresAt}',to_jsonb(now()-interval '1 minute')));raise exception 'expired accepted';exception when others then if sqlerrm<>'approval_required' then raise;end if;end;
 k:=nbc_lead_cycle_create(owner,req,b);
 if nbc_lead_cycle_create(owner,req,b)<>k then raise exception 'non-idempotent';end if;
 if not exists(select 1 from nbc_pilot_slots where round_id=r and key=k and allocation_cents=total and reserve_cents=2005 and config->>'discoveryCapCents'='2002') then raise exception 'cost mismatch';end if;
 insert into lead_engine_folders(id,operator_id,name) values(folder,owner,'Rollback folder '||folder::text);
 perform nbc_lead_run_move(owner,k,folder);
 if not exists(select 1 from nbc_pilot_slots where round_id=r and key=k and config->>'folderId'=folder::text) then raise exception 'move failed';end if;
 begin perform nbc_lead_run_move(gen_random_uuid(),k,folder);raise exception 'wrong owner moved list';exception when others then if sqlerrm<>'pilot_not_found' then raise;end if;end;
 begin perform nbc_lead_run_move(owner,k,gen_random_uuid());raise exception 'unknown folder accepted';exception when others then if sqlerrm<>'folder_not_found' then raise;end if;end;
 claim:=nbc_portal_scrape_reserve(owner,k);if not (claim->>'acquired')::boolean then raise exception 'reservation failed';end if;
 if (nbc_portal_scrape_reserve(owner,k)->>'acquired')::boolean then raise exception 'double reservation';end if;
end $$;rollback;`;
const r=await fetch('https://api.supabase.com/v1/projects/'+process.env.SUPABASE_PROJECT_REF+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});const b=await r.json();if(!r.ok)throw Error(JSON.stringify(b));console.log('PASS: 5,000 businesses, signed-quote allocation, expiry, underapproval, duplicate prevention, private folders and move ownership. All writes rolled back; no provider calls.');
