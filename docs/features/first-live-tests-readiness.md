# First live tests — readiness, 2026-09-25

Scope: one AI call to Franco's own phone and one small Lead Engine pilot. User asked what input is needed and requested an audit. No permission to purchase numbers or spend on new provider runs has been given in this step. The prior no-spend instruction remains applicable.

## Outscraper suspension — subsequent user instruction

Franco explicitly prohibited activating Outscraper after reporting an unexpected invoice. Paid search entrypoints in the TypeScript adapter, Python runner and historical executable are disabled before provider requests. The adapter's result reader accepts only `/requests/{id}` URLs so it cannot invoke a search through its polling argument. Credentials alone cannot enable execution. Existing dashboard job dispatch uses Apify. Free account reads and existing result reads remain possible; no account subscription, payment or external job was changed. Code-level suspension does not stop tasks started independently in the Outscraper account.

User-provided invoice OSFEFA7B4B-0008 is dated September 8, 2026: 106,600 Google Maps records, USD 305.10 total, USD 87.47 applied balance, USD 217.63 due. It provides no request IDs or attribution linking the charges to this project. The PDF remains outside the repository.

## User inputs

Update: Franco supplied his own destination and requested Nalify calling a garage door business owner who submitted their information. His portal scenario `Garage Door Business Owner` was found: lead generation, USD 2,500/month, qualification and meeting booking, skeptical prospect, prior-agency and budget objections. Keep the saved scenario intact; prepare a per-call brand/context override. Private destination and draft are in ignored `config/caller-pilot.local.json`, execution disabled. No further voice recordings or past transcripts are required for this pilot.

Requested scraper coverage is roofing, med spas and chiropractors in two states. Proposed starting markets: Miami, Florida and Charlotte, North Carolina. These markets remain proposals, not user-confirmed states or already-supported exact city filters on every route. Med-spa ownership/classification needs review before any paid enrichment; a clinician's NPI does not establish med-spa ownership.

### Proposed first-round budget (not approved)

Recommend USD 25 total incremental usage budget: USD 5 reserved for up to two 10-minute telephone tests, USD 4 for two roofing samples, USD 4 for two chiropractor samples, and USD 12 for two med-spa samples. Per-market scraper allocation: USD 2 / USD 2 / USD 6 respectively. These are proposed admission ceilings with contingency, not current provider quotes, guaranteed results or already-enforced global limits. Target small auditable samples, approximately 50–100 businesses per market where available; never promise an owner mobile count. Stage the work with roofing Miami first and inspect quality/cost before the other markets.

Outscraper allocation is zero. No subscription changes, automatic top-ups, number purchases or broad campaigns are included. Provider minimum top-ups and current account entitlements must be checked separately; exceeding the approved test envelope requires new authorization. Implement/verify cumulative reservation, actual receipt reconciliation and limits across runs before executing. Earlier per-job estimates are code-derived forecasts, and the BatchData account rate is not freshly verified.

- Phone destination with country code; call timing once the implementation is ready.
- Optional scenario (default proposal: marketing agency qualification and meeting booking). Real offer, price range and qualifying criteria improve the simulation; synthetic details must be explicitly labeled in the test setup.
- Optional scraper niche/location (default proposal: roofing in Miami, FL). Published business contacts are candidates, not proof of direct owner mobile identity.
- Anas's approval for a concrete test budget before any paid invocation. Budget is separate from internal NBC credits and subscription balances.

## Engineering acceptance before dialing

Implement and test outbound Twilio dispatch, ElevenLabs connection, durable single-attempt claim, signed callbacks, Stop, recovery, results and cost reconciliation. Apply the completed migration, configure production and inventory with the existing voice-capable number, and verify remote voice/audio settings. Record destination-specific pricing before proposing the final paid pilot. Browser voice tests do not validate telephone delivery. The proposed early C08 60-second limit is obsolete relative to the user's later direction.

## Scraper acceptance

Audit spend admission and duplicate dispatch before a new paid run. Reconcile existing batches, verify route and provider support for the chosen niche/location, grant test credits only as necessary, and separate estimated costs from provider-confirmed receipts. A configured BatchData key is not a newly verified balance or successful phone check. The new jobs table being empty does not imply no prior scrapes.

## Balance refresh repair completed

The previous preflight `--apply` reset account reservation counters while two legacy discovery batches remained reserved for 53 and 121 cents. Live inspection found both discovery jobs marked `succeeded` but their corresponding financial batches still `reserved`.

Restored the account reservation to 174 cents using a database transaction, the same control-row lock as reserve/settle, and exact expected-state conditions. No batch was settled, retried or released. Balance snapshot remains 329 cents with zero consumed cents. Provider receipts still require reconciliation; do not describe the full balance as unreserved internal capacity.

The preflight now refuses balance refresh while reservations or consumption are outstanding. Idle refresh uses conditional PATCH without ledger counters; new account creation ignores conflicts instead of overwriting them. Concurrent changes fail closed. Four synthetic HTTP regression tests pass; they are not a real simultaneous database workload.

Evidence: ignored local `artifacts/readiness/reservation-repair.json`. No calls, number purchases, scraping or paid phone verification were performed during this readiness check. Full audit and telephone implementation remain outstanding.
