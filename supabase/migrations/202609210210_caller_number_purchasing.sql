-- Adds an auditable, budget-gated purchase workflow to local caller-ID coverage.
-- Apply after 202609170080_caller_city_number_coverage.sql.
alter table public.caller_phone_numbers
  add column if not exists quote_expires_at timestamptz,
  add column if not exists quoted_currency char(3) not null default 'USD',
  add column if not exists purchase_request_id uuid,
  add column if not exists purchase_error text;

alter table public.caller_phone_numbers drop constraint if exists caller_phone_numbers_status_check;
alter table public.caller_phone_numbers add constraint caller_phone_numbers_status_check
  check(status in ('quoted','purchasing','active','uncertain','expired','failed','retired','rejected'));
create unique index if not exists caller_phone_numbers_purchase_request_idx
  on public.caller_phone_numbers(purchase_request_id) where purchase_request_id is not null;

create or replace function public.caller_claim_phone_number_purchase(
  p_actor uuid,
  p_quote uuid,
  p_request uuid
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_policy public.caller_phone_number_policy%rowtype;
  v_quote public.caller_phone_numbers%rowtype;
  v_count integer;
  v_committed bigint;
begin
  if not exists(select 1 from public.nbc_members where id=p_actor and role='admin' and status='active') then
    raise exception 'admin_required';
  end if;

  select * into v_policy from public.caller_phone_number_policy where id=true for update;
  select * into v_quote from public.caller_phone_numbers where id=p_quote for update;
  if not found then raise exception 'quote_missing'; end if;

  if v_quote.purchase_request_id=p_request and v_quote.status in ('purchasing','active','uncertain') then
    return jsonb_build_object('claimed',false,'number',to_jsonb(v_quote));
  end if;
  if not v_policy.anas_approved_budget or v_policy.monthly_budget_cents is null then
    raise exception 'budget_not_approved';
  end if;
  if v_quote.status<>'quoted' or v_quote.quote_expires_at is null or v_quote.quote_expires_at<=clock_timestamp() then
    raise exception 'quote_expired';
  end if;
  if not v_quote.voice_capable or v_quote.address_requirement<>'none' or v_quote.quoted_monthly_cents is null then
    raise exception 'number_not_eligible';
  end if;

  select count(*),coalesce(sum(quoted_monthly_cents),0)
    into v_count,v_committed
    from public.caller_phone_numbers
    where status in ('active','purchasing','uncertain');
  if v_count>=v_policy.maximum_active_numbers then raise exception 'number_capacity_reached'; end if;
  if v_committed+v_quote.quoted_monthly_cents>v_policy.monthly_budget_cents then raise exception 'number_budget_exceeded'; end if;
  if exists(select 1 from public.caller_phone_numbers where country=v_quote.country and lower(city)=lower(v_quote.city) and region=v_quote.region and status='active') then
    raise exception 'city_already_covered';
  end if;

  update public.caller_phone_numbers
     set status='purchasing',purchase_request_id=p_request,purchase_error=null
   where id=p_quote
   returning * into v_quote;
  return jsonb_build_object('claimed',true,'number',to_jsonb(v_quote));
end;
$$;

revoke all on function public.caller_claim_phone_number_purchase(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.caller_claim_phone_number_purchase(uuid,uuid,uuid) to service_role;
