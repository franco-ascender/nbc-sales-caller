-- Run only in a disposable database with minimal auth.users and Supabase roles,
-- after applying 202609140030_members.sql. Never run on the shared project.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.nbc_members(id,display_name,role) values ('00000000-0000-4000-8000-000000000001','TEST admin','admin'),('00000000-0000-4000-8000-000000000002','TEST student','student');
set local role service_role;
select public.nbc_credit_apply('grant','00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',100,'TEST allocation','00000000-0000-4000-8000-000000000001');
select public.nbc_credit_apply('grant','00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',100,'TEST allocation','00000000-0000-4000-8000-000000000001');
do $$ begin
 if (select balance from public.nbc_credit_wallets where member_id='00000000-0000-4000-8000-000000000002') <>100 then raise exception 'duplicate grant'; end if;
 begin
  perform public.nbc_credit_apply('grant','00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',10,'forbidden','00000000-0000-4000-8000-000000000002');
  raise exception 'student grant accepted';
 exception when insufficient_privilege then null; end;
end $$;
select public.nbc_credit_apply('reserve','00000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',70,'TEST usage','00000000-0000-4000-8000-000000000002');
do $$ begin
 begin
  perform public.nbc_credit_apply('reserve','00000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',40,'TEST excessive','00000000-0000-4000-8000-000000000002');
  raise exception 'overdraw accepted' using errcode='23514';
 exception when raise_exception then if sqlerrm<>'insufficient_credits' then raise; end if; end;
end $$;
select public.nbc_credit_apply('settle','00000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',50,'ignored','00000000-0000-4000-8000-000000000002');
select public.nbc_credit_apply('settle','00000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',50,'ignored','00000000-0000-4000-8000-000000000002');
do $$ begin
 if not exists(select 1 from public.nbc_credit_wallets where member_id='00000000-0000-4000-8000-000000000002' and balance=50 and reserved=0) then raise exception 'settlement invariant'; end if;
 if (select count(*) from public.nbc_credit_entries where member_id='00000000-0000-4000-8000-000000000002')<>2 then raise exception 'ledger duplicate'; end if;
end $$;
select public.nbc_credit_apply('reserve','00000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',20,'TEST failure','00000000-0000-4000-8000-000000000002');
select public.nbc_credit_apply('release','00000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',0,'ignored','00000000-0000-4000-8000-000000000002');
select public.nbc_credit_apply('release','00000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',0,'ignored','00000000-0000-4000-8000-000000000002');
reset role;
do $$ declare t text; begin
 foreach t in array array['nbc_members','nbc_onboarding','nbc_calendar','nbc_messages','nbc_tickets','nbc_credit_wallets','nbc_credit_operations','nbc_credit_entries'] loop
  if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS disabled: %',t; end if;
  if has_table_privilege('anon','public.'||t,'SELECT') or has_table_privilege('authenticated','public.'||t,'SELECT') then raise exception 'direct access: %',t; end if;
 end loop;
 if has_function_privilege('authenticated','public.nbc_credit_apply(text,uuid,uuid,bigint,text,uuid)','EXECUTE') then raise exception 'client can change credits'; end if;
end $$;
rollback;
-- Required additional integration test: two independent connections reserve 70
-- concurrently against a 100-credit wallet: exactly one succeeds. This file's
-- single transaction does not claim to verify concurrency or PostgREST/Auth.
