begin;
create function public.nbc_pilot_claim_phone_batch(p_owner uuid,p_key text,p_phones text[]) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds; s nbc_pilot_slots; o nbc_pilot_operations; c nbc_pilot_phone_checks; unit integer; used bigint; allocated bigint; phones text[]; p_phone text; capacity integer;
begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found'; end if;
 if cardinality(p_phones) is null or cardinality(p_phones)<1 or cardinality(p_phones)>10 or array_position(p_phones,null) is not null then raise exception 'invalid_batch'; end if;
 select array_agg(phone order by position) into phones from (
  select phone,min(position) position from unnest(p_phones) with ordinality as input(phone,position)
  where not exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and phone10=phone) group by phone
 ) eligible;
 if coalesce(cardinality(phones),0)=0 then return jsonb_build_object('acquired',false,'phones','[]'::jsonb); end if;
 if r.paused then raise exception 'pilot_paused'; end if;
 unit:=(r.settings->'verification'->>'unitCents')::integer;
 if unit is null or unit<1 or unit>10 or coalesce(r.settings->'verification'->>'provider','')<>'batchdata' or coalesce((r.settings->'verification'->>'confirmedAt')::timestamptz,'epoch')<now()-interval '30 days' or (r.settings->'verification'->>'confirmedAt')::timestamptz>now() then raise exception 'verification_pricing_required'; end if;
 if exists(select 1 from nbc_pilot_operations where round_id=r.id and state in ('dispatching','running','uncertain')) or exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending'; end if;
 select * into s from nbc_pilot_slots where round_id=r.id and key=p_key and kind='scrape';
 select * into o from nbc_pilot_operations where round_id=r.id and key=p_key and state='completed';
 if s.key is null or o.key is null then raise exception 'discovery_required'; end if;
 foreach p_phone in array phones loop
 if p_phone !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' or left(p_phone,3) in ('800','833','844','855','866','877','888') or not exists(select 1 from jsonb_array_elements(o.result->'rows') row where row->>'phone10'=p_phone and row->>'rejection' is null and row->>'chain' is null and coalesce((row->>'duplicate')::boolean,false)=false) then raise exception 'ineligible_phone'; end if;
 end loop;
 select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
 used:=used+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id);
 allocated:=o.reserved_cents+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id and slot_key=p_key);
 capacity:=least(cardinality(phones),((r.cap_cents-used)/unit)::integer,((s.allocation_cents-allocated)/unit)::integer);
 if capacity<1 then raise exception 'pilot_budget_exceeded'; end if;
 phones:=phones[1:capacity];
 insert into nbc_pilot_phone_checks(round_id,phone10,slot_key,state,reserved_cents)
 select r.id,phone,p_key,'dispatching',unit from unnest(phones) phone;
 return jsonb_build_object('acquired',true,'phones',to_jsonb(phones));
end $$;
revoke all on function public.nbc_pilot_claim_phone_batch(uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.nbc_pilot_claim_phone_batch(uuid,text,text[]) to service_role;
commit;
