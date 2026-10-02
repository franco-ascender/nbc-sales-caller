begin;
-- The existing Zap derives its channel name from the company/task name.
-- Serialize even different email addresses competing for the same channel.
create unique index nbc_client_onboardings_channel_key
on public.nbc_client_onboardings (('elite-' || replace(lower(btrim(intake->>'company')), ' ', '-')));
commit;
