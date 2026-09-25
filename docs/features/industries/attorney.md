# Attorney workflow review

Reviewed 2026-09-24. The generic `attorney` brain entry is a legacy recipe-B route: it begins with a firm-name scrape and then requires a home/parcel and paid trace path. That is not an acceptable route for this review because it uses private/residential contact discovery. The runtime's never-Maps guard prevents a Maps listing from becoming the attorney deliverable, but the generic route has no mapped public business-contact register and therefore correctly blocks instead of falling back.

New York is the available free, public business-contact alternative. The distinct `attorney_ny` entry maps to the NYS Attorney Registrations dataset (`eqw2-r5nb`), which publishes the attorney, firm, office address, and office phone under 22 NYCRR 118. It is an office-contact candidate, not proof that a person owns a firm, owns a handset, or can be called without the ordinary line, reachability, DNC/TCPA, suppression, freshness, and timezone gates.

## Hypothesis and five-case fixture audit

For an attorney workflow, a current NY registration with a firm and its published register phone is a lawful business-contact candidate. A surname appearing in the firm name is a useful owner-probability signal, but it is not owner confirmation. A phone shared across several attorneys is an office or switchboard signal, not a direct mobile.

I ran the focused `ny_attorneys` local fixture test on 2026-09-24:

`node --experimental-strip-types --test --test-name-pattern='ny_attorneys' tests/lead-engine-registers.test.ts`

The test passed. This review uses five of its eight saved NY register rows as the bounded audit denominator. All five are currently registered NY attorneys with a firm and normalized office-phone field; none has a surname match in the firm name, so the parser assigns `Attorney`, rather than `Named Partner`. The existing paired synthetic assertion changes the surname to `CHARTWELL` and verifies that the parser assigns `Named Partner`; a `Delinquent` variation is held as `status_not_registered`.

This is a fixture/code audit only. It made no network request, paid verification, private/address lookup, phone lookup, or contact compilation. It does not measure business coverage, practice-area fit, mobile rate, reachability, DNC/TCPA, ownership, direct-contact support, or delivery. `verifiedPhones` is zero.

## Workflow and failures

1. For generic attorney requests, hold the legacy recipe-B route: do not use parcel, residential, or private-phone enrichment. A Maps scrape may not substitute as the deliverable.
2. For NY only, read the current NY court registration and keep its published firm and office phone as public business-contact evidence.
3. Hold inactive, non-person, missing-firm, missing-phone, or shared/switchboard contact candidates. A surname-in-firm match is only an owner-probability signal.
4. Require the normal phone and compliance gates before a callable business contact. Do not describe those gates as ownership proof.
5. Before any owner-confirmed attorney label, require separately stored, current owner/founder evidence and an explicit direct-business-contact link for the same firm and phone. Otherwise retain a business-contact candidate or hold it, according to delivery policy.

| Failure | Correction | Status |
| --- | --- | --- |
| Generic `attorney` recipe B moves from a firm name toward home/parcel and skip tracing. | Keep the generic route blocked; use only an independently eligible public business-contact source. | Implemented runtime block / proposed route replacement |
| A Google Maps listing becomes the attorney deliverable. | Preserve `NEVER_MAPS_DELIVERABLE` for `attorney` and `attorney_ny`; do not enable fallback delivery. | Implemented |
| `surnameInFirm` is presented as an actual partnership or ownership fact. | Store it as a heuristic candidate signal; require independent owner/founder evidence for an owner label. | Blocked shared-runtime correction |
| A published NY office phone is called the attorney's personal mobile or handset. | Treat it as a business-line candidate; require line, reachability, DNC/TCPA, suppression, freshness, timezone, and direct-contact evidence separately. | Proposed |
| A shared firm switchboard is treated as a direct contact. | Compute a source-phone reuse threshold before selecting a direct-contact candidate; hold high-reuse rows. | Proposed shared-runtime correction |

## Source and implementation evidence

`nyAttorneys` in `src/lib/lead-engine-registers.ts` filters `status='Currently registered' AND state='NY'`, normalizes the register phone, and labels a surname-in-firm record `Named Partner`. `pullNames` filters register rows with `reuse_count <= 3`, but no attorney-specific owner-evidence assessment is called by `settleVerified`; any recipe-D mobile that passes generic contact gates can be delivered.

The material shared-runtime defect is `src/services/lead-engine-jobs.service.ts` `settleVerified`: it delivers register-derived rows after generic verification without calling `src/lib/lead-engine-research.ts` `assessOwnerEvidence`. Thus NY attorney rows can be exported in an owner-cell product with only a surname heuristic and line/compliance checks. The safe correction is to retain a published business-contact delivery class separately and, for an owner-confirmed label, persist trusted evidence and require `assessOwnerEvidence(...).status === 'supported'`; otherwise hold the owner claim. The correction must not revive the generic attorney recipe-B residence/trace branch.

## Remaining measurement

After the correction, run a 5–20 row aggregate test only against the catalog-verified NY public register. Report separate denominators for current NY registrations, named/solo firm candidates, unique published business phones, matched businesses, supported owner evidence, mobile, reachable, DNC/TCPA-clear, suppression/duplicate-clear, direct-business-contact-supported, and delivered rows. Do not collect personal phones or residential addresses, and keep `perCleanUsd` null until a lawful outcome study measures it.

## Root integration regression check, 2026-09-24

The never-Maps delivery/quote guard now covers attorney_ny as well as attorney. Export status no longer represents a recipe-B public register number as traced to a home or owner-confirmed.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
