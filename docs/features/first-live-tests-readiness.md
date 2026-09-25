# First live tests — readiness, 2026-09-25

Scope: one AI call to Franco's own phone and one small Lead Engine pilot. User asked what input is needed and requested an audit. No permission to purchase numbers or spend on new provider runs has been given in this step. The prior no-spend instruction remains applicable.

## User inputs

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
