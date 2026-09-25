-- PENDING EXECUTION. Run only on a disposable Supabase/PostgreSQL database named nbc_k01_test.
-- Requires existing auth.users, service_role/anon/authenticated roles and K01 migration applied.
-- psql "$ACADEMY_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/academy-isolated-db.sql
-- Never point this at the shared NBC Caller project. All fixture rows roll back.
begin;
do $$ begin
  if current_database() <> 'nbc_k01_test' then raise exception 'Requires disposable nbc_k01_test database'; end if;
end $$;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
set local role service_role;
select public.academy_save_inventory(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 0, 'K01 DEMO',
  '{"version":1,"courses":[{"id":"c","title":"K01 DEMO","modules":[{"id":"m","title":"Demo module","lessons":[{"id":"l","title":"Demo lesson","videoUrl":"https://videos.example.test/fixture"}]}]}]}',
  '{"label":"K01 DEMO authorized fixture"}'
);
do $$
declare rejected boolean := false;
begin
  begin
    perform public.academy_save_inventory('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 1, 'Foreign overwrite', '{"version":1,"courses":[]}', '{"label":"fixture"}');
  exception when sqlstate 'PT404' then rejected := true;
  end;
  if not rejected then raise exception 'Cross-owner write allowed'; end if;
end $$;
select public.academy_save_inventory('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 1, 'K01 DEMO revision 2', '{"version":1,"courses":[]}', '{"label":"fixture"}');
do $$
declare rejected boolean := false;
begin
  begin
    perform public.academy_save_inventory('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 1, 'Stale overwrite', '{"version":1,"courses":[]}', '{"label":"fixture"}');
  exception when sqlstate 'PT409' then rejected := true;
  end;
  if not rejected then raise exception 'Stale revision accepted'; end if;
  if (select revision from public.academy_inventories where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 2 then raise exception 'Head incorrect'; end if;
  if (select count(*) from public.academy_revisions where inventory_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 2 then raise exception 'History incorrect'; end if;
  if not exists (select 1 from public.academy_sources where inventory_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and revision=1 and lesson_id='l' and transcript_url is null and content_status='pending') then raise exception 'Source snapshot missing'; end if;
  if has_table_privilege('service_role','public.academy_revisions','UPDATE') then raise exception 'Snapshots writable'; end if;
end $$;
reset role;
do $$
declare table_name text; role_name text;
begin
  foreach table_name in array array['academy_inventories','academy_revisions','academy_sources'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||table_name)::regclass) then raise exception 'RLS disabled'; end if;
    foreach role_name in array array['anon','authenticated'] loop
      if has_table_privilege(role_name,'public.'||table_name,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Direct client grant'; end if;
    end loop;
  end loop;
  if has_function_privilege('authenticated','public.academy_save_inventory(uuid,uuid,integer,text,jsonb,jsonb)','EXECUTE') then raise exception 'Client RPC access'; end if;
end $$;
rollback;
-- A real two-connection race still needs two sessions each sending expectedRevision=2.
-- Exactly one must commit revision 3; the other must receive PT409. Sequential stale check above is not that race.
