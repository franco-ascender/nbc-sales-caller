-- K01 proposed migration. Do not apply to shared Supabase from this lane.
begin;
create table if not exists public.academy_inventories (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  revision integer not null check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create table if not exists public.academy_revisions (
  inventory_id uuid not null,
  owner_id uuid not null,
  revision integer not null check (revision >= 1),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object' and manifest->>'version' in ('1', '2') and jsonb_typeof(manifest->'courses') = 'array' and octet_length(manifest::text) <= 2097152),
  origin jsonb not null check (jsonb_typeof(origin) = 'object' and char_length(origin->>'label') between 1 and 160),
  created_at timestamptz not null default now(),
  primary key (inventory_id, revision),
  foreign key (inventory_id, owner_id) references public.academy_inventories(id, owner_id)
);
create table if not exists public.academy_sources (
  inventory_id uuid not null,
  revision integer not null,
  course_id text not null,
  module_id text not null,
  lesson_id text not null,
  video_url text check (video_url is null or (video_url like 'https://%' and char_length(video_url) <= 2048)),
  transcript_url text check (transcript_url is null),
  content_status text not null default 'pending' check (content_status = 'pending'),
  primary key (inventory_id, revision, lesson_id),
  foreign key (inventory_id, revision) references public.academy_revisions(inventory_id, revision)
);
create index if not exists academy_owner_created_idx on public.academy_inventories(owner_id, created_at desc, id desc);
create index if not exists academy_revision_owner_idx on public.academy_revisions(owner_id, inventory_id, revision desc);
alter table public.academy_inventories enable row level security;
alter table public.academy_revisions enable row level security;
alter table public.academy_sources enable row level security;
-- No direct client policies: all requests go through requireAcademyAdmin + owner filters.
revoke all on public.academy_inventories, public.academy_revisions, public.academy_sources from public, anon, authenticated, service_role;
grant select, insert, update on public.academy_inventories to service_role;
grant select, insert on public.academy_revisions, public.academy_sources to service_role;

create or replace function public.academy_save_inventory(
  p_id uuid, p_owner uuid, p_expected integer, p_name text, p_manifest jsonb, p_origin jsonb
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  head public.academy_inventories%rowtype;
  next_revision integer;
begin
  if p_expected is null or p_expected < 0 or p_expected > 2147483646 then
    raise exception using errcode = '22023', message = 'invalid revision';
  end if;
  if p_expected = 0 then
    insert into public.academy_inventories(id, owner_id, name, revision)
      values(p_id, p_owner, p_name, 1) on conflict (id) do nothing;
    if not found then
      select * into head from public.academy_inventories where id = p_id for update;
      if head.owner_id is distinct from p_owner then raise exception using errcode = 'PT404', message = 'not found'; end if;
      raise exception using errcode = 'PT409', message = 'revision conflict';
    end if;
    next_revision := 1;
  else
    select * into head from public.academy_inventories where id = p_id and owner_id = p_owner for update;
    if not found then raise exception using errcode = 'PT404', message = 'not found'; end if;
    if head.revision <> p_expected then raise exception using errcode = 'PT409', message = 'revision conflict'; end if;
    next_revision := p_expected + 1;
    update public.academy_inventories set name = p_name, revision = next_revision, updated_at = now()
      where id = p_id and owner_id = p_owner;
  end if;
  insert into public.academy_revisions(inventory_id, owner_id, revision, name, manifest, origin)
    values(p_id, p_owner, next_revision, p_name, p_manifest, p_origin);
  insert into public.academy_sources(inventory_id, revision, course_id, module_id, lesson_id, video_url)
    select p_id, next_revision, c->>'id', m->>'id', l->>'id', l->>'videoUrl'
    from jsonb_array_elements(p_manifest->'courses') c
    cross join lateral jsonb_array_elements(c->'modules') m
    cross join lateral jsonb_array_elements(m->'lessons') l;
  select * into head from public.academy_inventories where id = p_id and owner_id = p_owner;
  return jsonb_build_object('id', head.id, 'name', head.name, 'revision', head.revision,
    'createdAt', head.created_at, 'updatedAt', head.updated_at, 'manifest', p_manifest, 'origin', p_origin);
end;
$$;
revoke all on function public.academy_save_inventory(uuid, uuid, integer, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.academy_save_inventory(uuid, uuid, integer, text, jsonb, jsonb) to service_role;
-- K01-r6: private raster covers. No anon/authenticated policies are added.
-- Existing Storage RLS remains enabled; only the server service role uses this bucket.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('academy-covers', 'academy-covers', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id = 'academy-covers' and public) then
    raise exception 'academy-covers must remain private';
  end if;
end $$;
commit;
-- Rollback only after review/backups: drop function academy_save_inventory(uuid,uuid,integer,text,jsonb,jsonb);
-- Then drop academy_sources, academy_revisions, academy_inventories in this order. Never automatic.
