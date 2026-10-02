# NBC onboarding → Zapier → Slack

This replaces only the ClickUp task trigger. Keep the original published Zap untouched. The questionnaire is still in ClickUp, so this milestone does not yet allow cancelling the ClickUp account.

## Prepare the copy

1. Duplicate `ClickUp Clients Onboarding → Slack Channel Auto-Invite`. Name it `NBC Portal → Client Slack Setup`. Leave it off while editing.
2. Replace the ClickUp trigger with **Webhooks by Zapier → Catch Hook**. Leave its child-key option empty. Store the private URL server-side as `ONBOARDING_ZAPIER_WEBHOOK_URL`; never commit or display it in the portal.
3. Immediately after the trigger, add **Webhooks by Zapier → Custom Request**: method POST; URL = trigger `callback_url`; header `Authorization` = `Bearer ` followed by trigger `callback_token`; header `Content-Type` = `application/json`; data = `{"action":"claim"}`. Do not wrap or unflatten the JSON. Stop on failed requests.
4. Add a Filter: continue only if the claim response `run` is boolean true. A repeated event returns false. This guard must precede every Slack action.
5. Keep the existing Slack actions, remapping all references to the removed ClickUp trigger:
   - Create Private Channel: name = trigger `channel_name` (already includes `elite-`).
   - Invite Elias: channel = the Create Private Channel result; keep the original Elias user.
   - Invite Viktor: same created channel; keep the original Viktor user.
   - Send Channel Message: same created channel; preserve the existing welcome text and questionnaire link. Use the new trigger's name/email fields wherever needed.
6. After the welcome-message action succeeds, add another Custom Request with the same callback URL and headers. Data: `{"action":"complete","channel_id":"<created channel ID>","message_ts":"<welcome message ts>"}`. Insert mapped values, not the angle-bracket placeholders. Stop on failure.

The client invitation stays manual with Elias. The callback must be after **all** required Slack actions; otherwise the portal could report completion too early. It confirms what Zapier reports, not an independent Slack audit. The welcome video still precedes completion of the client's questionnaire.

## Trigger contract

Flat JSON fields: `schema_version` (1), `event` (`nbc.onboarding.started`), `event_id` (NBC UUID), `program` (ELITE), `company`, `primary_name`, `primary_email`, `partner_name`, `partner_email`, `fathom_url`, `transcript_url`, `channel_name`, `callback_url`, `callback_token`.

The callback token is an event-scoped credential. Do not map it into Slack messages, descriptions, or client-facing outputs. NBC never returns this token through its admin read APIs. A copy of an old trigger event cannot acquire a second execution claim. Manual replay starting *after* the claim/filter bypasses that guard and must not be used for recovery.

## Validation before switching

- Set a random server-only `ONBOARDING_CALLBACK_SECRET` of at least 32 characters on both the isolated validation deployment and production (production receives callbacks). Keep it stable while events are pending.
- Production stays `ONBOARDING_TRANSPORT=clickup`. The copy cannot run until it is configured, and no sample POST is sent automatically by NBC.
- Use a separate validation deployment with `ONBOARDING_TRANSPORT=zapier` and the new hook URL. Its NBC data is still real. Deliberately start one approved test identity only after the operator authorizes the resulting Slack channel and message.
- Verify a single private channel, correct Elias/Viktor membership, exact welcome message, and the saved `slack_ready` receipt. Verify refreshing/reopening makes no second request. Do not create the same test identity in the old ClickUp queue.
- Only after the real test passes, set production transport to `zapier`. Adding the hook URL alone never changes the active route.
- A 2xx from the Catch Hook means delivery was accepted; it does not prove the Zap ran or Slack succeeded. The portal waits for the final callback.
- On timeout/failure, inspect Zap history. Never retry a whole Zap, replay downstream Slack actions, or route the same record through ClickUp. `Check saved result` reads the saved state only for direct records. Resolve uncertain/partially executed events with operator review; an automatic recovery/replay tool is intentionally not provided yet.
- Changing the default transport back to ClickUp affects only new drafts. Records already assigned to Zapier remain assigned there; their callbacks still work.

During transition both routes check the existing ClickUp queue read-only to avoid duplicating historical clients. Remove that dependency only after importing and validating the legacy identity index. The new route does not create ClickUp tasks. The older intake form can still trigger the original Zap, so the team must use the NBC portal for new clients after cutover.

## References

- https://help.zapier.com/hc/en-us/articles/8496215655437-Zap-is-not-receiving-webhooks
- https://help.zapier.com/hc/en-us/articles/8496326446989-Send-webhooks-in-Zap-workflows
