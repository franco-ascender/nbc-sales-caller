# Fencing industry workflow review

Reviewed 2026-09-24. The live brain routes `fencing` to recipe A with the Maps keyword `fence contractor`. That starts with a published business number; it is not an owner-cell workflow. Fencing has a distinct licensed-trade path in Washington and California, but that path is not mapped or specialty-filterable in the runtime today.

## Hypothesis

An active, explicit fencing-specialty contractor record can establish trade fit and a principal or personnel-role candidate. In Washington, that means an active L&I row whose first specialty contains `FENC`; in California, it means CSLB `C-13`. A register principal, qualifier, RMO, RME, officer, or a published business line does not independently prove that the person owns the business or handset. An owner-confirmed mobile requires separate owner evidence and the mobile, live, DNC, suppression, and global delivery-dedupe gates.

Fencing needs its own exclusions. Residential fence installation and repair are different from fence-material retail, temporary construction fencing, commercial perimeter/security integration, gates-only, railings, decks, landscaping-only work, and large multi-location operators.

## Free bounded observation

I queried the catalog's VERIFIED WA L&I Socrata endpoint, `m8qx-ubtq`, on 2026-09-24 for 20 active rows where `specialtycode1desc` contained `FENC`. The command reduced the response immediately to aggregate field coverage; no names, phone values, addresses, license numbers, or business names were retained.

| Measure | Result |
| --- | ---: |
| Rows sampled | 20 |
| Active | 20/20 |
| Fencing specialty present | 20/20 |
| `primaryprincipalname` present | 20/20 |
| `phonenumber` present | 20/20 |
| `businesstypecodedesc = Individual` | 6/20 |

This is only a field-coverage observation. It does not establish a principal's ownership role, ownership of a handset, mobile line type, reachability, DNC status, or delivered-contact yield. `verifiedPhones` is zero.

## Workflow

1. Apply the state legal gate. Intake only a legally eligible, explicit fencing-specialty register; do not manufacture statewide routes in Texas or North Carolina, where the research catalog says fencing is unlicensed statewide.
2. For a register route, require active WA `FENC` or CA `C-13` classification. A generic construction license is insufficient. Where the register route is unavailable and Maps fallback is permitted, begin with the current fence-contractor listing path.
3. Keep only residential/commercial fence installation or repair candidates that meet the product's independent-operator criteria. Hold material retail, temporary fencing, security/perimeter integration, gates-only, railings, decks, landscaping-only, franchise, stale, and multi-location matches.
4. Preserve `Individual`, `Sole Owner`, partner, and member distinctions as stronger candidate evidence. Treat principal, qualifier, RMO, RME, officer, and corporate roles as unsupported owner evidence until independently corroborated.
5. Contrast published register and Maps numbers where both are available. A missing, shared, duplicate, or office-only number stays held; no private mobile is inferred.
6. Apply the existing mobile line-type, live, DNC, global suppression/dedupe, and owner-evidence gates. Deliver only the classification those checks support.

## Fencing-specific failures and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| Maps-first discovery uses an advertised business number before trade-scoped identity. | Use eligible FENC/C-13 records as identity and candidate-role evidence; retain Maps as contrast or permitted fallback. | Proposed |
| The WA adapter saves entity type in `business_type`, while CSLB master saves `BusType` and personnel saves no classification. The names step applies a `register_source` suffix filter only to `business_type`. | Persist normalized specialty/classification in a filterable field, or filter within each adapter before adding fencing mappings. | Runtime correction needed |
| Fence-material suppliers, temporary fence rentals, security/perimeter work, gate/railing specialists, decks, and landscaping can pass broad fencing terms. | Require installation/repair evidence; hold those segments until separately scoped. | Existing generic relevance; fencing subvertical filter proposed |
| A primary principal, CSLB personnel role, or public business phone becomes an owner cell. | Preserve role and phone provenance; require independent owner evidence plus normal contact/compliance gates. | Partial existing gates; specialty route unimplemented |
| Texas or North Carolina is assumed to have a statewide fencing license. | Keep both out of a statewide fencing-register workflow; use only a separately reviewed permitted local source or business-listing fallback. | Proposed |

## Sources

| Source | Evidence and use | Status |
| --- | --- | --- |
| WA L&I Contractor License Data General, `m8qx-ubtq` | VERIFIED catalog source. The bounded active FENC sample supplies principal and published-phone field coverage. The catalog also records the PDDL source and RCW commercial-list constraint, so the state legal gate remains required. | Adapter implemented; fencing routing/class filter absent |
| CA CSLB License Master plus Personnel | VERIFIED catalog source. `C-13` is fencing; Master includes classifications and business phone, while Personnel includes names and role titles. Portal terms remained UNKNOWN after documented 503 responses. | Adapter implemented; C-13 field is not usable by job filtering |
| Live fencing route and relevance profile | `src/data/lead-engine-brain.json`, `src/lib/lead-engine-brain.ts`, and `src/lib/lead-engine-industries.ts`. | Implemented Maps route; no fencing-specific register workflow |
| Texas and North Carolina state coverage | `handoff/07_RESEARCH_BUILD_SPEC.md`, TX and NC state rows each say fencing is unlicensed statewide. | Verified negative constraint |

## Iteration and remaining measurement

The live route assumed a generic Maps query was the starting point for fencing. The bounded WA observation confirms an active explicit-specialty source has principal and phone fields, including six individual entities in twenty rows. It does not establish owner identity or direct-mobile ownership. The implementable correction is therefore a specialty-scoped identity branch, explicit fence-segment exclusions, and role/contact holds.

The next free test should use synthetic WA FENC/non-FENC rows and CA C-13/non-C-13 master/personnel rows. A fencing job must select only the explicit fencing class, keep principal/personnel records as candidate-role evidence, hold material/temporary/perimeter/adjacent listings, and never emit an owner-confirmed contact without independent evidence. A later authorized outcome study must measure mobile, live, DNC-cleared, reached-owner, and delivered denominators separately. No per-clean cost is established.

## Runtime defect for shared-owner review

`src/services/lead-engine-jobs.service.ts`, `pullNames`, parses a suffix such as `cslb:c-13` or `wa_lni:fenc` and applies it only as `ilike('business_type', ...)`. But `src/lib/lead-engine-registers.ts` function `waLni` stores `businesstypecodedesc` (entity type) in `business_type`, `cslbMasterRow` stores only `BusType`, and `cslbPersonnelRow` stores no classification. Their raw source rows contain WA specialty and CSLB `Classifications`, yet the normalized rows discard them. Thus a fencing mapping cannot select only FENC/C-13 records: a filter would return no appropriate rows (and personnel C-13 rows cannot be filtered at all).

Root correction: add a normalized, filterable trade/class field to the register-name schema and adapters, then make `pullNames` filter that field (or implement source-specific class filters). Only after synthetic fixtures cover FENC/C-13 and non-fencing rows should root add state-specific fencing mappings; keep recipe A as an explicit permitted fallback.
