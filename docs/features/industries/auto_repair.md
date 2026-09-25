# Auto repair industry workflow review

Reviewed 2026-09-24. The live brain keeps `auto_repair` in recipe A with historical Anas `expected_clean` 0.19 and `n` 42. Those historical figures are neither reproduced nor treated as a phone or owner-confirmation measurement here.

## Hypothesis

An independent repair-business result can enter a business-contact workflow after repair-service and chain checks. In New York, a current DMV RS or RSB record can add license and named-licensee-candidate evidence. It has no phone field. A licensee name, a Maps business phone, or their proximity at the same shop cannot establish current ownership or an owner-confirmed mobile.

## Bounded free observation

I queried the catalog's VERIFIED public NY DMV endpoint, `nhjr-rpi2`, once for five 2027-expiring RS/RSB records. Only aggregate field presence was retained; no names, addresses, or phone values were recorded.

| Measure | Result |
| --- | ---: |
| Rows returned | 5/5 |
| `owner_name` present | 5/5 |
| `facility_name` present | 5/5 |
| RS / RSB | 4 / 1 |
| Person-like `owner_name` under entity-token screen | 5/5 |
| Rows with a phone/telephone-named response field | 0/5 |

The result confirms only small-sample source-field coverage. It does not measure current ownership, handset ownership, mobile line type, live status, DNC status, reachability, or delivery. `verifiedPhones` is zero.

## Workflow

1. Discover an auto-repair candidate through the live recipe-A Maps-first route.
2. Require repair-service evidence. Tire, lube, collision, detailing, inspection, dealer, parts, or generic automotive evidence alone enters review or rejection.
3. Remove known automotive chains through the existing brand exclusion.
4. For a New York candidate, optionally corroborate identity with a current RS/RSB DMV row. Retain its person-like `owner_name` only as a named licensee candidate; entity values, expired rows, and other classes do not pass this branch.
5. Treat a separately published business number as a business-contact candidate. The DMV row supplies no number. Apply the existing line-type, live, DNC, and global delivery-dedupe gates.
6. Deliver only after independent ownership evidence and the contact/compliance gates pass. An owner-confirmed mobile needs separate evidence.

## Failure cases and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| A normal `auto repair` request in NY routes to generic recipe A and never reaches the separate NY DMV route. | Make state-aware routing select `auto_repair_ny` for NY auto-repair requests, or merge the NY source selection into `auto_repair` without revising historical rates. | Shared correction proposed |
| DMV `owner_name` is called an owner or linked automatically to a business phone. | Classify it as a named licensee candidate and require independent current ownership and handset evidence. | Adapter safeguards implemented |
| Adjacent automotive businesses and chains contaminate repair candidates. | Require repair-core evidence and use the auto brand exclusion. | Implemented |
| The no-phone register triggers a contact or append claim. | Keep it identity-only and hold when no separately published permitted business contact is available. | Implemented |

## Completed review iteration

The NY register was already implemented and its documented lack of a phone field was confirmed by the five-row aggregate check. The meaningful defect is route selection: `matchIndustry('auto repair', 'NY')` resolves the exact generic `auto_repair` key, while `auto_repair_ny` offers only aliases containing the words “new york.” Thus ordinary NY requests bypass the existing `ny_repair_shops` adapter. Correct `matchIndustry` or the brain's state-specific routing metadata, and add a synthetic routing case for `auto repair` / `NY`.

## Sources

| Source | Evidence | Exact reference | Use |
| --- | --- | --- | --- |
| Live auto-repair brain | VERIFIED | `src/data/lead-engine-brain.json` `industries.auto_repair`; `src/lib/lead-engine-brain.ts` | Maps-first route and historical benchmark context |
| Auto repair relevance profile | VERIFIED | `src/lib/lead-engine-industries.ts` `PROFILES` auto repair entry | Core/adjacent trade gate |
| NY DMV Facilities Licensed by the DMV | VERIFIED | `handoff/04_SOURCE_CATALOG.md` Group G; `handoff/07_RESEARCH_BUILD_SPEC.md` G1-G4; `src/lib/lead-engine-registers.ts` `nyRepairShopRow`, `nyRepairShops` | Current RS/RSB license identity and named-licensee candidate, no phone |
| Automotive chain table | VERIFIED | `src/data/lead-engine-brands.json` `groups.auto`; `src/lib/lead-engine-buckets.ts` `isChain` | Independent-business filter |

## Cost and remaining measurement

The bounded endpoint check had zero input cost. No clean delivered owner contact was observed, so cost per clean contact remains null. The live brain's historical rate has another denominator and does not measure this source path.

After the routing fix, verify with synthetic cases that `auto repair` plus `NY` selects the NY register route and `auto repair` in another state remains Maps-first. A later authorized outcome study must separately measure trade fit, current owner confirmation, line type, DNC, reachability, and delivery.

## Runtime defect for shared-owner review

In [lead-engine-brain.ts](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-brain.ts), `matchIndustry` gives the exact `auto_repair` key priority for `auto repair`. The separate `auto_repair_ny` entry in [lead-engine-brain.json](/Users/francocappanera/NBC%20Sales/Caller/src/data/lead-engine-brain.json) only has aliases such as `new york auto repair`, so its implemented `ny_repair_shops` register source is not selected for the normal industry/state pair (`auto repair`, `NY`).

Correct the state-aware selection so the NY-specific route wins for that pair, preserving `auto_repair`'s historical benchmark fields. Add a regression case for `route('auto repair', 'NY')` that expects `auto_repair_ny`, recipe B, and the NY DMV source; retain recipe A for non-NY requests.
