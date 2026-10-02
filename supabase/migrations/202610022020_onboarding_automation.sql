begin;
alter table public.nbc_client_onboardings
 add column transport text check(transport in ('clickup','zapier')),
 add column automation_claimed_at timestamptz,
 add column slack_channel_id text,
 add column welcome_message_ts text;
update public.nbc_client_onboardings set transport='clickup' where state<>'draft';
alter table public.nbc_client_onboardings drop constraint nbc_client_onboardings_state_check;
alter table public.nbc_client_onboardings add constraint nbc_client_onboardings_state_check
 check(state in ('draft','starting','queued','existing','uncertain','needs_review','automation_pending','slack_ready'));
alter table public.nbc_client_onboardings add constraint nbc_onboarding_automation_receipt check (
 (state not in ('automation_pending','slack_ready') or transport is not distinct from 'zapier') and
 (state<>'slack_ready' or (automation_claimed_at is not null and slack_channel_id is not null and welcome_message_ts is not null)) and
 (slack_channel_id is null or slack_channel_id ~ '^[CG][A-Z0-9]{8,30}$') and
 (welcome_message_ts is null or welcome_message_ts ~ '^[0-9]{10,}\.[0-9]{6}$')
);
commit;
