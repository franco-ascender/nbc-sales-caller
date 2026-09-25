# Car-detailing industry workflow review

Reviewed 2026-09-24. The live brain routes `car_detailing` to recipe A, beginning with a published Maps number for the keyword `car detailing`. That is a business-contact workflow. A mobile-service claim, public number, or matched Secretary of State (SOS) agent/officer does not show that a person owns the business, owns the handset, or may be contacted on a personal number.

## Hypothesis

An independent business with core detailing evidence can enter published-business-contact processing. Detail, ceramic coating, paint correction, and mobile detailing are core signals. A car wash, tint/wrap/PPF business, auto-repair shop, dealer, or generic automotive listing alone is not sufficient. If a future SOS branch matches the business, its agent or officer is an identity/owner candidate only; filing addresses must never be used to discover a private number.

## Bounded fixture/code audit

No catalog endpoint was suitable for a live free business-contact sample within this review without collecting public contact rows, so the bounded review used five synthetic inputs against the implemented `classifyRelevance` and `franchiseBrand` functions. It made no network, paid, secret, or contact-data calls.

| Fixture input | Relevance result | Franchise tag | Expected interpretation |
| --- | --- | --- | --- |
| Precision Auto Detailing | core | none | Core detailing candidate |
| Mobile Ceramic Coating | core | none | Core detailing candidate |
| Neighborhood Car Wash | core | none | Defect: car-wash-only should be held as adjacent/ambiguous |
| Tint World North | adjacent | none | Adjacent; audited brand was not tagged |
| Downtown Auto Repair | adjacent | none | Adjacent-only; hold |

The test is a five-case code audit, not a live measurement. It measures no listing coverage, mobile status, reachable rate, DNC/TCPA result, owner confirmation, handset ownership, or delivery. `verifiedPhones` is zero.

## Workflow

1. Discover a published Maps business listing through the existing recipe-A route.
2. Require core detailing evidence. Hold car wash, tint, wrap, PPF, repair, dealer, and generic automotive results unless separate core detailing evidence is present.
3. Segment brands and multi-location operators before any owner hypothesis.
4. Treat the advertised number as a business contact. Do not infer a person number from a mobile-service claim, an SOS candidate, a filing address, or another listing.
5. Apply mobile-line, reachability, DNC/TCPA, suppression, dedupe, and freshness gates. They do not prove owner or handset identity.
6. Hold as a business contact unless independent evidence records both ownership of the business and the relationship to the handset. Only then can a future workflow use an owner-confirmed classification.

## Failure cases and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| Car washes enter the car-detailing route as core. | Move `car wash` from the `detailing` profile's `core` terms to `adjacent` or remove it, then add a regression fixture. | Blocked shared-runtime correction |
| Tint, wrap, PPF, repair, dealer, or generic automotive listings are called detailing. | Require a core detailing signal; hold adjacent-only listings. | Partial |
| A mobile-detailing listing phone is called a direct owner cell. | Keep it a published business contact until line/live/DNC/TCPA/suppression/dedupe gates and separate owner/handset evidence pass. | Partial |
| An SOS agent/officer is called an owner or their filing address is used for phone enrichment. | Keep the role as matched identity-candidate evidence only and prohibit personal-phone/address enrichment. | Proposed |
| A franchise or multi-location outlet is described as owner-operated. | Hold brand and multi-location matches for a separately reviewed route. | Partial |

## Evidence and iteration

The live brain evidence is VERIFIED: `src/data/lead-engine-brain.json` maps `car_detailing` to recipe A with the Maps keyword and an allow pattern; `src/lib/lead-engine-brain.ts` supplies that route. The current `detailing` profile is also VERIFIED implementation evidence in `src/lib/lead-engine-industries.ts`.

The source catalog's Group G row is VERIFIED for the narrow claim that detailing has no license source and suggests an SOS-plus-Maps path. It supports a role-labeled agent/officer candidate and a Maps business number, not owner or handset confirmation. The build spec reports that mobile detailers can be approached Maps-first and reports an expected mobile share by analogy. That premise is REPORTED and remains unmeasured here; it cannot turn a published line into a direct owner cell.

The review began by testing whether the relevance profile separated the trade from adjacent automotive businesses. Its five synthetic cases found one material defect: `Neighborhood Car Wash` is classified `core`, because `car wash` appears in the `detailing` profile's core list. The implementable correction is to move that term to `adjacent` (or remove it) and lock the behavior with a small regression test. The same audit observed that `Tint World North` has no franchise tag; that is a secondary segmentation gap to review alongside the automotive brand source, rather than proof of franchise status in any real listing.

## Remaining measurement

After correcting the core terms, add synthetic discovery fixtures for core detailing, ceramic coating, car-wash-only, tint/wrap-only, and auto-repair-only rows. The route should pass only core detailing and should never produce an owner-confirmed label from a Maps number, business name, SOS role, or address. A later authorized outcome pilot must measure published-contact line type, DNC/TCPA, reachability, reached owner, independent owner evidence, handset evidence, and delivery with separate denominators. No per-clean cost is established; `perCleanUsd` remains null.

## Runtime defect for shared-owner review

`classifyRelevance` in `src/lib/lead-engine-industries.ts` resolves `car_detailing` to the `detailing` profile, whose `core` terms include `car wash`. Any candidate text containing `car wash` consequently passes as `core`; the fixture audit reproduced this with `Neighborhood Car Wash`. Move `car wash` to `adjacent` or remove it from that profile and add a focused regression test. This preserves the intended ability to hold adjacent automotive businesses until independent detailing evidence exists.

## Root integration regression check, 2026-09-24

Car-wash-only listings no longer qualify as core detailing. The parser requires a core match for this narrow cohort; detailing, ceramic coating and paint correction remain eligible.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
