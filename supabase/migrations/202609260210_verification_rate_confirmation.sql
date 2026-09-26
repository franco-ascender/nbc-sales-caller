begin;
create table public.nbc_pilot_rate_confirmations (
 id uuid primary key default gen_random_uuid(),round_id text not null references public.nbc_pilot_rounds(id),
 owner_id uuid not null references auth.users(id),unit_microusd integer not null check(unit_microusd between 1 and 100000),
 source text not null check(length(source) between 5 and 300),confirmed_at timestamptz not null default now()
);
alter table public.nbc_pilot_rate_confirmations enable row level security;
revoke all on public.nbc_pilot_rate_confirmations from public,anon,authenticated;
grant select,insert on public.nbc_pilot_rate_confirmations to service_role;
create function public.nbc_pilot_set_verification_rate(p_owner uuid,p_unit_microusd integer,p_source text) returns void
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds; begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found';end if;
 if p_unit_microusd is null or p_unit_microusd not between 1 and 100000 or p_source is null or length(trim(p_source)) not between 5 and 300 then raise exception 'invalid_price';end if;
 if exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending';end if;
 insert into nbc_pilot_rate_confirmations(round_id,owner_id,unit_microusd,source) values(r.id,p_owner,p_unit_microusd,trim(p_source));
 update nbc_pilot_rounds set settings=jsonb_set(settings,'{verification}',jsonb_build_object('provider','batchdata','unitCents',ceil(p_unit_microusd::numeric/10000)::integer,'unitMicrousd',p_unit_microusd,'confirmedAt',now(),'source',trim(p_source))) where id=r.id;
end $$;
revoke all on function public.nbc_pilot_set_verification_rate(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.nbc_pilot_set_verification_rate(uuid,integer,text) to service_role;
commit;
