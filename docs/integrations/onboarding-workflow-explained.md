# NBC Portal to Client Onboarding

**Goal:** Anas moves the lead to **Closed Won** in the **NBC Sales** pipeline in GHL, as he does today. NBC imports the available client details and starts Slack setup automatically. No second form or extra start button is required in the normal flow.

**Status — October 2, 2026:** The eight-step Slack Zap is configured as a draft. The GHL-to-NBC automatic trigger still needs to be implemented and validated. The current portal implementation requires a manual start; that is a fallback, not the intended everyday process. End-to-end validation is pending.

## Zap name and eight stages

**Zap: NBC Portal → Client Onboarding**

| Stage | What it does |
| --- | --- |
| 1. Catch Hook | Receives the client setup request from NBC. |
| 2. Claim request | Asks NBC to reserve this request for one execution. |
| 3. Filter | Continues only if the request obtained that reservation. |
| 4. Create Private Channel | Creates the client's private Slack channel. |
| 5. Invite Elias | Adds Elias to that channel. |
| 6. Invite Viktor | Adds Viktor to that channel. |
| 7. Welcome Message | Posts the existing welcome message, unchanged. |
| 8. Completion Receipt | Sends the channel and message IDs back to NBC so the team can see the result. |

## What it replaces

The internal ClickUp intake form and the ClickUp task used to trigger Slack setup. The intended flow is:

**Lead moved to NBC Sales / Closed Won → NBC client record → this Zap → Slack setup → result saved in NBC.**

The internal intake belongs to NBC. Manual entry is available for exceptions; the team should not retype information already available in GHL. If essential details are missing, NBC should request only those details and then resume safely.

## Why this approach is better for the team

Anas keeps his existing action in GHL. The system handles data transfer and Slack setup, removing duplicate entry and giving the team one place to check progress. We reuse the configured Slack actions while replacing the ClickUp dependency gradually. Repeated GHL events must not create additional onboarding runs.

## What remains separate

The client-facing questionnaire is still in ClickUp for now. Skool remains manual. Client Slack invitations, calendar access, and the welcome video are not automated by these eight steps. ClickUp can only be cancelled after its remaining dependencies are replaced and validated.

## Next step

The confirmed trigger is entry into **NBC Sales / Closed Won**. API access and the internal IDs are now verified. Connect the GHL stage-change workflow to an onboarding receiver with duplicate protection and a missing-data fallback. Existing cards in that stage are not a request to backfill historical clients. Then validate one controlled run before switching production. Keep the original workflows operating during validation.

Technical setup: [Onboarding Zapier guide](onboarding-zapier.md).
