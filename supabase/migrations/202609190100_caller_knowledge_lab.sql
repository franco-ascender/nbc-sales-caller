-- C09 migration. Applied to the connected project on 2026-09-19.
create table if not exists public.caller_knowledge_sources (
 id uuid primary key,
 request_id uuid not null,
 created_by uuid not null references auth.users(id),
 title text not null check(char_length(trim(title)) between 1 and 140),
 kind text not null check(kind in ('call_audio','transcript','playbook')),
 status text not null check(status in ('uploading','uploaded','transcribing','review','approved','syncing','sync_unknown','synced','failed','archived')),
 context text not null default '' check(char_length(context)<=1000),
 authorization_confirmed boolean not null check(authorization_confirmed),
 storage_path text unique,
 file_name text,
 mime_type text,
 size_bytes bigint check(size_bytes is null or size_bytes between 1024 and 262144000),
 content_hash text check(content_hash is null or char_length(content_hash)=64),
 transcript text check(transcript is null or char_length(transcript)<=120000),
 provider_document_id text unique,
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 failure_code text,
 retain_audio boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(created_by,request_id),
 check((kind='call_audio')=(storage_path is not null)),
 check((status not in ('approved','syncing','sync_unknown','synced')) or (transcript is not null and approved_by is not null and approved_at is not null))
);
create index if not exists caller_knowledge_status_created_idx on public.caller_knowledge_sources(status,created_at desc);

create table if not exists public.caller_conversation_scenarios (
 id uuid primary key,
 request_id uuid not null,
 created_by uuid not null references auth.users(id),
 title text not null check(char_length(trim(title)) between 1 and 100),
 conversation_type text not null check(conversation_type in ('outbound_prospecting','inbound_sales','discovery','closing','follow_up','objection_practice','custom')),
 brief jsonb not null check(jsonb_typeof(brief)='object'),
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(created_by,request_id)
);
create index if not exists caller_scenarios_creator_created_idx on public.caller_conversation_scenarios(created_by,created_at desc);

alter table public.call_sessions
 add column if not exists scenario_title text check(scenario_title is null or char_length(trim(scenario_title)) between 1 and 100),
 add column if not exists scenario_type text check(scenario_type is null or scenario_type in ('outbound_prospecting','inbound_sales','discovery','closing','follow_up','objection_practice','custom')),
 add column if not exists scenario_brief jsonb check(scenario_brief is null or jsonb_typeof(scenario_brief)='object');

alter table public.caller_knowledge_sources enable row level security;
alter table public.caller_conversation_scenarios enable row level security;
revoke all on public.caller_knowledge_sources,public.caller_conversation_scenarios from public,anon,authenticated;
grant select,insert,update,delete on public.caller_knowledge_sources,public.caller_conversation_scenarios to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('caller-knowledge','caller-knowledge',false,262144000,array['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/webm','audio/ogg','video/webm'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

do $$ begin
 if exists(select 1 from storage.buckets where id='caller-knowledge' and public) then raise exception 'caller-knowledge must remain private'; end if;
end $$;

create or replace function public.caller_knowledge_updated_at() returns trigger language plpgsql security invoker set search_path=public as $$
begin new.updated_at=clock_timestamp(); return new; end;
$$;
drop trigger if exists caller_knowledge_sources_updated_at on public.caller_knowledge_sources;
create trigger caller_knowledge_sources_updated_at before update on public.caller_knowledge_sources for each row execute function public.caller_knowledge_updated_at();
drop trigger if exists caller_conversation_scenarios_updated_at on public.caller_conversation_scenarios;
create trigger caller_conversation_scenarios_updated_at before update on public.caller_conversation_scenarios for each row execute function public.caller_knowledge_updated_at();
