begin;

alter table public.call_sessions
  add column if not exists analysis_review jsonb
  check (analysis_review is null or jsonb_typeof(analysis_review) = 'object');

comment on column public.call_sessions.analysis_review is
  'Operator-reviewed corrections to bounded post-call classifications. Provider output remains unchanged in post_call_analysis.';

commit;
