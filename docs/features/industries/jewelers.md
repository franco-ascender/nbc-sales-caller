# Jewelers industry workflow review

Reviewed 2026-09-24. The live brain sends `jewelers` through recipe A with the Maps keyword `jewelry store`. That starts with a published business contact, not an owner identity or a direct owner handset. Neither a storefront listing nor a mobile-line result establishes who owns the business or the phone.

## Hypothesis

A core jewelry-business listing can enter published-business-contact processing only after relevance, chain, line, compliance, duplicate, and freshness checks. It remains a business-contact candidate until independent public evidence connects a named owner or founder to the same business and explicitly links the published number to that person in a business role. There is no implemented jewelry owner register or owner-confirming adapter.

## Bounded five-case code audit

No jewelry-specific endpoint appears in `handoff/04_SOURCE_CATALOG.md` or `handoff/07_RESEARCH_BUILD_SPEC.md`, so there was no catalog-verified free endpoint suitable for a live sample. The bounded audit instead ran five synthetic inputs through the live `parseDiscoveryCandidate` function in `src/lib/lead-engine-scrape.ts` on 2026-09-24. The inputs used synthetic valid Maps URLs and numbers; no contact values were retained or verified, and no network, credential, paid-provider, or source call occurred.

| Synthetic title/category | Result | Interpretation |
| --- | --- | --- |
| Harbor Jewelry / Jewelry store | `fitTier: null`, `no_positive_relevance` | Incorrectly rejected |
| Harbor Jeweler / Jeweler | `fitTier: null`, `no_positive_relevance` | Incorrectly rejected |
| Harbor Jewelers / Jewelry store | `fitTier: core`, accepted | The plural spelling alone passes |
| Harbor Watch Repair / Watch repair service | `fitTier: null`, `no_positive_relevance` | Correctly held |
| Harbor Pawn / Pawn shop | `fitTier: null`, `no_positive_relevance` | Correctly held |

This audit measures parser/classifier behavior only. It measures no listing coverage, business ownership, handset relationship, mobile classification, reachability, DNC/TCPA status, or delivery. `verifiedPhones` is zero.

## Workflow

1. Start with the current recipe-A Maps discovery listing and retain the number only as a published business-contact candidate.
2. Require a jewelry core signal. Hold pawn, watch-repair, appraisal, engraving, consignment, precious-metals buyer, antique, manufacturer, and generic retail results unless an explicit jewelry-retail or jeweler signal is also present.
3. Apply the existing chain check. A surviving untagged listing is still not evidence that an individual owns it.
4. Apply mobile classification, reachability, DNC/TCPA, suppression, duplicate, and freshness gates. Passing them authorizes a contact as callable under the current recipe; they do not prove owner or handset identity.
5. For a future owner-labelled outcome, require independent ownership evidence and a direct business-role link between that person and the published number. Hold missing, conflicting, franchise, or front-desk evidence.

## Failure cases and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| Normal singular `Jeweler` and `Jewelry` listings are rejected before the brain allow expression is applied. | Add a `jewelers` profile with aliases for `jeweler`, `jewelers`, `jewelry`, and `jewelry store`; use jewelry/jeweler terms as core. Keep watch repair, appraisal, engraving, pawn, precious-metals buying, consignment, antiques, and generic retail as adjacent or unmatched unless a core signal co-occurs. Add the five parser fixtures as a regression test. | Blocked shared-runtime correction |
| Pawn, watch-repair, appraisal, engraving, consignment, precious-metals, antique, manufacturer, or generic retail listings are called jewelry stores. | Require the core jewelry signal; adjacent-only and ambiguous listings remain held. | Proposed |
| An advertised business number or a verified mobile is called the owner's personal handset. | Preserve the published-business-contact purpose and require separate owner and direct-business-role evidence; never use addresses to seek private numbers. | Implemented for line/compliance gates; owner linkage proposed |
| A brand, multi-location retailer, or franchise is treated as independently owner-operated. | Preserve the existing chain result and hold ownership claims until business-specific independent evidence is recorded. | Implemented for generic chain filtering; proposed for ownership evidence |
| A website/review owner mention, staff listing, or front-desk contact is promoted to owner-confirmed. | Require two independent sources under `assessOwnerEvidence`, including a linked direct business contact and an owner/founder role; conflicting or front-desk evidence holds. | Implemented helper; not wired as a jewelry delivery requirement |

## Evidence and remaining measurement

The brain route and keyword are VERIFIED implementation evidence in `src/data/lead-engine-brain.json` and `src/lib/lead-engine-brain.ts`. The parser result is VERIFIED by the five-case local code audit. The global published-contact and delivery gates are VERIFIED in `src/lib/lead-engine-quality.ts` and `src/lib/lead-engine-gates.ts`. The owner-evidence helper is VERIFIED in `src/lib/lead-engine-research.ts`, but it is not an industry-specific jewelry source and does not by itself make the current job workflow owner-confirming.

The source catalog and build specification have no jewelry/jeweler entry. That absence is an actual bounded result, not evidence that no lawful source exists. No free jewelry owner-source sample was run. A later authorized experiment should first identify a legally eligible public business-contact endpoint, then report separate denominators for source rows, core-qualified rows, chain-held rows, published-business contacts, mobile/reachable/DNC/TCPA-cleared contacts, independently owner-confirmed contacts, and owner-to-handset evidence. It must not use a filing, residential, or property address to discover an unpublished personal number.

## Root integration regression check, 2026-09-24

Dedicated singular/plural jewelry aliases now pass discovery. Watch/pawn/antiques-only rows remain outside the narrow cohort. Historical benchmark fields were not changed.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
