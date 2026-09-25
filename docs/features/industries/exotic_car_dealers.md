# Exotic-car-dealer industry workflow review

Reviewed 2026-09-24. The live brain sends `exotic_car_dealers` to recipe A, starting with a Maps search for `exotic car dealer`. The advertised number is a published dealership contact, not evidence that a particular person owns the dealership or handset.

## Hypothesis

The Maps route can begin a business-contact workflow for a dealer with specific exotic, luxury, or classic-car-dealer evidence. Ordinary used-car dealers, OEM stores, rental businesses, repair shops, parts sellers, and generic automotive listings are outside this cohort unless a separately reviewed workflow covers them. A dealer licensee, filing officer, business address, listing number, or mobile classification alone cannot confirm an owner or their handset.

## Bounded code audit

No eligible public business-contact endpoint was both verified and already implemented for this narrow dealer cohort. The NY DMV dataset was expressly not fetched. Instead, this review used five synthetic strings against the exact regular expression created by `ingestRows` from `industries.exotic_car_dealers.allow`; it also called the live `route` function. No network, paid provider, secret, contact-data, or DMV call occurred.

| Synthetic candidate | Exact current allowlist result | Review result |
| --- | --- | --- |
| Prestige Exotic Motors — Exotic Car Dealer | matched | Intended inclusion |
| Luxury Auto Gallery — Luxury Car Dealer | matched | Intended inclusion |
| Heritage Classics — Classic Car Dealer | matched | Intended inclusion |
| Value Lane — Used Car Dealer | matched | Failure: generic dealer admitted |
| Metro Ford — Car Dealer | matched | Failure: OEM dealer admitted |

`route('luxury car dealer', 'NY')` selected `exotic_car_dealers`, recipe A. The last two strings matched because the live pattern is `exotic|luxury|classic|car dealer`; the `car dealer` alternative alone admits them. This is a five-case code audit only. It measures no listing coverage, mobile status, reachability, DNC/TCPA result, owner confirmation, handset relationship, or delivery. `verifiedPhones` is zero.

## Workflow

1. Discover a published dealer listing through the implemented recipe-A route.
2. Require specific exotic, luxury, or classic-car-dealer evidence. Hold ordinary used and OEM dealers, rental, repair, parts, detailing, and generic automotive results.
3. Hold OEM, franchise, dealer-group, and multi-location businesses from the owner-candidate branch.
4. Treat a published dealership line only as a business contact. Do not derive a personal number from a dealer/license record, filing role, listing, or business address.
5. Apply the existing mobile-line, reachability, DNC/TCPA, suppression, duplicate, and freshness gates. These do not establish ownership.
6. Hold as a business contact until independent ownership and handset evidence is recorded. Only a future reviewed workflow may apply an owner-confirmed label.

## Failure cases and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| A used or OEM dealership enters the exotic cohort. | Replace `exotic|luxury|classic|car dealer` with specific exotic/luxury/classic dealer phrases and add the five fixtures as a regression test. | Shared-runtime correction needed |
| A dealership switchboard or mobile number is called a direct owner cell. | Preserve it as a published business contact until every contact/compliance gate and separate owner/handset evidence pass. | Implemented gates; owner evidence still proposed |
| A dealer licensee or filing officer is represented as current owner, or an address is used for personal-phone discovery. | Treat roles as candidate evidence only; prohibit personal-phone/address enrichment. | Proposed |
| A luxury franchise, OEM business, or dealer group is treated as one-owner independent. | Hold brand, franchise, group, and multi-location signals pending separately reviewed ownership evidence. | Proposed |
| The NY repair adapter is assumed to cover DMV dealer records. | Do not map dealers to `ny_repair_shops`: it explicitly retains only `RS` and `RSB`, while catalog dealer rows are `DLU`. | Implemented parser boundary |

## Evidence

The route and current filter are VERIFIED implementation evidence in [lead-engine-brain.json](/Users/francocappanera/NBC%20Sales/Caller/src/data/lead-engine-brain.json:390), [lead-engine-brain.ts](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-brain.ts:178), and [lead-engine-jobs.service.ts](/Users/francocappanera/NBC%20Sales/Caller/src/services/lead-engine-jobs.service.ts:715). The catalog's Group G automotive section verifies the existence and documented fields of NY DMV dealer (`DLU`) and WA DOL dealer sources, but neither is an implemented exotic-dealer owner workflow. The current NY parser's repair-only boundary is verified in [lead-engine-registers.ts](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-registers.ts:1099).

The review began with the hypothesis that the live allowlist was narrow enough to isolate the cohort. The five-case audit falsified it: both generic used and OEM dealer strings pass. The correction is to remove the generic `car dealer` alternative, keeping the live route as a published-business-contact route. A dealer-specific register adapter remains proposed; it must not be inferred from the repair-shop parser.

## Remaining measurement

After the allowlist correction, run these five synthetic cases through `ingestRows` and confirm that exotic, luxury, and classic dealer cases proceed while used and OEM dealer cases are filtered. A later authorized outcome pilot must keep separate denominators for published business contacts, mobile lines, DNC/TCPA-cleared contacts, reachable contacts, reached owners, independently supported owner/handset evidence, and delivered contacts. No per-clean cost is established.

## Runtime correction for root review

In [lead-engine-brain.json](/Users/francocappanera/NBC%20Sales/Caller/src/data/lead-engine-brain.json:398), change the `exotic_car_dealers.allow` value from `exotic|luxury|classic|car dealer` to specific dealer phrases that do not contain a bare `car dealer` alternative. Add a focused `ingestRows` regression with the five audit values, requiring the first three to survive and the used/OEM cases to receive `outside_allowlist`. This is a safe narrowing correction: [ingestRows](/Users/francocappanera/NBC%20Sales/Caller/src/services/lead-engine-jobs.service.ts:717) already applies the regex before writing a scraped row. Do not map this industry to `ny_repair_shops`, because [nyRepairShopRow](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-registers.ts:1101) excludes `DLU` dealer rows.

## Root integration regression check, 2026-09-24

A dedicated profile requires exotic/luxury/classic automotive context. Generic used/OEM dealers and luxury-spa counterexamples fail before verification even though the historical broad brain allow field remains unchanged.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
