# Plumbing: public business-contact candidate review

## Root correction, 2026-09-24 (supersedes the schema-failure conclusion below)

The claimed Austin schema removal did **not** reproduce. Root requested the exact adapter selection (`permit_number,contractor_trade,contractor_company_name,contractor_full_name,contractor_phone,contractor_zip,issue_date`) with `issue_date > '2025-09-24' AND contractor_phone IS NOT NULL`, limit 5, from `https://data.austintexas.gov/resource/3syk-w9eu.json`. Result: **HTTP 200, five rows, all seven fields represented**. No contact values retained. A sparse unfiltered sample is not proof of absent schema. Keep the working adapter. The earlier worker observation is preserved below as rejected evidence, not a current recommendation to disable it.

The reproducible gap is that plumbing remains recipe A and has no Austin mapping or plumbing-specific permit filter. Generic line, DNC and dedupe gates exist; a complete independent owner-confirmation gate is still proposed. Next: a plumbing-filtered distinct-business sample. No replacement endpoint is required on current evidence. The JSON diagram and measurement now reflect the root reproduction, n=5, verifiedPhones=0.

## Original worker observation (superseded where contradicted above)

Reviewed 2026-09-24. The live brain retains plumbing in recipe A with Anas's historical `expected_clean` 0.20 and `n` 200. Those historical values are not a result of this review and are not re-measured here.

## Hypothesis

For independent plumbing contractors, a public plumbing register or permit record can corroborate trade, activity, business, and a named role. It does not establish that the person owns the business or that a public telephone is the person's mobile. Start with the existing Maps-first plumbing route, preserve any licensee/qualifier/permit-contractor role as a candidate, and deliver only after separate ownership, line-type, reachability, DNC, and duplicate gates pass.

Texas illustrates the source boundary. The research maps plumbing to TSBPE, not TDLR, but records TSBPE license-search/list fields, cost, cadence, and terms as UNKNOWN. It is therefore not an implementable bulk source on this evidence. The public Austin permit endpoint had been cataloged as a plumbing activity/contact route, but its current response schema must be treated separately from that historical field description.

## Bounded free observation

On 2026-09-24, a free `limit=20` request to `https://data.austintexas.gov/resource/3syk-w9eu.json` returned 20 rows. The review retained only aggregate schema results: all 20 contained `issue_date`, and no response field matched `contractor` or `applicant`.

The current adapter selects `contractor_trade`, `contractor_company_name`, `contractor_full_name`, `contractor_phone`, and `contractor_zip`; that request returned HTTP 400. This is a schema-drift observation, not a plumbing-universe measurement: the unfiltered 20 rows cannot establish the current availability of plumbing permits, names, phones, mobile status, ownership, reachability, DNC outcome, or delivery yield. No contact values, names, or addresses were retained in this review.

## Workflow and failure cases

1. Discover a plumbing-positive business through the existing Maps-first route. The runtime profile accepts plumbing/plumber and related core terms; adjacent-only HVAC, septic, excavation, and water-heater results require review rather than proving plumbing fit.
2. If an active plumbing register or permit source is lawfully available, use it to corroborate trade, business, and a named candidate role. A licensee, qualifier, or permit filer is not owner-confirmed.
3. Treat a published number as a business contact. Dispatch lines, shared offices, and franchise lines must not become direct-owner or mobile claims without the existing separate gates.
4. Deliver only after an independently supported owner role and authorized contact/compliance outcomes pass. A failed or missing register/permit match leaves the record as a business lead, not an inferred owner lead.

| Failure case | Correction | Status |
| --- | --- | --- |
| Licensee, qualifier, or permit contractor is called the owner | Preserve the source role as candidate evidence and require independent owner proof. | Proposed |
| Dispatch/shared/franchise line is labeled an owner cell | Keep the number as business contact pending line, DNC, dedupe, and ownership gates. | Existing gates |
| Adjacent trades enter the plumbing cohort | Require a core plumbing match; hold adjacent-only or generic contractor results. | Implemented classifier |
| Austin permit coverage is assumed from the catalog | Block the adapter until a replacement endpoint/schema is verified. | Runtime defect |
| TSBPE becomes a free source by assumption | Leave the list fields, price, and terms UNKNOWN until directly verified. | Blocked |

## Iteration and implementation

The starting hypothesis treated the Austin permit data as current plumbing activity/contact-candidate evidence. Its live schema no longer exposes the columns required by `austinPermits`, and the adapter's explicit query fails. The free correction is to remove that route from active use or update it only after validating a new official schema. Plumbing otherwise remains implemented as recipe-A Maps discovery in `src/data/lead-engine-brain.json`, with core/adjacent relevance classification in `src/lib/lead-engine-industries.ts`; there is no plumbing-specific register adapter.

The material shared-runtime defect is in `src/lib/lead-engine-registers.ts`: `austinPermits` (around lines 801-804) sends an explicit select/filter for contractor fields that the current `3syk-w9eu` endpoint does not expose, causing an HTTP 400. The shared-owner correction is to disable this adapter or point it at a separately verified active endpoint/schema, and to add a regression fixture for the missing-column response before re-enabling it. This affects plumbing because the adapter was presented as an Austin contractor-phone/activity source, including plumbing, but it is not usable in its current state.

## Sources and remaining experiment

- `handoff/04_SOURCE_CATALOG.md`, Group A: TX TSBPE is UNKNOWN; Austin permits are the historical free route.
- `handoff/07_RESEARCH_BUILD_SPEC.md`, state-map TX detail and section 2.3: TSBPE boundary and Austin contractor-field claim.
- `src/data/lead-engine-brain.json`: current plumbing recipe-A route and historical benchmark fields.
- `src/lib/lead-engine-industries.ts`: plumbing core/adjacent classifier.
- `src/lib/lead-engine-registers.ts`: broken Austin endpoint query and row parser.

The next bounded experiment is a free 5-20 row aggregate field check from a replacement, legally usable public source that can be filtered to explicit plumbing records. It must report distinct denominators for source rows, named candidate roles, published business-contact fields, independently corroborated owners, and authorized line outcomes. No per-clean cost can be calculated until those owner/contact outcomes exist; `perCleanUsd` remains null.
