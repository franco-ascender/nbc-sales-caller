# Auto-body industry workflow review

Reviewed 2026-09-24. The live brain keeps `auto_body` in recipe A with historical Anas `expected_clean` 0.16 and `n` 45. Those historical figures are neither reproduced nor treated as a phone or owner-confirmation measurement here.

## Hypothesis

An independent auto-body or collision-repair listing with a published business number can begin a business-contact workflow. The listing, its number, a collision-service claim, or a person named in a public business record do not prove current ownership or an owner-confirmed mobile.

No owner-confirming auto-body adapter is implemented. The catalog reports NJ MVC auto-body facility licensing, but its list access and fields are UNKNOWN. It cannot be treated as a live owner source. The implemented recipe-A Maps route supplies a published business-contact candidate only.

## Bounded fixture observation

I ran a five-case runtime fixture audit on 2026-09-24 against `parseDiscoveryCandidate`, the live `auto_body` brain allow regex, and `isChain`. It made no external calls and used no contact data.

| Fixture | Relevance result | Discovery result | Brain allow | Chain result |
| --- | --- | --- | --- | --- |
| Precision Auto Body | core | accepted | accepted | none |
| Independent Collision Center | null | `no_positive_relevance` | accepted | none |
| Metro Auto Glass | null | `no_positive_relevance` | accepted | none |
| Downtown Auto Repair | null | `no_positive_relevance` | accepted | none |
| Caliber Collision Albany | null | `no_positive_relevance` | accepted | `caliber collision` |

The hypothesis failed for a standalone collision business: there is no `auto_body` relevance profile, so the fallback matcher recognizes only the literal normalized phrase `auto body`. The secondary regex, `body|collision|auto`, is too broad: it accepts all five fixtures, including glass and mechanical repair. For the Caliber fixture, relevance rejection occurs before the service's chain check, so its chain tag is never the recorded rejection reason.

This is a code audit, not a source-coverage or contact study. It does not measure current ownership, handset ownership, line type, reachability, DNC/TCPA, or delivery. `verifiedPhones` is zero.

## Workflow

1. Discover a published auto-body business through the live recipe-A route.
2. Require an auto-body or collision-repair signal. Auto glass, mechanical repair, detailing, dealer, parts, towing, and generic automotive signals alone go to hold.
3. Hold chain, franchise, and multi-location matches before forming an owner hypothesis.
4. Require a separately published business number. Do not infer a personal number from the listing or a public identity record.
5. Apply mobile line-type, reachability, DNC/TCPA, suppression, duplicate, and freshness gates to the business-contact candidate.
6. Deliver an owner-confirmed contact only with separate current ownership and handset evidence. A person, a business number, and a passing mobile check each remain insufficient on their own.

## Failure cases and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| Collision-only shops are rejected because `classifyRelevance` has no `auto_body` profile, while the brain allow regex accepts unrelated automotive results. | Add an `auto body` profile with core terms `auto body`, `body shop`, `collision repair`, `collision center`, and `collision service`; make glass, mechanical repair, detailing, dealer, parts, towing, and generic automotive adjacent. Tighten the brain allow expression after adding the five regression cases. | Shared correction proposed |
| A branded collision outlet is treated as locally owner-operated. | Keep the automotive chain filter before owner classification and require separate local ownership evidence. | Implemented |
| A shop number or role-labeled person becomes an owner-confirmed mobile. | Preserve both as candidates only; require independent current ownership and handset evidence after all contact/compliance gates. | Implemented |
| NJ MVC licensing is represented as an available owner source. | Keep it blocked until a documented, authorized public endpoint establishes access, permitted use, fields, and semantics. | Blocked |

## Sources

| Source | Evidence | Exact reference | Use |
| --- | --- | --- | --- |
| Live auto-body brain route | VERIFIED | `src/data/lead-engine-brain.json` `industries.auto_body`; `src/lib/lead-engine-brain.ts` | Maps-first discovery context |
| Runtime discovery and relevance gates | VERIFIED | `src/lib/lead-engine-scrape.ts` `parseDiscoveryCandidate`; `src/services/lead-engine-jobs.service.ts` `ingestRows`; `src/lib/lead-engine-industries.ts` `classifyRelevance` | Identified classifier/allow mismatch |
| Automotive chain table | VERIFIED | `src/data/lead-engine-brands.json` `groups.auto`; `src/lib/lead-engine-brands.ts` `isChain` | Collision and repair chain check |
| NJ MVC auto-body facility licensing | REPORTED | `handoff/04_SOURCE_CATALOG.md` Group G; `handoff/07_RESEARCH_BUILD_SPEC.md` Automotive coverage | Blocked potential identity source only |
| Delivery contact gates | VERIFIED | `src/lib/lead-engine-quality.ts` `evaluateVerifiedBusiness`; `src/lib/lead-engine-gates.ts` `evaluateJobGates` | Business-contact compliance gates |

## Cost and remaining measurement

The fixture audit had zero input cost. No clean delivered owner contact was observed, so cost per clean contact remains null. The brain's historical Anas rates use another denominator.

After the runtime correction, keep the five fixtures as regression coverage. Core body/collision cases should proceed; glass and mechanical repair should be adjacent or rejected; Caliber Collision should reach the chain filter after relevance. A later authorized outcome study must measure trade fit, current owner confirmation, line type, DNC/TCPA, reachability, and delivery separately.

## Runtime defect for shared-owner review

`classifyRelevance` in [lead-engine-industries.ts](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-industries.ts) lacks an `auto body` profile. In the live job flow, [lead-engine-scrape.ts](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-scrape.ts) rejects `Independent Collision Center` as `no_positive_relevance`, and [lead-engine-jobs.service.ts](/Users/francocappanera/NBC%20Sales/Caller/src/services/lead-engine-jobs.service.ts) separately applies the brain's broad `body|collision|auto` regex. This creates both a false negative for collision-only shops and an overly permissive allow gate for adjacent automotive results.

Add a profile keyed `auto body` with aliases `auto body`, `body shop`, and `collision`; core terms `auto body`, `body shop`, `collision repair`, `collision center`, and `collision service`; and adjacent terms for auto glass, auto repair, detailing, dealer, parts, towing, and generic automotive. Then replace `industries.auto_body.allow` with a body/collision-specific expression and add the five runtime cases to `tests/lead-engine-industry-corrections.test.ts`. This preserves all historical brain benchmark fields and makes the chain filter reachable for collision results.

## Root integration regression check, 2026-09-24

A dedicated collision/body-shop profile admits collision-center synonyms and rejects auto-repair/glass/parts-only rows before verification. Historical brain figures and allow field were not changed.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
