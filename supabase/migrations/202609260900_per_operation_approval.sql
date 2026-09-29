begin;
drop function if exists public.nbc_pilot_phone_slot(uuid,uuid,text);
create or replace function public.nbc_pilot_phone_slot(p_owner uuid,p_request uuid,p_destination text,p_max_cents integer default null) returns text
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
 if (coalesce(r.settings->>'perOperationApproval','false')='true') and p_max_cents is distinct from 250 then raise exception 'approval_required';end if;
 if r.paused then raise exception 'pilot_paused';end if;
 if exists(select 1 from nbc_pilot_operations where round_id=r.id and state in ('dispatching','running','uncertain')) or exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending';end if;
 select count(*) into today_calls from nbc_pilot_operations o join nbc_pilot_slots slot_row on slot_row.round_id=o.round_id and slot_row.key=o.key where o.round_id=r.id and slot_row.kind='phone' and o.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 if (coalesce(r.settings->>'perOperationApproval','false')<>'true') and today_calls>=3 then raise exception 'phone_daily_limit';end if;
 select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
 used:=used+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id);
 if (coalesce(r.settings->>'perOperationApproval','false')<>'true') and used+250>r.cap_cents then raise exception 'pilot_budget_exceeded';end if;
 insert into nbc_pilot_slots(round_id,key,kind,title,allocation_cents,reserve_cents,config) values(r.id,k,'phone','Phone trial · ending '||right(p_destination,4),250,250,jsonb_build_object('destination',p_destination,'scenario','Nalify / Garage Door Business Owner','approvedCeilingCents',p_max_cents,'approvedAt',now()));
 return k;
end $$;
create or replace function public.nbc_pilot_daily_phone_guard() returns trigger language plpgsql security invoker set search_path=public as $$
declare count_today integer;begin
 if exists(select 1 from nbc_pilot_rounds where id=new.round_id and settings->>'perOperationApproval'='true') then return new;end if;
 if exists(select 1 from nbc_pilot_slots where round_id=new.round_id and key=new.key and kind='phone') then
  perform 1 from nbc_pilot_rounds where id=new.round_id for update;
  select count(*) into count_today from nbc_pilot_operations o join nbc_pilot_slots s on s.round_id=o.round_id and s.key=o.key where o.round_id=new.round_id and s.kind='phone' and o.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  if count_today>=3 then raise exception 'phone_daily_limit';end if;
 end if;return new;end $$;
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
 if (coalesce(r.settings->>'perOperationApproval','false')='true') and coalesce((s.config->>'approvedCeilingCents')::integer,0)<s.reserve_cents then raise exception 'approval_required';end if;
 if r.paused then raise exception 'pilot_paused'; end if;
 if exists(select 1 from nbc_pilot_operations where round_id=r.id and state in ('dispatching','running','uncertain')) or exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending'; end if;
 select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
 used:=used+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id);
 if (coalesce(r.settings->>'perOperationApproval','false')<>'true') and used+s.reserve_cents>r.cap_cents then raise exception 'pilot_budget_exceeded'; end if;
 insert into nbc_pilot_operations(round_id,key,state,reserved_cents) values(r.id,p_key,'dispatching',s.reserve_cents) returning * into o;
 return jsonb_build_object('acquired',true,'operation',to_jsonb(o));
end $$;

create or replace function public.nbc_pilot_claim_phone(p_owner uuid,p_key text,p_phone text) returns jsonb
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
 if (coalesce(r.settings->>'perOperationApproval','false')='true') and allocated+unit>coalesce((s.config->>'approvedCeilingCents')::integer,0) then raise exception 'approval_required';end if;
 if ((coalesce(r.settings->>'perOperationApproval','false')<>'true') and used+unit>r.cap_cents) or allocated+unit>s.allocation_cents then raise exception 'pilot_budget_exceeded'; end if;
 insert into nbc_pilot_phone_checks(round_id,phone10,slot_key,state,reserved_cents) values(r.id,p_phone,p_key,'dispatching',unit) returning * into c;
 return jsonb_build_object('acquired',true,'check',to_jsonb(c));
end $$;

create or replace function public.nbc_pilot_claim_phone_batch(p_owner uuid,p_key text,p_phones text[]) returns jsonb
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
 if (coalesce(r.settings->>'perOperationApproval','false')='true') then
  if coalesce((s.config->>'approvedCeilingCents')::integer,0)<=allocated then raise exception 'approval_required';end if;
  s.allocation_cents:=least(s.allocation_cents,(s.config->>'approvedCeilingCents')::integer);
 end if;
 capacity:=least(cardinality(phones),case when coalesce(r.settings->>'perOperationApproval','false')='true' then 10 else ((r.cap_cents-used)/unit)::integer end,((s.allocation_cents-allocated)/unit)::integer);
 if capacity<1 then raise exception 'pilot_budget_exceeded'; end if;
 phones:=phones[1:capacity];
 insert into nbc_pilot_phone_checks(round_id,phone10,slot_key,state,reserved_cents)
 select r.id,phone,p_key,'dispatching',unit from unnest(phones) phone;
 return jsonb_build_object('acquired',true,'phones',to_jsonb(phones));
end $$;
create or replace function public.nbc_lead_cycle_create(p_owner uuid,p_request uuid,p_input jsonb) returns text
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds;c nbc_lead_cycles;k text;n integer;unit integer;used integer;conf jsonb; niches jsonb:='{"garage_doors":"garage door","car_detailing":"car detailing","hvac":"hvac","roofing":"roofing","plumbing":"plumbing","electrical":"electrical","remodeling":"remodeling","pool":"pool services","landscaping":"landscaping","painting":"painting","fencing":"fencing","concrete":"concrete","auto_repair":"auto repair","auto_body":"auto body","jewelers":"jewelers","exotic_car_dealers":"exotic car dealers","cpa":"accountant","realtor":"real estate agent","property_manager":"property management","dentist":"dentist","chiropractor":"chiropractor","med_spa":"med spa","attorney":"law firm","real_estate_investor":"real estate investment","developer":"real estate developer","contractors":"general contractor","movers_tree_haulers":"moving company","pest_control":"pest control","salons_barbers":"hair salon","salon_suites":"salon suites","childcare_home":"family day care","childcare_center":"day care center","insurance_agencies":"insurance agency","tax_preparer":"tax preparation","restaurants":"restaurant","str_operator":"vacation rental management","medspa":"med spa"}'::jsonb;begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found';end if;
 p_input:=p_input||jsonb_build_object('city',trim(coalesce(p_input->>'city','')),'state',upper(trim(coalesce(p_input->>'state',''))));
 n:=(p_input->>'count')::integer;
 if p_request is null or n is null or n not between 5 and 5000 or not (niches ? coalesce(p_input->>'industry','')) or coalesce(length(p_input->>'name'),0) not between 2 and 80 or ((p_input->>'city')<>'' and (length(p_input->>'city') not between 2 and 60 or (p_input->>'state')='')) or ((p_input->>'state')<>'' and (p_input->>'state')<>all(string_to_array('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC',' '))) then raise exception 'invalid_list';end if;
 if n>50 then raise exception 'testing_volume_limit';end if;
 k:='list-'||p_request::text;
 select * into c from nbc_lead_cycles where round_id=r.id and key=k;
 if found then
  if c.name<>p_input->>'name' or c.industry<>p_input->>'industry' or c.city<>p_input->>'city' or c.state<>p_input->>'state' or c.count<>n then raise exception 'request_conflict';end if;
  return k;
 end if;
 if r.paused then raise exception 'pilot_paused';end if;
 if exists(select 1 from nbc_lead_cycles where round_id=r.id and status='running') or exists(select 1 from nbc_pilot_operations where round_id=r.id and state in ('dispatching','running','uncertain')) or exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending';end if;
 select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
 used:=used+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id);
 if (coalesce(r.settings->>'perOperationApproval','false')<>'true') and used+75>r.cap_cents then raise exception 'pilot_budget_exceeded';end if;
 -- A bounded allocation, not a new global allowance. Verification still requires a separately confirmed account rate.
 unit:=coalesce((r.settings#>>'{verification,unitCents}')::integer,10);
 if (coalesce(r.settings->>'perOperationApproval','false')='true') and (p_input->>'approvedMaxCents')::integer is distinct from 75+n*greatest(1,least(10,unit)) then raise exception 'approval_required';end if;
 conf:=jsonb_build_object('approvedCeilingCents',(p_input->>'approvedMaxCents')::integer,'approvedAt',now(),'industry',niches->>(p_input->>'industry'),'city',p_input->>'city','state',p_input->>'state','count',n,'scope',case when p_input->>'state'='' then 'nationwide' when p_input->>'city'='' then 'state' else 'city' end,'location',case when p_input->>'state'='' then 'United States' when p_input->>'city'='' then (p_input->>'state')||', USA' else (p_input->>'city')||', '||(p_input->>'state')||', USA' end);
 insert into nbc_pilot_slots(round_id,key,kind,title,allocation_cents,reserve_cents,config) values(r.id,k,'scrape',p_input->>'name',75+n*greatest(1,least(10,unit)),75,conf);
 insert into nbc_lead_cycles(round_id,key,name,industry,city,state,count,events) values(r.id,k,p_input->>'name',p_input->>'industry',p_input->>'city',p_input->>'state',n,jsonb_build_array(jsonb_build_object('phase','discover','at',now(),'message','Search authorized. Waiting to connect.')));
 return k;
end $$;
create or replace function public.nbc_pilot_approve_slot(p_owner uuid,p_key text,p_action text,p_max_cents integer) returns void
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds;s nbc_pilot_slots;o nbc_pilot_operations;needed integer;allocated integer;unit integer;begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found';end if;
 if r.paused then raise exception 'pilot_paused';end if;
 select * into s from nbc_pilot_slots where round_id=r.id and key=p_key;
 if not found then raise exception 'invalid_slot';end if;
 select * into o from nbc_pilot_operations where round_id=r.id and key=p_key;
 allocated:=coalesce(o.reserved_cents,0)+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id and slot_key=p_key);
 if p_action='start' and o.key is null then needed:=s.reserve_cents;
 elsif p_action='verify' and s.kind='scrape' and o.state='completed' then
  unit:=(r.settings#>>'{verification,unitCents}')::integer;
  if unit is null or unit<1 or unit>10 then raise exception 'approval_required';end if;
  select count(distinct row->>'phone10')*unit into needed from jsonb_array_elements(o.result->'rows') row
  where row->>'phone10' ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' and left(row->>'phone10',3) not in ('800','833','844','855','866','877','888') and row->>'rejection' is null and row->>'chain' is null and coalesce((row->>'duplicate')::boolean,false)=false
  and not exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and phone10=row->>'phone10');
 else raise exception 'invalid_action';end if;
 if needed is null or needed<1 or p_max_cents is distinct from needed or allocated+needed>s.allocation_cents then raise exception 'approval_required';end if;
 update nbc_pilot_slots set config=config||jsonb_build_object('approvedCeilingCents',allocated+needed,'approvedAt',now(),'approvedAction',p_action) where round_id=r.id and key=p_key;
end $$;
revoke all on function public.nbc_pilot_approve_slot(uuid,text,text,integer),public.nbc_pilot_phone_slot(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.nbc_pilot_approve_slot(uuid,text,text,integer),public.nbc_pilot_phone_slot(uuid,uuid,text,integer) to service_role;
commit;
