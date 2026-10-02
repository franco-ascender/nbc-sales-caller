# NBC onboarding → Zapier → Slack

For the operations explanation of each step, the migration rationale, and remaining ClickUp dependencies, see [NBC client onboarding workflow explained](onboarding-workflow-explained.md).

This replaces only the ClickUp task trigger. Keep the original published Zap untouched. The questionnaire is still in ClickUp, so this milestone does not yet allow cancelling the ClickUp account.

## Product requirement updated October 2, 2026

The normal start must be Anas moving the opportunity to the agreed closed-client stage in GHL. NBC must import the available details and start this Zap automatically, without a second form submission or confirmation in the portal. Manual intake is an exception path. This GHL-to-onboarding entry point is not implemented yet; the existing admin start endpoint must not be mistaken for it.

Franco confirmed the target in a GHL screenshot: pipeline **NBC Sales**, stage **Closed Won**. Location, pipeline and stage IDs are verified below; the actual workflow delivery payload still needs validation. This is a stage transition, not an instruction to backfill opportunities already in that column. Match their IDs explicitly; do not interpret every pipeline change as a closed client or assume that a stage transition equals GHL's won status. Authenticate the incoming event, retain the source opportunity/contact identity, and deduplicate repeated deliveries and stage re-entry. Missing required details must produce a record for targeted completion rather than invented values or a partial Slack run. Feed validated requests into the same durable onboarding dispatch and claim mechanism. Do not reuse Caller or Tracker webhooks or credentials without verifying their intended account and contract. Preserve the existing sales notification.

### GHL connection verified October 2, 2026

Read-only API checks succeeded for location, pipelines, contact-field definitions, opportunity search and one linked contact. The previously configured location rejected the new token; local `GHL_LOCATION_ID` now matches the subaccount supplied by Franco. No production environment was changed by this discovery.

| Setting | Verified value |
| --- | --- |
| Location | ASCENDERS — `aB9oHA9ugUgySUhfQ9sD` |
| Pipeline | NBC Sales — `AhhGnFcX8rGeI5xjV6Eh` |
| Stage | Closed Won — `a015adf8-6d4e-41d4-873b-afed60174e4e` |
| Optional recording field | `contact.fathom_recording_link` — `KMFHIx3iRegZM4JNI0Oo` |

The sampled opportunity in Closed Won has status `open`. Trigger on the verified **stage ID**, not `status=won`. Existing stage membership is not permission to start historical records.

The sampled contact has a name and email but no company name or recording. Use the contact's name as the client/channel display name when company is absent; the intake already supports client or company names. Recording remains optional. Validate required contact data individually rather than assuming every contact is complete. Source data was read only; no client onboarding, GHL mutation or Slack action was triggered.

Next connection: a separate GHL workflow, **Pipeline Stage Changed**, filtered to NBC Sales / Closed Won, sends an authenticated request to NBC. The onboarding-specific receiver is implemented for capture-only validation; workflow delivery and automatic dispatch remain pending; the current `/api/webhooks/ghl` route only stores generic integration events and must not be presented as an onboarding trigger.

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

Direct setup validates Slack's channel-name character rules before dispatch; edit unsupported company names in the draft. It does not silently normalize punctuation into colliding names.

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

During transition both routes check the existing ClickUp queue read-only to avoid duplicating historical clients. Remove that dependency only after importing and validating the legacy identity index. The new route does not create ClickUp tasks. After the GHL entry point is implemented and validated, the agreed GHL transition becomes the normal start. The old internal form must not also be submitted for that same client. The original automation remains in place during validation.

## References

- https://help.zapier.com/hc/en-us/articles/8496215655437-Zap-is-not-receiving-webhooks
- https://help.zapier.com/hc/en-us/articles/8496326446989-Send-webhooks-in-Zap-workflows

- https://docs.slack.dev/reference/methods/conversations.create/

## GHL webhook action for capture validation

Keep the workflow in Draft. Method POST; URL `https://nbc-sales-nbc-sales.vercel.app/api/onboarding/ghl`. Add custom data `nbc_opportunity_id` using the triggering Opportunity ID field. Add header `Authorization` with `Bearer ` followed by the private `ONBOARDING_GHL_WEBHOOK_SECRET` value from the local environment. GHL supplies JSON content type. Do not use the GHL API token as this header. The current receiver only stores validated capture receipts; a successful capture is not a completed onboarding. Use an approved test event to confirm the actual mapping before preparing live dispatch.
