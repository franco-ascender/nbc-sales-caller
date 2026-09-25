# First live tests — readiness, 2026-09-25

## Latest instruction — user starts tests in the portal

### Portal delivered — user-operated tests

Published and enabled at https://nbc-sales-nbc-sales.vercel.app/test-center, with links from Caller, Lead Engine and the admin sidebar. The approved round owner (active admin) alone can access this private round. Provider settings and the destination remain server-side.

Postgres stores the USD 25 cap, approved slots and operations. Every user start locks the round and reserves its fixed upper bound before dispatch. Repeated clicks, reloads and uncertain provider responses cannot dispatch a second operation for the same slot. Only one operation can be active; unresolved dispatch blocks further starts. Stop acts on the recorded provider operation. Reservations are retained while partial receipts settle, and an observed overrun pauses the round. The limit is scoped to this portal round, not unrelated account usage or subscriptions.

Available phone action: the second approved attempt to Franco's phone, as Nalify speaking with a garage door business owner. Both providers cap this pilot call at ten minutes; this does not shorten the main telephone agent's two-hour setting. Updated only the dedicated pilot prompt to end on voicemail (including Spanish greetings) and avoid promising unavailable follow-up or booking tools. That behavioral correction still needs the user's real call to validate it.

Listing samples: 50 roofing, 25 chiropractors and 25 med spas per market, Miami FL and Charlotte NC, up to 200 candidates total. Miami roofing is already complete; the other five samples start individually from the portal. Discovery uses the existing Apify account, a pinned build and USD 0.50 Actor max charge with USD 0.75 reserved per search. These are published business listings with initial relevance, duplicate and chain checks. Owner identification and paid phone verification remain pending verified pricing, not represented as completed capabilities.

Earlier results imported without rerunning: one Miami search (50 listings, 46 initial candidates, USD 0.2002 Actor usage) and one phone attempt (21 seconds, voicemail). USD 3.25 remains reserved from those operations. The portal labels reported usage as partial, distinguishes it from reservations, and includes prior consumption in the same round. Transcripts, search evidence, CSV export and saved operator feedback are available for review.

Franco explicitly prohibited agent-run live tests. No new call, scrape, verification, purchase, subscription or top-up was initiated during this portal implementation. Both pilot CLI `--start` entrypoints fail before provider access; read-only reconciliation and Stop remain available. Only the user presses the live Start buttons. Outscraper remains suspended.

### Verification

Final production check passed with the phone button and all five remaining sample buttons enabled. The activation transaction preserved the two previous operations, USD 3.25 in reservations and USD 25 cap. Deployment: `dpl_GVZ7gJWRwzPRXuVxtjnNLDfC83zF`.

- TypeScript and production build pass; route/provider fixture tests cover ownership, auth, strict input, duplicate dispatch, timeout ambiguity, phone duration, Stop and free preflight.
- Ten live Postgres assertions passed inside a transaction rolled back afterward: role isolation, ownership, pause, duplicates, prior reservations, active-operation lock, stale observations, terminal state protection, cumulative cap and overrun pause. Existing two operations and USD 3.25 held budget were unchanged.
- Authenticated production browser checks use real login, inspect previous results, verify free provider readiness and desktop/mobile layout, and require anonymous API denial. They block every paid API action and never click Start.
- Private evidence: `artifacts/readiness/first-live-tests/portal-storage-checks.json`, `portal-readonly-check.json`, `portal-desktop.png`, `portal-mobile.png`. These contain local execution evidence and are excluded from Git/deployment.


Scope: first AI calls to Franco's own phone and small Lead Engine pilots. On September 25 Franco approved the proposed USD 25 total ceiling for this entire round. This supersedes the earlier no-spend instruction only for these bounded tests. Outscraper, subscriptions, top-ups, new phone numbers and campaigns remain outside authorization.

## Outscraper suspension — subsequent user instruction

Franco explicitly prohibited activating Outscraper after reporting an unexpected invoice. Paid search entrypoints in the TypeScript adapter, Python runner and historical executable are disabled before provider requests. The adapter's result reader accepts only `/requests/{id}` URLs so it cannot invoke a search through its polling argument. Credentials alone cannot enable execution. Existing dashboard job dispatch uses Apify. Free account reads and existing result reads remain possible; no account subscription, payment or external job was changed. Code-level suspension does not stop tasks started independently in the Outscraper account.

User-provided invoice OSFEFA7B4B-0008 is dated September 8, 2026: 106,600 Google Maps records, USD 305.10 total, USD 87.47 applied balance, USD 217.63 due. It provides no request IDs or attribution linking the charges to this project. The PDF remains outside the repository.

## User inputs

Update: Franco supplied his own destination and requested Nalify calling a garage door business owner who submitted their information. His portal scenario `Garage Door Business Owner` was found: lead generation, USD 2,500/month, qualification and meeting booking, skeptical prospect, prior-agency and budget objections. Keep the saved scenario intact; prepare a per-call brand/context override. Private destination and draft are in ignored `config/caller-pilot.local.json`, execution disabled. No further voice recordings or past transcripts are required for this pilot.

Requested scraper coverage is roofing, med spas and chiropractors in two states. Proposed starting markets: Miami, Florida and Charlotte, North Carolina. These markets remain proposals, not user-confirmed states or already-supported exact city filters on every route. Med-spa ownership/classification needs review before any paid enrichment; a clinician's NPI does not establish med-spa ownership.

### Approved first-round budget

USD 25 total incremental usage budget: USD 5 for up to two 10-minute telephone tests, USD 4 for two roofing samples, USD 4 for two chiropractor samples, and USD 12 for two med-spa samples. Per-market scraper allocation: USD 2 / USD 2 / USD 6 respectively. These are admission ceilings with contingency, not current provider quotes or guaranteed results. Target small auditable samples, approximately 50–100 businesses per market where available; never promise an owner mobile count. Stage the work with roofing Miami first and inspect quality/cost before the other markets.

Outscraper allocation is zero. No subscription changes, automatic top-ups, number purchases or broad campaigns are included. Provider minimum top-ups and current account entitlements must be checked separately; exceeding the approved test envelope requires new authorization. Implement/verify cumulative reservation, actual receipt reconciliation and limits across runs before executing. Earlier per-job estimates are code-derived forecasts, and the BatchData account rate is not freshly verified.

- Phone destination with country code; call timing once the implementation is ready.
- Optional scenario (default proposal: marketing agency qualification and meeting booking). Real offer, price range and qualifying criteria improve the simulation; synthetic details must be explicitly labeled in the test setup.
- Optional scraper niche/location (default proposal: roofing in Miami, FL). Published business contacts are candidates, not proof of direct owner mobile identity.
- Franco approved the concrete USD 25 ceiling in this conversation. Budget is separate from internal NBC credits and subscription balances.

### Operator pilot controls — design before implementation

Use a private durable SQLite ledger for this operator-run test round. Fixed allocations sum to 2,500 cents. Every external paid request needs a unique, persisted reservation before dispatch; a repeated/ambiguous request cannot dispatch again. Transactions serialize reservations across processes. Confirmed receipts record actual usage without recycling reservation capacity automatically. No automatic recovery deletes a lock, resets the ledger or tops up an account. Unknown pricing blocks that provider's paid stage.

The first discovery request is one pinned Apify build, roofing in Miami, at most 50 places and a provider-side USD 0.50 maximum. Read-only preflight verifies the active pricing model, account tier and available balance. Paid contact/review extras are off for this stage; phone validation and additional sources remain distinct stages, not claimed as tested by discovery. Retain source evidence and review data without contacting discovered businesses. This local pilot controller does not claim to impose an account-wide production spending cap. Existing product routes need their own reviewed enforcement before unattended operation.

The telephone pilot uses a dedicated authenticated ElevenLabs agent copied from the current brain/voice with the saved garage-door scenario and Nalify identity. It has a 600-second limit, one concurrent conversation, no bursting and no external tools. The existing production agent's two-hour setting remains intact. Register-call returns inline TwiML for one outbound Twilio request from the already-owned number to the user-supplied private destination. Twilio also receives `TimeLimit=600`, recording off and a bounded ringing timeout. A durable reservation precedes registration and dispatch; ambiguous POSTs are never retried. Operator commands read status/receipts and stop the specific call. This is an operator telephone test, not proof that the portal's future outbound queue/callback integration is complete.

## Engineering acceptance before dialing

Implement and test outbound Twilio dispatch, ElevenLabs connection, durable single-attempt claim, signed callbacks, Stop, recovery, results and cost reconciliation. Apply the completed migration, configure production and inventory with the existing voice-capable number, and verify remote voice/audio settings. Record destination-specific pricing before proposing the final paid pilot. Browser voice tests do not validate telephone delivery. The proposed early C08 60-second limit is obsolete relative to the user's later direction.

## Scraper acceptance

Audit spend admission and duplicate dispatch before a new paid run. Reconcile existing batches, verify route and provider support for the chosen niche/location, grant test credits only as necessary, and separate estimated costs from provider-confirmed receipts. A configured BatchData key is not a newly verified balance or successful phone check. The new jobs table being empty does not imply no prior scrapes.

## Balance refresh repair completed

The previous preflight `--apply` reset account reservation counters while two legacy discovery batches remained reserved for 53 and 121 cents. Live inspection found both discovery jobs marked `succeeded` but their corresponding financial batches still `reserved`.

Restored the account reservation to 174 cents using a database transaction, the same control-row lock as reserve/settle, and exact expected-state conditions. No batch was settled, retried or released. Balance snapshot remains 329 cents with zero consumed cents. Provider receipts still require reconciliation; do not describe the full balance as unreserved internal capacity.

The preflight now refuses balance refresh while reservations or consumption are outstanding. Idle refresh uses conditional PATCH without ledger counters; new account creation ignores conflicts instead of overwriting them. Concurrent changes fail closed. Four synthetic HTTP regression tests pass; they are not a real simultaneous database workload.

Evidence: ignored local `artifacts/readiness/reservation-repair.json`. No calls, number purchases, scraping or paid phone verification were performed during this readiness check. Full audit and telephone implementation remain outstanding.
