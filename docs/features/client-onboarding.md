# Client onboarding: first operational slice

2026-10-02. Elias confirmed current flow. Welcome video precedes questionnaire completion. The visual stage board is deferred.

## Acceptance

Active NBC admins open /onboarding, save an intake draft, review the consequences, explicitly start once, and receive a durable ClickUp receipt. Students/coaches cannot access this first admin-only release. Anas/Elias are existing admins. All records are NBC internal team records, not member onboarding or client tracker data.

Starting creates a top-level Task in ASCENDERS OS / Clients / Onboarding Queue (901417783941), triggering the EXISTING Zap: private elite-* channel, Elias invitation, Viktor invitation, welcome message with the questionnaire. Elias still adds the client to Slack; Skool/ELITE sharing/video are manual and are not marked complete by a ClickUp receipt. No Zap changes. No bulk migration of historical tasks. Existing matching primary email is linked without creating a task. Same channel name/different email blocks dispatch.

## Reliability

Durable UUID and unique normalized primary email; atomic draft -> starting claim. No automatic repeat of an external POST. Ambiguous writes stay uncertain and can only be reconciled by reading a unique marker in task descriptions. DB failure after external creation leaves the claim intact. Changing or retrying a started intake cannot create a replacement. Draft updates are revision-checked. Credentials remain server-only. No client-controlled list/field IDs or arbitrary fetch URLs.

## Validation

Unit/provider fixture tests, API authorization tests, rollback-only SQL checks, desktop/mobile browser fixtures, read-only real ClickUp schema validation. No test task is created in the production list because that triggers Slack. End-to-end live dispatch remains unverified until an admin deliberately starts a real client.

## Mapping (read from API, 2026-10-02)

Task name = client/company name; Client Email = ebef69b4-0e31-4b97-9dbc-3ed4a154cc0b; Partner 1 Name = 3f7d4180-261f-41bc-89fa-61f8e5367369; Partner 2 Email = d510dc53-d85f-4421-96a8-d6395f9804b7; Partner 2 Name = 9b7cd8a0-c779-42f9-af0d-8b53e8a36dc4; Fathom Recording Link = 7ea4090b-8204-4daa-93f4-953dfbdf991c; Google Doc Transcript Link = 9f3bf090-39e6-4f23-b49c-080cf55ad0e2. API status is `pending ` (trailing space). Custom fields are not API-required even though the intake form requires primary name/email/company; enforce these server-side.

No sales-call summaries, GHL close trigger, invitations, calendar sharing or questionnaire migration implemented in this slice. These remain subsequent connections. Operational state always distinguishes draft, starting, queued in ClickUp, existing task, uncertain, and needs review; it never labels overall onboarding complete.
