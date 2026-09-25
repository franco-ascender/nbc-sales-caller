# Remodeling industry workflow review

Reviewed 2026-09-24. The live brain retains remodeling as recipe A, with Anas's historical `expected_clean` 0.20 and `n` 1000. This review does not alter or re-measure those statistics.

## Hypothesis

An active home-improvement contractor or a recent general-contractor permit can corroborate that a business performs remodeling work, but a qualifier, permit contractor, or published business phone is only a candidate. An owner-confirmed mobile requires separate ownership evidence plus line-type, live, DNC, and delivery-dedupe gates.

Austin's current permit endpoint is usable again: it exposes contractor and applicant fields, contrary to the now-stale failure described in the plumbing review. It is a general construction activity source, however, and does not itself identify a remodeling job or establish that the named permit contractor owns the firm or its phone.

## Free bounded observation

I performed an aggregate-only current schema audit of the catalog's VERIFIED Austin Issued Construction Permits endpoint, `https://data.austintexas.gov/resource/3syk-w9eu.json`. I retained no names, addresses, or phone values. The dataset metadata exposed 78 columns including `contractor_trade`, `contractor_company_name`, `contractor_full_name`, `contractor_phone`, and the corresponding applicant fields. A configured adapter-style `$select` of the seven contractor fields returned HTTP 200.

For records issued after 2025-09-24, the endpoint returned these aggregate counts:

| Measure | Result |
| --- | ---: |
| Permit rows | 55,154 |
| `contractor_trade` present | 51,761/55,154 |
| `contractor_company_name` present | 50,077/55,154 |
| `contractor_full_name` present | 50,904/55,154 |
| `contractor_phone` present | 51,118/55,154 |

The adapter's checked-in six-row Austin fixture has all four contractor fields on 6/6 rows, but contains general, mechanical, and electrical contractors and no remodeling-specific designation. It is fixture evidence, not a live outcome measurement.

This verifies current field availability and approximate current coverage only. It does not measure remodel relevance, business size, independent status, mobile line type, reachability, DNC status, ownership, handset ownership, or delivery. `verifiedPhones` remains zero.

## Workflow

1. Start with the live recipe-A remodeling discovery query, `kitchen remodeling`, and require remodeling, renovation, kitchen/bath remodel, or design-build evidence.
2. Reject or hold a generic contractor, a trade-only subcontractor, cabinet/floor/tile-only business, franchise, or commercial-only builder unless independent remodeling evidence is present.
3. Where lawful and available, use a contractor register or current Austin permit only to corroborate trade/activity and preserve its named role as a candidate. A permit's `contractor_full_name` is a permit contact, not owner proof.
4. Retain a published business phone once; a phone with repeated use across firms or no separate ownership evidence remains a business-contact candidate.
5. Apply existing mobile line-type, live, DNC, global dedupe, and independent owner-evidence gates. Deliver only a supported classification.

## Industry-specific failure cases and correction

| Failure | Why it matters for remodeling | Mitigation | Status |
| --- | --- | --- | --- |
| Generic contractor is classified as remodeler | The current `allow` pattern includes `contractor`; permits include general, mechanical, and electrical work. | Require a positive remodel/renovation/design-build signal; hold trade-only and generic contractor rows. | Partial runtime classifier |
| Kitchen, bath, cabinet, flooring, or tile work is assumed to be full-service remodeling | Adjacent specialists may be valid businesses but do not establish the target service. | Require an explicit remodel signal or route to the more specific industry for review. | Implemented classifier taxonomy; not enforced on permit rows |
| Permit contractor is labeled owner | A filer, employee, qualifier, or office contact can appear on a valid permit. | Preserve `Permit Contractor` as a candidate role and require independent owner evidence. | Partial adapter semantics |
| Permit phone is labeled a direct owner mobile | Current field presence says only that the city published a contractor contact. | Apply line type, live, DNC, phone-reuse/dedupe, and owner-evidence gates before delivery. | Existing downstream gates |
| Austin field removal is assumed from stale evidence | The live public schema currently contains contractor and applicant fields and accepts the adapter select. | Replace the stale schema-failure assumption with a periodic schema guard; freeze only if a required field is again absent. | Runtime guard proposed |

## Iteration completed

The initial decision was whether the Austin route remained blocked after the schema concern. A bounded live metadata and aggregate audit found the contractor fields present and the current adapter select accepted. The correction is not to use Austin automatically for remodeling: make it an optional general-contractor activity/candidate route, then require remodel-specific relevance and independent ownership evidence.

## Source record

| Source | Tag | Exact reference | Use | Status |
| --- | --- | --- | --- |
| Live remodeling brain entry | VERIFIED runtime configuration | `src/data/lead-engine-brain.json`, `industries.remodeling`; `src/lib/lead-engine-brain.ts` | Current Maps-first recipe A; preserve Anas statistics | Implemented |
| Remodeling relevance profile | VERIFIED runtime implementation | `src/lib/lead-engine-industries.ts`, `PROFILES` remodeling entry | Core/adjacent vocabulary | Partial: permit rows do not use it |
| Austin Issued Construction Permits | VERIFIED live schema observation | `https://data.austintexas.gov/resource/3syk-w9eu.json`; `https://data.austintexas.gov/api/views/3syk-w9eu`; `src/lib/lead-engine-registers.ts`, `austinPermits` | General-contractor activity, named permit-contractor candidate, and published business-contact candidate | Implemented adapter, not routed to remodeling |
| Austin permit fixture | Fixture | `tests/fixtures/registers/austin_permits.json` | Parser field-shape regression fixture; mixed trades, not a remodeling sample | Implemented test fixture |
| Home-services research catalog | REPORTED historical coverage statement | `handoff/04_SOURCE_CATALOG.md`, Austin row; `handoff/07_RESEARCH_BUILD_SPEC.md`, sections 5.1 and permit table | Candidate-source background only; live audit supersedes stale schema claim | Proposed workflow decision |

## Cost and remaining measurement

The schema audit has $0 input cost. It has no clean delivered owner-contact result, so per-clean cost is null. Historical Anas remodeling rates use a different denominator and remain outside this source-field audit.

Next, add a synthetic runtime test that a remodeling job cannot select `austin_permits` until its permit trade/business evidence also passes remodel relevance, and that a `Permit Contractor` plus phone cannot produce an owner label. After authorization, run a 5-20 row aggregate-only Austin query with an explicit lawful remodel classifier and separately measure relevance, phone line type, DNC, reachability, owner confirmation, and delivery.

## Runtime defect for shared-owner review

The source itself is not currently schema-broken: `src/lib/lead-engine-registers.ts` function `austinPermits` selects existing fields and the live endpoint accepts that select. The material routing gap is that `src/data/lead-engine-brain.json` gives remodeling recipe A with no `register_source`, so Austin permits cannot be used as optional activity corroboration for remodeling at all. If root enables it, the mapping must include a remodeling-specific filter; `austinPermitRow` currently stores `contractor_trade` as `businessType`, and no current path applies `src/lib/lead-engine-industries.ts` remodeling relevance to those register rows. Without that filter, a general, mechanical, or electrical permit can be admitted as remodeling.
