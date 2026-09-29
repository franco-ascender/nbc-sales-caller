begin;
alter table public.nbc_pilot_phone_checks add column if not exists rate_microusd bigint check(rate_microusd between 0 and 100000), add column if not exists rate_source text, add column if not exists rate_confirmed_at timestamptz;
create or replace function public.nbc_pilot_snapshot_verification_rate() returns trigger language plpgsql security invoker set search_path=public as $$
declare price jsonb;amount bigint;begin
 select settings->'verification' into price from nbc_pilot_rounds where id=new.round_id;
 if price->>'provider'='batchdata' and price->>'unitMicrousd' ~ '^[0-9]+$' then
  amount:=(price->>'unitMicrousd')::bigint;
  if amount between 0 and 100000 and amount<=new.reserved_cents*10000 and (price->>'confirmedAt')::timestamptz between now()-interval '30 days' and now() then
   new.rate_microusd:=amount;new.rate_source:=price->>'source';new.rate_confirmed_at:=(price->>'confirmedAt')::timestamptz;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.nbc_pilot_snapshot_verification_rate() from public,anon,authenticated;
drop trigger if exists nbc_pilot_verification_rate on public.nbc_pilot_phone_checks;
create trigger nbc_pilot_verification_rate before insert on public.nbc_pilot_phone_checks for each row execute function public.nbc_pilot_snapshot_verification_rate();
-- Do not backfill old rows using today's price. Missing historical receipts stay unknown.
commit;
