# CPA, accounting-firm, and tax-preparer workflow review

Reviewed 2026-09-24. The live brain routes CPA aliases to recipe B, not Maps. It maps Florida to `fl_cpa`, Illinois to `il_idfpr:cpa`, and Pennsylvania to `pa_pals:accountancy`; it explicitly forbids a Maps deliverable for CPAs. In Florida, an individual CPA register row carries the licensee street and the parcel lookup is skipped. In Illinois and Pennsylvania, the recipe-B path needs the configured parcel/home route before its trace step.

The route currently establishes an active individual credential and, after the generic recipe-B steps, a callable mobile. It does **not** establish that the licensee owns a CPA or accounting business, that a trace result is a publicly published business contact, or that an owner candidate owns the handset. Do not call these rows owner-confirmed.

## Hypothesis

An active individual CPA can be a candidate for a CPA-business owner workflow when an allowed public register supplies a person-level credential. A callable business contact requires separate line, reachability, DNC/TCPA, suppression, duplicate, and freshness results. An owner-labelled result additionally requires independent evidence that the person owns or founded the matched business and an explicit direct business-role link between that person and the contact. The last requirement is not wired into CPA delivery.

## Bounded five-case fixture audit

No live contact or provider request ran. The audit ran the existing `fl_cpa` test against its five-row local register fixture on 2026-09-24. The source fixture is already in the repository at `tests/fixtures/registers/fl_cpa.json`; this review retains only aggregate outcomes.

| Fixture class | Rows | Parser outcome |
| --- | ---: | --- |
| Current, active, future-expiring individual (`AC`) | 3 | Kept as person-level CPA candidates with street, city, ZIP, and credential facts. |
| Current, inactive individual (`AC`) | 1 | Held as `secondary_status_inactive`. |
| Firm (`AD`) | 1 | Omitted by the individual-only `flCpaRecord` adapter. |

The command `node --experimental-strip-types --test --test-name-pattern='fl_cpa|il_idfpr' tests/lead-engine-registers.test.ts` passed both relevant adapter tests. The Illinois fixture test separately confirms the active individual CPA segment and `businessType: CPA` filter, but is outside this five-row measurement denominator.

This is a fixture/code audit, not a live source-coverage, business-ownership, phone, mobile, reachability, DNC/TCPA, handset, or delivery measurement. `verifiedPhones` is zero.

## Workflow and failure cases

1. Read the mapped person-level register. Hold inactive, expired, out-of-state, entity, or non-CPA rows. In Florida, firm rows are not entered through the individual adapter.
2. Preserve an active licensed individual as an owner **candidate**, not owner evidence. For IL and PA, constrain the route to the `CPA`/`Accountancy` register filter.
3. For the existing recipe-B route, resolve an eligible home/address path only as currently implemented, then process the resulting number through mobile, reachability, DNC/TCPA, suppression, duplicate, freshness, and timezone gates.
4. Hold office lines, shared/reused contacts, non-mobile or non-reachable results, DNC/TCPA results, missing timezone, and stale verification.
5. Before any future owner-confirmed delivery, require `assessOwnerEvidence`-equivalent independent owner/founder evidence and explicit direct business-contact evidence for the same business and phone. Hold employee, staff, firm-only, multi-preparer, conflicting, front-desk, or unlinked evidence.

| Failure | Correction | Status |
| --- | --- | --- |
| A valid individual CPA credential is represented as proof that the person owns an accounting business. | Keep it as a credentialed owner candidate; require independent owner/founder evidence matched to the business. | Proposed |
| A trace-derived mobile is represented as a published business line or the licensee's handset. | Preserve trace provenance and require an explicit direct business-role link to the same phone before any owner label. | Proposed |
| Florida `AD` firm records are silently excluded while `AC` individual records proceed. | Surface the scope in route reporting; add an approved firm-to-responsible-licensee join only after its owner semantics are verified. | Proposed |
| Illinois and Pennsylvania recipe-B candidates can proceed through generic tracing/delivery without the owner-evidence helper. | Invoke the existing assessment with trusted evidence before owner-labelled delivery; otherwise hold the owner claim. | Blocked shared-runtime correction |
| Generic verification is described as ownership verification. | Keep mobile, reachability, DNC/TCPA, suppression, duplicate, freshness, and timezone controls as contact/compliance checks only. | Implemented |

## Source and implementation evidence

The brain mappings and Maps prohibition are implemented in `src/data/lead-engine-brain.json`, `src/lib/lead-engine-jobs.ts`, and `src/lib/lead-engine-gates.ts`. The relevant free register adapters are implemented in `src/lib/lead-engine-registers.ts`: Florida keeps current active individual `AC` rows; Illinois queries active non-business individual CPA rows; Pennsylvania parses active Accountancy/Real Estate records and the brain filter selects Accountancy.

The free IRS PTIN extract is catalogued and has an adapter, but it is not mapped as the live `cpa` brain route. The catalog reports a published business phone and DBA fields, yet that is not owner or handset proof and no PTIN live sample was run here. The build specification describes broader CPA routes and paid verification/append steps; none of those are evidence of this route being wired or of a measured CPA owner-contact outcome.

The material implementation defect is in `src/services/lead-engine-jobs.service.ts`: `settleVerified` can deliver a recipe-B row after generic phone/compliance gates without calling `src/lib/lead-engine-research.ts` `assessOwnerEvidence`. It also labels recipe-B workbook rows as “skip traced to the owner's home,” although the active CPA credential and trace match do not independently prove business ownership or a direct owner contact. The correction is to store trusted owner-evidence inputs and require a supported assessment before an owner-labelled CPA export; records without it should remain callable-contact candidates or be held, depending on the product's delivery policy.

## Remaining measurement

After that correction, run a lawful 5–20 row aggregate public-business-contact test only from a catalog-verified endpoint. Report separate denominators for active credentialed people, business matched, independent owner-supported, published business contact, mobile, reachable, DNC/TCPA-clear, suppression/duplicate-clear, direct owner-contact-supported, and delivered rows. Do not use a residential or property source to discover an unpublished personal phone, and do not use DMV, South Carolina, or Utah forbidden sources. `perCleanUsd` remains null until an approved outcome study measures it.

## Root integration regression check, 2026-09-24

Export status no longer infers ownership or a home trace from recipe B. Current phone clearance and source-role identity remain distinct from independently supported ownership; the proposed owner-evidence pipeline is not yet wired.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
