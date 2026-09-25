-- C02: proposed; apply only through coordinated integration. No automatic calling.
begin;
create table if not exists public.caller_leads (
 id uuid primary key default gen_random_uuid(),
 operator_id uuid not null references auth.users(id),
 name text not null check (char_length(name) between 1 and 160),
 phone text not null check (phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'),
 email text not null default '' check (char_length(email) <= 254),
 company text not null default '' check (char_length(company) <= 160),
 source text not null default 'CSV import' check (char_length(source) <= 120),
 stage text not null default 'new' check (stage in ('new','queued','contacted','qualified','booked','won','lost','do_not_call')),
 notes text not null default '' check (char_length(notes) <= 4000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(operator_id,phone)
);
create index if not exists caller_leads_owner_created_idx on public.caller_leads(operator_id,created_at desc,id desc);
create table if not exists public.caller_imports (
 operator_id uuid not null references auth.users(id), request_id uuid not null,
 fingerprint text not null, imported integer not null default 0, duplicates integer not null default 0,
 created_at timestamptz not null default now(), primary key(operator_id,request_id)
);
create table if not exists public.caller_voice_jobs (
 id uuid primary key, operator_id uuid not null references auth.users(id),
 name text not null check(char_length(name) between 1 and 80),
 description text not null check(char_length(description) between 20 and 1000),
 status text not null default 'preparing' check(status in ('preparing','completed','uncertain')),
 voice_id text, created_at timestamptz not null default now()
);
alter table public.caller_leads enable row level security;
alter table public.caller_imports enable row level security;
alter table public.caller_voice_jobs enable row level security;
revoke all on public.caller_leads,public.caller_imports,public.caller_voice_jobs from public,anon,authenticated;
grant select,insert,update on public.caller_leads,public.caller_imports,public.caller_voice_jobs to service_role;
create or replace function public.caller_import_leads(p_operator uuid,p_request uuid,p_leads jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_old caller_imports%rowtype; v_count integer; v_added integer; v_hash text;
begin
 if jsonb_typeof(p_leads) <> 'array' then raise exception 'invalid_import'; end if;
 v_count := jsonb_array_length(p_leads);
 if v_count < 1 or v_count > 500 then raise exception 'invalid_import'; end if;
 v_hash := md5(p_leads::text);
 -- Single-owner lock serializes duplicate imports without an external side effect.
 perform pg_advisory_xact_lock(hashtextextended(p_operator::text,0));
 select * into v_old from caller_imports where operator_id=p_operator and request_id=p_request;
 if found then
  if v_old.fingerprint <> v_hash then raise exception 'import_conflict'; end if;
  return jsonb_build_object('imported',v_old.imported,'duplicates',v_old.duplicates,'replayed',true);
 end if;
 insert into caller_leads(operator_id,name,phone,email,company,source)
 select p_operator,x.name,x.phone,coalesce(x.email,''),coalesce(x.company,''),coalesce(x.source,'CSV import')
 from jsonb_to_recordset(p_leads) as x(name text,phone text,email text,company text,source text)
 on conflict (operator_id,phone) do nothing;
 get diagnostics v_added = row_count;
 insert into caller_imports(operator_id,request_id,fingerprint,imported,duplicates) values(p_operator,p_request,v_hash,v_added,v_count-v_added);
 return jsonb_build_object('imported',v_added,'duplicates',v_count-v_added,'replayed',false);
end;
$$;
revoke all on function public.caller_import_leads(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.caller_import_leads(uuid,uuid,jsonb) to service_role;
commit;
-- No rollback is automatically executed. DROP requires review/backups if data exists.
