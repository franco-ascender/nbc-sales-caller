begin;
alter table public.caller_call_assets add column if not exists recording_attempt_at timestamptz;
commit;
