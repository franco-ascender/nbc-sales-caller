begin;
alter table public.nbc_members add column avatar_tone text not null default 'blue' check(avatar_tone in ('blue','gold','violet','slate'));
create function public.nbc_initialize_wallet() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin
 insert into public.nbc_credit_wallets(member_id) values(new.id) on conflict do nothing;return new;
end $$;
revoke all on function public.nbc_initialize_wallet() from public,anon,authenticated;
create trigger nbc_member_wallet after insert on public.nbc_members for each row execute function public.nbc_initialize_wallet();
insert into public.nbc_credit_wallets(member_id) select id from public.nbc_members on conflict do nothing;
create table public.nbc_usage_events(
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.nbc_members(id),
 source text not null check(length(source) between 1 and 40),event_key text not null check(length(event_key) between 1 and 180),
 feature text not null check(length(feature) between 1 and 60),
 input_tokens bigint check(input_tokens between 0 and 1000000000),output_tokens bigint check(output_tokens between 0 and 1000000000),cached_tokens bigint check(cached_tokens between 0 and 1000000000),
 duration_seconds integer check(duration_seconds between 0 and 86400),cost_microusd bigint check(cost_microusd between 0 and 1000000000000),
 cost_scope text not null default 'unknown' check(cost_scope in ('unknown','llm_only','total')),
 occurred_at timestamptz not null default now(),created_at timestamptz not null default now(),unique(source,event_key),
 check(cost_microusd is not null or cost_scope='unknown')
);
create index nbc_usage_member_time on public.nbc_usage_events(member_id,occurred_at desc,id);
create function public.nbc_usage_record(p_member uuid,p_source text,p_key text,p_feature text,p_input bigint,p_output bigint,p_cached bigint,p_seconds integer,p_cost bigint,p_scope text,p_at timestamptz) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare row_id uuid;begin
 insert into public.nbc_usage_events(member_id,source,event_key,feature,input_tokens,output_tokens,cached_tokens,duration_seconds,cost_microusd,cost_scope,occurred_at)
 values(p_member,p_source,p_key,p_feature,p_input,p_output,p_cached,p_seconds,p_cost,p_scope,p_at)
 on conflict(source,event_key) do update set input_tokens=coalesce(nbc_usage_events.input_tokens,excluded.input_tokens),output_tokens=coalesce(nbc_usage_events.output_tokens,excluded.output_tokens),cached_tokens=coalesce(nbc_usage_events.cached_tokens,excluded.cached_tokens),duration_seconds=coalesce(nbc_usage_events.duration_seconds,excluded.duration_seconds),cost_microusd=coalesce(nbc_usage_events.cost_microusd,excluded.cost_microusd),cost_scope=case when nbc_usage_events.cost_microusd is null then excluded.cost_scope else nbc_usage_events.cost_scope end
 where nbc_usage_events.member_id=excluded.member_id and nbc_usage_events.feature=excluded.feature
 returning id into row_id;
 if row_id is null then raise exception 'usage_identity_conflict' using errcode='23505';end if;return row_id;
end $$;
-- All members appear automatically; no separate per-user mapping registration.
create function public.nbc_admin_usage(p_actor uuid,p_offset integer default 0,p_search text default '') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare answer jsonb;begin
 if not exists(select 1 from public.nbc_members where id=p_actor and role='admin' and status='active') then raise exception 'admin_required' using errcode='42501';end if;
 if p_offset<0 or p_offset>1000000 or length(p_search)>120 then raise exception 'invalid_page' using errcode='22023';end if;
 with members as(select m.id,m.display_name,m.role,m.status,m.created_at,a.email,coalesce(w.balance-w.reserved,0) available,coalesce(w.reserved,0) reserved from public.nbc_members m join auth.users a on a.id=m.id left join public.nbc_credit_wallets w on w.member_id=m.id where p_search='' or strpos(lower(m.display_name||' '||coalesce(a.email,'')),lower(p_search))>0),
 page as(select * from members order by created_at desc,id limit 50 offset p_offset),
 result as(select p.*,coalesce(u.events,0) events,coalesce(u.input_tokens,0) input_tokens,coalesce(u.output_tokens,0) output_tokens,coalesce(u.cached_tokens,0) cached_tokens,coalesce(u.seconds,0) seconds,coalesce(u.known_cost,0) known_cost_microusd,coalesce(u.unmeasured,0) unmeasured,coalesce(u.partial_cost,0) partial_cost,u.last_used from page p left join lateral(select count(*) events,sum(input_tokens) input_tokens,sum(output_tokens) output_tokens,sum(cached_tokens) cached_tokens,sum(duration_seconds) seconds,sum(cost_microusd) known_cost,count(*) filter(where input_tokens is null or output_tokens is null) unmeasured,count(*) filter(where cost_scope<>'total') partial_cost,max(occurred_at) last_used from public.nbc_usage_events where member_id=p.id) u on true)
 select jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(result) order by created_at desc,id) from result),'[]'::jsonb),'total',(select count(*) from members),'nextOffset',case when (select count(*) from members)>p_offset+50 then p_offset+50 else null end) into answer;return answer;
end $$;
create table public.nbc_credit_rates(id uuid primary key default gen_random_uuid(),label text not null,credit_value_microusd bigint not null check(credit_value_microusd between 1 and 10000000),markup_bps integer not null check(markup_bps between 10000 and 100000),status text not null check(status in ('draft','active','retired')),created_at timestamptz not null default now());
insert into public.nbc_credit_rates(label,credit_value_microusd,markup_bps,status) values('NBC Credits · working proposal',10000,30000,'draft');
create table public.nbc_credit_packages(id text primary key,credits integer not null check(credits between 1 and 1000000),amount_cents integer not null check(amount_cents between 50 and 1000000),currency text not null default 'usd' check(currency='usd'),active boolean not null default false);
insert into public.nbc_credit_packages(id,credits,amount_cents) values('starter',1000,1000),('growth',5000,5000),('scale',10000,10000);
create table public.nbc_credit_orders(id uuid primary key,member_id uuid not null references public.nbc_members(id),package_id text not null references public.nbc_credit_packages(id),credits integer not null check(credits between 1 and 1000000),amount_cents integer not null check(amount_cents between 50 and 1000000),currency text not null check(currency='usd'),status text not null default 'pending' check(status in ('pending','paid')),checkout_session text unique,payment_id text unique,created_at timestamptz not null default now(),paid_at timestamptz);
create index nbc_orders_member on public.nbc_credit_orders(member_id,created_at desc);
create table public.nbc_payment_events(id text primary key,order_id uuid not null references public.nbc_credit_orders(id),created_at timestamptz not null default now());
create function public.nbc_paid_topup(p_order uuid,p_session text,p_payment text,p_amount integer,p_currency text,p_event text) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare o public.nbc_credit_orders;begin
 select * into o from public.nbc_credit_orders where id=p_order for update;
 if o.id is null or o.checkout_session is distinct from p_session or o.amount_cents<>p_amount or o.currency<>p_currency or p_payment is null or length(p_payment)<3 or p_event is null then raise exception 'payment_mismatch' using errcode='22023';end if;
 if o.status='paid' then
  if o.payment_id is distinct from p_payment then raise exception 'payment_conflict' using errcode='23505';end if;
  return jsonb_build_object('credited',false);
 end if;
 if exists(select 1 from public.nbc_payment_events where id=p_event) then raise exception 'event_conflict' using errcode='23505';end if;
 insert into public.nbc_credit_wallets(member_id) values(o.member_id) on conflict do nothing;
 perform 1 from public.nbc_credit_wallets where member_id=o.member_id for update;
 insert into public.nbc_credit_operations(member_id,id,kind,amount,reason,actor_id,state) values(o.member_id,o.id,'grant',o.credits,'NBC Credits purchase',o.member_id,'granted');
 update public.nbc_credit_wallets set balance=balance+o.credits where member_id=o.member_id;
 insert into public.nbc_credit_entries(member_id,operation_id,amount,reason) values(o.member_id,o.id,o.credits,'NBC Credits purchase');
 update public.nbc_credit_orders set status='paid',payment_id=p_payment,paid_at=now() where id=o.id;
 insert into public.nbc_payment_events(id,order_id) values(p_event,o.id);return jsonb_build_object('credited',true);
end $$;
-- Existing terminal calls are observed (not charged); missing tokens stay unknown.
create function public.nbc_observe_call() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if new.is_demo=false and new.status in ('completed','failed') and exists(select 1 from public.nbc_members where id=new.operator_id) then
 perform public.nbc_usage_record(new.operator_id,'caller',new.id::text,'Caller',null,null,null,new.duration_seconds,null,'unknown',coalesce(new.ended_at,new.created_at));end if;return new;
end $$;
create trigger nbc_call_usage after insert or update of status,duration_seconds on public.call_sessions for each row execute function public.nbc_observe_call();
insert into public.nbc_usage_events(member_id,source,event_key,feature,duration_seconds,occurred_at) select operator_id,'caller',id::text,'Caller',duration_seconds,coalesce(ended_at,created_at) from public.call_sessions where is_demo=false and status in ('completed','failed') and exists(select 1 from public.nbc_members where id=operator_id) on conflict do nothing;
do $$declare t text;begin
 foreach t in array array['nbc_usage_events','nbc_credit_rates','nbc_credit_packages','nbc_credit_orders','nbc_payment_events'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select,insert,update on public.%I to service_role',t);end loop;
end $$;
revoke update on public.nbc_payment_events from service_role;
revoke all on function public.nbc_usage_record(uuid,text,text,text,bigint,bigint,bigint,integer,bigint,text,timestamptz),public.nbc_admin_usage(uuid,integer,text),public.nbc_paid_topup(uuid,text,text,integer,text,text),public.nbc_observe_call() from public,anon,authenticated;
grant execute on function public.nbc_usage_record(uuid,text,text,text,bigint,bigint,bigint,integer,bigint,text,timestamptz),public.nbc_admin_usage(uuid,integer,text),public.nbc_paid_topup(uuid,text,text,integer,text,text) to service_role;
create function public.nbc_save_profile(p_actor uuid,p_name text,p_avatar text,p_business text,p_timezone text,p_goal text,p_questions text) returns void language plpgsql security invoker set search_path=public,pg_temp as $$ begin
 if not exists(select 1 from public.nbc_members where id=p_actor and status='active') then raise exception 'inactive_member' using errcode='42501';end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'invalid_timezone' using errcode='22023';end if;
 update public.nbc_members set display_name=p_name,avatar_tone=p_avatar where id=p_actor;
 insert into public.nbc_onboarding(member_id,business,timezone,goal,questions) values(p_actor,p_business,p_timezone,p_goal,p_questions)
 on conflict(member_id) do update set business=excluded.business,timezone=excluded.timezone,goal=excluded.goal,questions=excluded.questions,updated_at=now();
end $$;
revoke all on function public.nbc_save_profile(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.nbc_save_profile(uuid,text,text,text,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
