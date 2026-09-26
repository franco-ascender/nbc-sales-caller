begin;
create function public.nbc_pilot_phone_slot(p_owner uuid,p_request uuid,p_destination text) returns text
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds; s nbc_pilot_slots; k text; used integer; today_calls integer;
begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found';end if;
 if p_destination !~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$' or substring(p_destination from 3 for 3) in ('800','833','844','855','866','877','888','900') then raise exception 'invalid_destination';end if;
 k:='dial-'||p_request::text;
 select * into s from nbc_pilot_slots where round_id=r.id and key=k;
 if found then
  if s.config->>'destination' is distinct from p_destination then raise exception 'destination_conflict';end if;
  return k;
 end if;
 if r.paused then raise exception 'pilot_paused';end if;
 if exists(select 1 from nbc_pilot_operations where round_id=r.id and state in ('dispatching','running','uncertain')) or exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending';end if;
 select count(*) into today_calls from nbc_pilot_operations o join nbc_pilot_slots s on s.round_id=o.round_id and s.key=o.key where o.round_id=r.id and s.kind='phone' and o.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 if today_calls>=2 then raise exception 'phone_daily_limit';end if;
 select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
 used:=used+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id);
 if used+250>r.cap_cents then raise exception 'pilot_budget_exceeded';end if;
 insert into nbc_pilot_slots(round_id,key,kind,title,allocation_cents,reserve_cents,config) values(r.id,k,'phone','Phone trial · ending '||right(p_destination,4),250,250,jsonb_build_object('destination',p_destination,'scenario','Nalify / Garage Door Business Owner'));
 return k;
end $$;
-- Enforce the daily phone guard at reservation time too (preflight/slot creation can run concurrently).
create function public.nbc_pilot_daily_phone_guard() returns trigger language plpgsql security invoker set search_path=public as $$
declare count_today integer;begin
 if exists(select 1 from nbc_pilot_slots where round_id=new.round_id and key=new.key and kind='phone') then
  perform 1 from nbc_pilot_rounds where id=new.round_id for update;
  select count(*) into count_today from nbc_pilot_operations o join nbc_pilot_slots s on s.round_id=o.round_id and s.key=o.key where o.round_id=new.round_id and s.kind='phone' and o.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  if count_today>=2 then raise exception 'phone_daily_limit';end if;
 end if;return new;end $$;
create trigger nbc_pilot_daily_phone_limit before insert on public.nbc_pilot_operations for each row execute function public.nbc_pilot_daily_phone_guard();
revoke all on function public.nbc_pilot_phone_slot(uuid,uuid,text),public.nbc_pilot_daily_phone_guard() from public,anon,authenticated;
grant execute on function public.nbc_pilot_phone_slot(uuid,uuid,text),public.nbc_pilot_daily_phone_guard() to service_role;
commit;
