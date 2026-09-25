begin;

alter table public.call_sessions
  add column if not exists post_call_analysis jsonb
  check (post_call_analysis is null or jsonb_typeof(post_call_analysis) = 'object');

comment on column public.call_sessions.post_call_analysis is
  'Bounded, normalized ElevenLabs post-call data collection, evaluation, and sentiment results. Raw provider payloads are not stored.';

commit;
