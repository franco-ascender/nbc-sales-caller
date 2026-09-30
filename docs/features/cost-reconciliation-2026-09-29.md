# Cost reconciliation and scraper review

Branch: `feature/portal-updates-2026-09-29`. Keep changes on the review deployment; do not merge or repoint production.

## Findings

The previous operation report omitted 20 saved browser voice sessions. Eleven session usage also exists in `nbc_usage_events`; adding both tables would double count it. Sixty-six historical BatchData checks have no saved rate. Do not fill those with today's price. Two phone operations identify an unrecognized `neuron` engine; keep their cost unmapped rather than attributing it to Twilio/ElevenLabs.

Read-only checks of five Apify runs and two Retell calls succeeded. An Apify chiropractor search had $0.0402 saved versus $0.1002 in the latest run receipt. Four other Apify rows had a one-microdollar rounding difference. Retell receipts matched. The admin reconciliation action updated those seven records using optimistic version checks; no calls, searches, datasets or phone verifications were dispatched.

The supplied Outscraper document OSFEFA7B4B-0008, issued September 8, records 106,600 Google Maps records: $305.10 total, $87.47 applied balance, $217.63 due. This is not evidence of payment, is not attributed to the portal's five searches, and is not added to their usage. The original PDF stays outside the repository; only its reference and billing figures are stored in the private billing table.

After reconciliation the database contains $2.430249 in known operation/session components across 33 records. This is **not total account spending**. Twenty operations have incomplete cost coverage; 77 component gaps include the 66 unpriced checks. Counts and amounts are a snapshot, not constants in application code.

## Accounting rules

- Provider receipts, saved-rate estimates, spending authorizations, internal settlements, invoices, and prepaid credit purchases remain distinct.
- Retell `combined_cost` is cents. Convert once to micro-USD. Included product costs are explanatory; do not add them again or create another ElevenLabs/Twilio charge.
- Apify `usageTotalUsd` is the run receipt. Account storage, external dataset reads, subscriptions and outside activity require separate reconciliation.
- A partial/missing receipt cannot yield a final per-minute or per-mobile price.
- Per-mobile metrics use currently qualified phones, including verification freshness. They are not historical delivery snapshots.
- Browser sessions are read once; matching phone provider IDs are excluded. Usage events without session matches and legacy job/batch settlements are shown separately for reconciliation.
- Invoice totals are not summed with usage; subscription credits and prepayments can overlap. Original currencies remain separate; no invented FX conversion.
- Billing entries are immutable, admin-only, and source-referenced. They do not charge a card or prove payment. Current UI supports invoice and prepayment documents; credit notes/corrections need a follow-up accounting flow.
- This is an account-wide admin report. It does not alter ownership/access to call trials.

## UI and maintenance

Lead Engine → Costs & yield; Caller → Analytics; existing Admin Usage all use the same report. Filters cover product, industry and UTC operation dates. CSV export follows the filtered operation rows. Billing documents explicitly stay account-wide and unfiltered.

Lead Engine → Build Search now shows a selected-list summary, phone-type distribution, current qualified mobile yield and known costs. Existing per-action cost approvals, checks and export/handoff controls remain.

Refresh loads saved data only. Reconcile Apify & Retell receipts issues bounded read-only provider requests for up to ten oldest eligible completed operations; writes only receipt fields under an optimistic version guard. It never reads paid datasets. Historical Twilio/Eleven receipts, unpriced BatchData checks and account invoices still require reconciliation.

`nbc_billing_statements` is RLS protected and grants no access to authenticated/anonymous DB roles. Only admin server routes can insert or read it. Apply `202609290100_billing_statements.sql` before deploying this code. The supplied invoice was recorded separately after inspecting the PDF, not seeded through a migration.

## Validation

473 unit tests passed, including amount identity, incomplete-receipt unit pricing, bundled-cost deduplication, session overlap and admin authorization. Production build passed. `scripts/check-cost-dashboard.mjs` verifies desktop/mobile, costs access and the scraper summary; it blocks paid operation POSTs. Optional `--reconcile` reads known receipts only. Set `NBC_CHECK_ORIGIN` for the branch review deployment.

## Provider semantics

- [Apify run receipt and usage fields](https://docs.apify.com/api/v2/actor-run-get)
- [Apify resource usage components](https://docs.apify.com/api/client/js/reference/interface/ActorRunUsage)
- Retell monetary unit and product breakdown were checked against the authenticated saved call responses and existing receipt parser.

## Still required to claim a reconciled account total

Provider statements/paid invoices and billing periods for Retell, ElevenLabs, Twilio, Apify, BatchData, Vercel and Supabase; any other paid tools; historical BatchData pricing or a usage receipt; allocation of shared infrastructure/plan credits; tax and payment evidence. None of these are silently treated as zero. Outscraper remains inactive for paid work.
