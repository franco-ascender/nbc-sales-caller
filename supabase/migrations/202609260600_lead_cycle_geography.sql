begin;
create or replace function public.nbc_lead_cycle_create(p_owner uuid,p_request uuid,p_input jsonb) returns text
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds;c nbc_lead_cycles;k text;n integer;unit integer;used integer;conf jsonb; niches jsonb:='{"car_detailing":"car detailing","hvac":"hvac","roofing":"roofing","plumbing":"plumbing","electrical":"electrical","remodeling":"remodeling","pool":"pool services","landscaping":"landscaping","painting":"painting","fencing":"fencing","concrete":"concrete","auto_repair":"auto repair","auto_body":"auto body","jewelers":"jewelers","exotic_car_dealers":"exotic car dealers","cpa":"accountant","realtor":"real estate agent","property_manager":"property management","dentist":"dentist","chiropractor":"chiropractor","med_spa":"med spa","attorney":"law firm","real_estate_investor":"real estate investment","developer":"real estate developer","contractors":"general contractor","movers_tree_haulers":"moving company","pest_control":"pest control","salons_barbers":"hair salon","salon_suites":"salon suites","childcare_home":"family day care","childcare_center":"day care center","insurance_agencies":"insurance agency","tax_preparer":"tax preparation","restaurants":"restaurant","str_operator":"vacation rental management","medspa":"med spa"}'::jsonb;begin
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
 if used+75>r.cap_cents then raise exception 'pilot_budget_exceeded';end if;
 -- A bounded allocation, not a new global allowance. Verification still requires a separately confirmed account rate.
 unit:=coalesce((r.settings#>>'{verification,unitCents}')::integer,10);
 conf:=jsonb_build_object('industry',niches->>(p_input->>'industry'),'city',p_input->>'city','state',p_input->>'state','count',n,'scope',case when p_input->>'state'='' then 'nationwide' when p_input->>'city'='' then 'state' else 'city' end,'location',case when p_input->>'state'='' then 'United States' when p_input->>'city'='' then (p_input->>'state')||', USA' else (p_input->>'city')||', '||(p_input->>'state')||', USA' end);
 insert into nbc_pilot_slots(round_id,key,kind,title,allocation_cents,reserve_cents,config) values(r.id,k,'scrape',p_input->>'name',75+n*greatest(1,least(10,unit)),75,conf);
 insert into nbc_lead_cycles(round_id,key,name,industry,city,state,count,events) values(r.id,k,p_input->>'name',p_input->>'industry',p_input->>'city',p_input->>'state',n,jsonb_build_array(jsonb_build_object('phase','discover','at',now(),'message','Search authorized. Waiting to connect.')));
 return k;
end $$;
commit;
