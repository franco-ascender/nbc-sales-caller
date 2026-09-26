begin;
create table public.nbc_pilot_phone_checks (
 round_id text not null references public.nbc_pilot_rounds(id),
 phone10 text not null check(phone10 ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'),
 slot_key text not null, state text not null check(state in ('dispatching','completed','uncertain')),
 reserved_cents integer not null check(reserved_cents>0), verification jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(round_id,phone10), foreign key(round_id,slot_key) references public.nbc_pilot_slots(round_id,key)
);
alter table public.nbc_pilot_phone_checks enable row level security;
revoke all on public.nbc_pilot_phone_checks from public,anon,authenticated;
grant select,insert,update on public.nbc_pilot_phone_checks to service_role;

-- Reuse the same round lock and cumulative budget for discovery, calls and verification.
create or replace function public.nbc_pilot_reserve(p_owner uuid,p_key text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds; s nbc_pilot_slots; o nbc_pilot_operations; used bigint;
begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found'; end if;
 select * into s from nbc_pilot_slots where round_id=r.id and key=p_key;
 if not found then raise exception 'invalid_slot'; end if;
 select * into o from nbc_pilot_operations where round_id=r.id and key=p_key;
 if found then return jsonb_build_object('acquired',false,'operation',to_jsonb(o)); end if;
 if r.paused then raise exception 'pilot_paused'; end if;
 if exists(select 1 from nbc_pilot_operations where round_id=r.id and state in ('dispatching','running','uncertain')) or exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending'; end if;
 select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
 used:=used+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id);
 if used+s.reserve_cents>r.cap_cents then raise exception 'pilot_budget_exceeded'; end if;
 insert into nbc_pilot_operations(round_id,key,state,reserved_cents) values(r.id,p_key,'dispatching',s.reserve_cents) returning * into o;
 return jsonb_build_object('acquired',true,'operation',to_jsonb(o));
end $$;

create function public.nbc_pilot_claim_phone(p_owner uuid,p_key text,p_phone text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds; s nbc_pilot_slots; o nbc_pilot_operations; c nbc_pilot_phone_checks; unit integer; used bigint; allocated bigint;
begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found'; end if;
 select * into c from nbc_pilot_phone_checks where round_id=r.id and phone10=p_phone;
 if found then return jsonb_build_object('acquired',false,'check',to_jsonb(c)); end if;
 if r.paused then raise exception 'pilot_paused'; end if;
 unit:=(r.settings->'verification'->>'unitCents')::integer;
 if unit is null or unit<1 or unit>10 or coalesce(r.settings->'verification'->>'provider','')<>'batchdata' or coalesce((r.settings->'verification'->>'confirmedAt')::timestamptz,'epoch')<now()-interval '30 days' or (r.settings->'verification'->>'confirmedAt')::timestamptz>now() then raise exception 'verification_pricing_required'; end if;
 if exists(select 1 from nbc_pilot_operations where round_id=r.id and state in ('dispatching','running','uncertain')) or exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending'; end if;
 select * into s from nbc_pilot_slots where round_id=r.id and key=p_key and kind='scrape';
 select * into o from nbc_pilot_operations where round_id=r.id and key=p_key and state='completed';
 if s.key is null or o.key is null then raise exception 'discovery_required'; end if;
 if p_phone !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' or left(p_phone,3) in ('800','833','844','855','866','877','888') or not exists(select 1 from jsonb_array_elements(o.result->'rows') row where row->>'phone10'=p_phone and row->>'rejection' is null and row->>'chain' is null and coalesce((row->>'duplicate')::boolean,false)=false) then raise exception 'ineligible_phone'; end if;
 select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
 used:=used+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id);
 allocated:=o.reserved_cents+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id and slot_key=p_key);
 if used+unit>r.cap_cents or allocated+unit>s.allocation_cents then raise exception 'pilot_budget_exceeded'; end if;
 insert into nbc_pilot_phone_checks(round_id,phone10,slot_key,state,reserved_cents) values(r.id,p_phone,p_key,'dispatching',unit) returning * into c;
 return jsonb_build_object('acquired',true,'check',to_jsonb(c));
end $$;

create function public.nbc_pilot_finish_phone(p_owner uuid,p_phone text,p_verification jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds;
begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found'; end if;
 if p_verification is not null and p_verification->>'phone10' is distinct from p_phone then raise exception 'phone_mismatch'; end if;
 update nbc_pilot_phone_checks set state=case when p_verification is null then 'uncertain' else 'completed' end,verification=p_verification,updated_at=now() where round_id=r.id and phone10=p_phone and state='dispatching';
 if not found then raise exception 'pilot_stale'; end if;
end $$;
revoke all on function public.nbc_pilot_claim_phone(uuid,text,text),public.nbc_pilot_finish_phone(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nbc_pilot_claim_phone(uuid,text,text),public.nbc_pilot_finish_phone(uuid,text,jsonb) to service_role;
commit;
