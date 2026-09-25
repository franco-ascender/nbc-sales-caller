# Childcare centers and education studios workflow review

Reviewed 2026-09-24. This review covers the live `childcare_center` brain entry: child-care centers, preschools, tutoring, dance, music, and swim schools. It did not query a provider, use a private or residential source, load credentials, or retain names, addresses, or phone values.

## Hypothesis

The current production path can discover an independent center or studio through the recipe-A fallback and exclude known education/childcare franchises. A published listing number is only a business-contact candidate. A center license's director or administrator is a role at the center, while a company is the licensed/legal entity and an owner requires separately matched, explicit ownership evidence. No current center route establishes an owner or an owner-confirmed mobile.

## Five-case fixture and code audit

On 2026-09-24, a five-case local route audit ran `child care center`/PA, `preschool`/NY, `dance studio`/TX, `music school`/PA, and `tutoring`/NY through `route`, `registerSourceFor`, and `quoteJob`, using `node --experimental-strip-types`. All five resolve to `childcare_center`; none has a `register_source`; each quote safely falls back from configured recipe B to Maps recipe A with `No register for childcare center` recorded. This is code-routing evidence only, not a live-source, phone, ownership, or delivery measurement.

A companion adapter-request audit inspected the PA, NY, and TX childcare adapters without fetching data. It found three adapters and seven configured request segments. Every segment is home-only (`Family/Group Child Care Home`, `GFDC/FDC`, or the three TX home types); no request includes PA center, NY DCC/SACC, or TX Licensed Center. The focused existing childcare fixture test also passed. The TX administrator fallback is already held as `owner_identity_unresolved`; it is not reported as an open defect here.

## Workflow and failure cases

1. Start with a Maps-discovered center or education-studio business under the existing recipe-A fallback.
2. Require center/studio relevance and remove a known education/childcare franchise before phone verification.
3. Keep the listing number as a business-contact candidate, and apply the existing line-type, live, DNC, suppression, time-zone, and duplicate gates.
4. Keep any director/administrator solely as a role candidate. Hold the record unless an independent public ownership source explicitly identifies the same person as an owner of the matched company.
5. Associate the approved business contact with that separately confirmed business; it remains distinct from an owner-owned handset. Delivery requires every gate.

| Failure case | Correction | Status |
| --- | --- | --- |
| The brain advertises PA/NY/TX center datasets through `name_source`, but no center `register_source` or center adapter segment exists. | Preserve the Maps fallback and label all center-register/SOS-owner paths as unavailable until a dedicated, eligible center adapter is implemented. | Implemented fallback; center path blocked |
| A director, administrator, provider, company, and owner collapse into one identity. | Persist role provenance and require matched, explicit ownership evidence before an owner label. | Proposed |
| Home-directory rows contaminate a commercial-center cohort or introduce residential data. | Do not reuse the PA/NY/TX home adapters for centers; their segments are home-only and their records can contain residential location data. | Implemented segment boundary |
| A franchise is counted as an independent local center or studio. | Run the existing `education_childcare` franchise exclusion before any paid verification. | Implemented |
| A public business phone is called a direct owner mobile. | Keep the business-contact, handset, line-type, and ownership evidence as separate gates. | Implemented |

## Safe shared correction

`childcare_center` is configured as recipe B while `registerSourceFor('childcare_center', state)` is null for PA, NY, and TX. `quoteJob` safely switches it to recipe A, but `route`/the admin brain continue to show recipe B and the directory strings as if they were a configured center source. Root should either set the live entry to recipe A until an actual center source is mapped, or implement dedicated center-only adapters and `register_source` mappings. The latter must use explicit center segments only (PA `Child Care Center`, NY `DCC`/`SACC`, TX `Licensed Center`), preserve company and director roles, exclude home/residential fields, and hold all records until independent owner evidence exists. It must not reuse a home adapter or administrator fallback.

## Sources and remaining measurement

- `handoff/04_SOURCE_CATALOG.md`, Group H, documents public PA/NY/TX center directories and states that center directors may be staff; the catalog labels centers recipe B via a later ownership source.
- `handoff/07_RESEARCH_BUILD_SPEC.md`, §5.8, separates home rows from centers and says center ownership needs SOS officer/review work. Those later steps are not connected in the current runtime.
- `src/data/lead-engine-brain.json`, `src/lib/lead-engine-brain.ts`, and `src/lib/lead-engine-jobs.ts` show the configured recipe-B description and safe recipe-A fallback.
- `src/lib/lead-engine-registers.ts` limits all three implemented childcare adapters to home-only segments; `src/lib/lead-engine-brands.ts` applies the `education_childcare` franchise group.

The next bounded experiment is a free, aggregate-only 5-20 row inspection of an eligible dedicated center segment after it is implemented. It must separately count eligible center rows, company-form records, director/admin roles, explicit independently supported owner matches, published business-contact fields, contact-gate passes, and deliveries. It must exclude home rows and residential fields. Cost per clean owner contact remains unknown.
