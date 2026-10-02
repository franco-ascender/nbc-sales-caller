# Client onboarding: first operational slice

2026-10-02. Elias confirmed current flow. Welcome video precedes questionnaire completion. The visual stage board is deferred.

## Acceptance

Next slice (in progress): retain the current ClickUp path as the default while preparing an opt-in direct NBC -> Zapier handoff. Persist the chosen transport on the initial atomic claim; never switch a started record to another provider. A successful Catch Hook response means received, not completed. The copied Zap must claim the event once before any Slack action, filter on `run=true`, and report the channel/message receipt after its last successful step. A repeated claim must return `run=false`; ambiguous sends remain locked. Keep read-only checks against the legacy ClickUp queue during transition so historical clients cannot be enrolled twice. Do not enable the new route, send a test hook or change an existing Zap until the separate flow is configured and validated. Questionnaire migration, AI briefing and the visual board remain separate next slices.

Active NBC admins open /onboarding, save an intake draft, review the consequences, explicitly start once, and receive a durable ClickUp receipt. Students/coaches cannot access this first admin-only release. Anas/Elias are existing admins. All records are NBC internal team records, not member onboarding or client tracker data.

Starting creates a top-level Task in ASCENDERS OS / Clients / Onboarding Queue (901417783941), triggering the EXISTING Zap: private elite-* channel, Elias invitation, Viktor invitation, welcome message with the questionnaire. Elias still adds the client to Slack; Skool/ELITE sharing/video are manual and are not marked complete by a ClickUp receipt. No Zap changes. No bulk migration of historical tasks. Existing matching primary email is linked without creating a task. Same channel name/different email blocks dispatch.

## Reliability

Durable UUID, unique normalized primary email and unique derived channel name; atomic draft -> starting claim. No automatic repeat of an external POST. Ambiguous writes stay uncertain and can only be reconciled by reading a unique marker in task descriptions. DB failure after external creation leaves the claim intact. Changing or retrying a started intake cannot create a replacement. Draft updates are revision-checked. Credentials remain server-only. No client-controlled list/field IDs or arbitrary fetch URLs.

## Validation

Unit/provider fixture tests, API authorization tests, rollback-only SQL checks, desktop/mobile browser fixtures, read-only real ClickUp schema validation. No test task is created in the production list because that triggers Slack. End-to-end live dispatch remains unverified until an admin deliberately starts a real client.

## Mapping (read from API, 2026-10-02)

Task name = client/company name; Client Email = ebef69b4-0e31-4b97-9dbc-3ed4a154cc0b; Partner 1 Name = 3f7d4180-261f-41bc-89fa-61f8e5367369; Partner 2 Email = d510dc53-d85f-4421-96a8-d6395f9804b7; Partner 2 Name = 9b7cd8a0-c779-42f9-af0d-8b53e8a36dc4; Fathom Recording Link = 7ea4090b-8204-4daa-93f4-953dfbdf991c; Google Doc Transcript Link = 9f3bf090-39e6-4f23-b49c-080cf55ad0e2. API status is `pending ` (trailing space). Custom fields are not API-required even though the intake form requires primary name/email/company; enforce these server-side.

No sales-call summaries, GHL close trigger, invitations, calendar sharing or questionnaire migration implemented in this slice. These remain subsequent connections. Operational state always distinguishes draft, starting, queued in ClickUp, existing task, uncertain, and needs review; it never labels overall onboarding complete.

Validation completed: provider/API fixtures passed; real schema and example task read-only checks passed; database unique-email, atomic-claim and role-grant assertions passed inside rollback; desktop/mobile browser fixtures passed (1440/390), including review confirmation and reload without re-dispatch. No live ClickUp task or Slack message created.

## Publication receipt

Published 2026-10-02 at https://nbc-sales-nbc-sales.vercel.app/onboarding, deployment `dpl_BwQHQjW7sHu3NxfLSFqLfqc2Qjxk`. The release combined this branch's source commit `6947d10` with the then-current production deployment `dpl_Egago6PuBwweALmcJYqCAnBrVa7s`. Source hashes outside this feature were preserved, including the newer tasks, tracker and scraper work. Do not redeploy bare main as a replacement for this combined release.

Both additive onboarding migrations were applied; the ClickUp key is encrypted in the production environment. Canonical URL verification passed with the actual NBC login and read-only ClickUp connection: anonymous API returns 401, authenticated page loads at desktop/mobile sizes without overflow or JavaScript errors. No real onboarding was started. The feature branch is `feature/client-onboarding-20261002`; its source remains separate from main pending the coordinated merge.

## Direct automation preparation — 2026-10-02

Implemented `ONBOARDING_TRANSPORT=zapier` behind server configuration; production remains on the existing ClickUp route until the copied Zap and controlled live validation are ready. URL configuration alone does not change the route. A pinned transport and atomic claim prevent double start and cross-provider fallback. The copied Zap obtains a one-time execution claim before Slack actions, then returns channel/message IDs through an event-scoped authenticated callback. The portal distinguishes pending delivery from Zap-reported Slack completion. ClickUp is still read for legacy duplicate checks during transition; its client questionnaire has not yet migrated.

Fixture validation passed for concurrent starts/claims, unauthorized/cross-event callbacks, completion before claim, repeated/conflicting receipts, timeout and late completion, callback-before-HTTP-response races, default transport changes, legacy duplicate prevention, and no ClickUp writes in direct mode. UI fixtures passed for both routes at 1440/390px. Build and typecheck passed. The additive migration was applied; rollback SQL checked constraints/claim/grants and left no test rows. No hook POST, Slack message, ClickUp task or real onboarding was created by these tests. Setup and cutover: `docs/integrations/onboarding-zapier.md`.

Published direct-automation preparation at the canonical portal on 2026-10-02: deployment `dpl_3yjNTfWZA86gtB75QqwRvtwyiPVk`, source commit `1f5ae46`, preserving the non-onboarding source of prior production `dpl_9QRZQ9R2fgGi16ghNt26SDzyWC8J`. Canonical NBC login, read-only ClickUp readiness, desktop/mobile layout, and anonymous/callback rejection checks passed. Shared workspace now contains the onboarding source and merged navigation to prevent later workspace deploys from omitting the module. Production stays ClickUp; webhook URL/copied Zap and approved live validation remain outstanding.
