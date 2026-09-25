# Roofing industry workflow review

Reviewed 2026-09-24. The live brain routes `roofing` to recipe A, whose starting point is a published Maps business number. That remains a business-contact path, not an owner-cell workflow. Roofing is a licensed-trade case where the register can instead supply a named principal or qualifying-person candidate, subject to the state legal gate and the contact/owner evidence gates.

## Hypothesis

For active roofing contractors, a state register plus a roofing-class filter can establish trade and candidate identity. A register phone is a business or candidate contact until it is exclusive, contrasted with the public listing, and passes mobile, live, DNC, dedupe, and independent owner-evidence gates. `Sole Owner` is stronger than a qualifier; a WA `primaryprincipalname`, RMI, RMO, or Florida qualifier is still not proof that the person owns the company or handset.

## Free bounded observation

I queried the catalog's VERIFIED WA L&I Socrata endpoint, `m8qx-ubtq`, on 2026-09-24. A 20-row, active-only sample where `specialtycode1desc` contained `ROOF` was reduced immediately to aggregate field coverage; no names, phones, addresses, license numbers, or business names were retained.

| Measure | Result |
| --- | ---: |
| Rows sampled | 20 |
| Active | 20/20 |
| Roofing specialty present | 20/20 |
| `primaryprincipalname` present | 20/20 |
| `phonenumber` present | 20/20 |
| `businesstypecodedesc = Individual` | 1/20 |

The endpoint also reported 1,208 rows with a first specialty containing `ROOF`; 536 were active. These are field-coverage observations only. They do not measure phone ownership, mobile line type, reachability, DNC status, owner confirmation, or clean delivery. `verifiedPhones` is therefore zero.

## Workflow

1. Apply a state legal gate before register intake. Do not use prohibited list sources; use Maps only when the state allows the fallback.
2. Ingest an active, trade-scoped roofing register row. WA requires a specialty-code filter; CA requires `C-39`; FL requires the roofing class (for example CCC/CRC as explicitly configured); IL qualifying-party rows are identity-only.
3. Treat ownership titles differently: accept `Sole Owner`, partner, member, or an individual registrant as stronger candidates; hold RME and large-company qualifier/RMO cases for independent owner evidence.
4. Join or contrast an active Maps roofing listing. Reject unrelated general-contractor, gutter-only, siding-only, and franchise/default-brand matches.
5. If the register phone is absent, shared, or non-mobile, hold for an authorized future append rather than infer a direct number. If it differs from Maps and is exclusive, retain it only as an owner-phone candidate.
6. Apply the existing line-type, live, DNC, suppression/dedupe, and owner-evidence gates. Deliver only the classification those gates support.

## Roofing-specific failures and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| Maps-first roofing gives the advertised office line. The historical Miami result was 2 mobile numbers in 10 published numbers, not an owner-contact result. | Start legally eligible states with a trade-scoped register, then use Maps as contrast and activity evidence. | Proposed |
| The WA adapter ingests every active contractor and records `business_type` as only `Individual`/LLC/Corp. | Persist a normalized specialty/class field usable by the job's source filter, or filter the adapter request to roofing before persistence. | Runtime correction needed |
| `roofing` always routes to recipe A and has no register-source mapping. | Add state-specific roofing recipe-D mappings only for legally eligible adapters and a tested trade filter; keep A as an explicit fallback. | Runtime correction needed |
| A qualifier is represented as owner. This is acute in FL and for CSLB RME/RMO rows. | Preserve the role, reject RME for owner delivery, and require independent owner evidence for qualifier/RMO cases. | Proposed |
| Roofing overlaps gutters, siding, restoration, and general contracting. | Require roofing class/specialty or core roofing relevance; send adjacent-only results to hold/reject. | Existing relevance classifier; register filter missing |
| Large storm-restoration operators and franchises are treated as owner-operated roofers. | Exclude or segment reused phones, brand matches, high reviews/personnel/permit volume, and multi-location matches before owner delivery. | Partial |

## Sources

| Source | Evidence and use | Status |
| --- | --- | --- |
| WA L&I Contractor License Data General, `m8qx-ubtq` | VERIFIED catalog source. Active roofing-specialty sample has principal and phone field coverage; WA's PDDL publication has an RCW commercial-list ambiguity requiring the state legal gate. | Adapter implemented; roofing routing/filter not implemented |
| CA CSLB Master + Personnel | VERIFIED data; portal terms remain UNKNOWN after documented 503. C-39 plus current/CLEAR status and `Sole Owner` personnel form the strongest available roofing candidate path. | Adapter implemented; roofing mapping/filter not implemented |
| FL DBPR contractor extracts | VERIFIED catalog source for person-level qualifier identity; current adapter documents no phone column, so this is identity-only until a separate permitted contact source exists. Roofing class filter is absent. | Adapter implemented; roofing filter proposed |
| IL IDFPR roofing contractor / qualifying party, `pzzh-kp68` | VERIFIED identity-only source: 4,939 active business contractors and 12,131 active qualifying-party entries in the research catalog; no phone. | No adapter/mapping |
| Current roofing route and relevance profile | `src/data/lead-engine-brain.json`, `src/lib/lead-engine-brain.ts`, and `src/lib/lead-engine-industries.ts`. | Implemented Maps route; insufficient for licensed-owner workflow |

## Iteration and remaining measurement

The initial assumption from the live brain was that roofing could begin with Maps. The bounded WA observation instead confirms a free active roofing register has a principal and a published phone field, while only 1 of 20 rows was an `Individual` business. The correction is not to call every register phone an owner cell: use state/trade filtering, role classification, and phone contrast before the normal contact gates.

The next free implementation test should seed synthetic WA rows for a roofing specialty, a non-roof specialty, an individual principal, and an LLC principal. A roofing job must select only the roofing row, preserve the principal as a candidate role, and never label its phone owner-confirmed without independent evidence. A later authorized outcome sample must separately measure mobile, connected, DNC-cleared, reached-owner, and delivered denominators. No per-clean cost is established here.

## Runtime defect for shared-owner review

`src/lib/lead-engine-brain.ts` function `route` returns recipe A for the live `roofing` entry in every state because `src/data/lead-engine-brain.json` has neither a non-A recipe nor `register_source` mapping for roofing. The available `wa_lni`, `cslb`, and `fl_dbpr_construction` adapters therefore cannot serve a roofing job. Further, `waLni` in `src/lib/lead-engine-registers.ts` stores `business_type` as only the entity type, while `pullNames` in `src/services/lead-engine-jobs.service.ts` applies any source filter to `business_type`; a prospective `wa_lni:roof` mapping would select zero rows. Persist an explicit trade/class field for filtering (or make the adapter specialty-scoped), then add legal, state-specific roofing mappings with regression fixtures before changing the live route.
