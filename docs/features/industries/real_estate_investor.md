# Real-estate investor workflow review

Reviewed 2026-09-24. This review concerns business-public contacts only. It does not collect or use residential/property records, owner mailing addresses, or private append results to find personal phone numbers.

## Hypothesis

The existing NC `real_estate_investor` route is not runnable as configured. It describes a 3–8 parcel grouping source, but recipe B reads only a mapped, ingested `register_source`. A permitted replacement would need a source that explicitly publishes a business/operator contact for business use. A property owner name, landlord label, parcel count, entity role, business line, or mobile classification does not by itself prove current business ownership or handset ownership.

## Bounded audit

This was a five-case code audit, not a live-source measurement. It called `route('real estate investor', state)` and `registerSourceFor` for NC, TX, FL, WA, and PA. It made no network or paid calls and retained no people, properties, addresses, or phone values.

| State | Recipe result | Advertised route source | `registerSourceFor` | Finding |
| --- | --- | --- | --- | --- |
| NC | B, no fallback | `investors --min 3 --max 8` | null | The source shown by the brain cannot reach `pullNames`. |
| TX | B, fallback A | none | null | No runnable names source. |
| FL | B, fallback A | none | null | No runnable names source. |
| WA | B, fallback A | none | null | No runnable names source. |
| PA | B, fallback A | none | null | No runnable names source. |

`pullNames` freezes a job when `registerSourceFor` returns null. The audit therefore establishes a routing/configuration defect only. It does not measure investor identity, business relevance, owner confirmation, contact coverage, line type, reachability, DNC/TCPA status, or delivery.

## Industry-specific failure cases and correction

The material shared-runtime defect is in [lead-engine-brain.ts](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-brain.ts) and [lead-engine-jobs.service.ts](/Users/francocappanera/NBC%20Sales/Caller/src/services/lead-engine-jobs.service.ts): `route` exposes `name_source`, whereas `pullNames` depends on `registerSourceFor`, which reads only `register_source`. For NC, the former is populated and the latter is null. The concrete correction is to avoid advertising a runnable recipe-B route until a validated, permitted adapter and matching `register_source` exist; then have the source produce business-public records only. Do not solve the failure by wiring county parcel owners into private-phone tracing.

The source/role filter for any future implementation is: active commercial/operator record; explicitly public business contact; documented permitted-use basis; and a role that is more specific than property owner, landlord, registered agent, resident, or parcel owner. The business-public alternative is an authorized commercial STR/operator or business-license endpoint only when its active rows explicitly publish an operator/business contact and its terms permit the intended use. The catalog reports relevant STR records, but this review did not sample them and makes no field or permission claim beyond that report.

The current parcel code has a different purpose: given a named person, it resolves one owner-occupied home address before the paid trace step. That route must remain out of scope for this workflow. The source catalog's reported New Orleans and Orlando STR records are an alternative to test for business-public fields, not authorization to compile private owner contacts.

## Evidence and remaining measurement

Implemented evidence is the live brain entry, `route` and `registerSourceFor`, the recipe-B runner, parcel functions, and the delivery gates. The supporting catalog references are [04_SOURCE_CATALOG.md](/Users/francocappanera/NBC%20Sales/Caller/handoff/04_SOURCE_CATALOG.md) Group I and [07_RESEARCH_BUILD_SPEC.md](/Users/francocappanera/NBC%20Sales/Caller/handoff/07_RESEARCH_BUILD_SPEC.md) STR coverage; their STR route is REPORTED here, so it remains proposed.

No verified phone was observed. Input cost is $0 for this code audit, and cost per clean contact is null. The historical Anas brain figures remain outside this review because they use a different denominator.

Next, perform one 5–20-row aggregate-only sample only after selecting an authorized free business-public endpoint. Verify its permitted use, active status, operator/business-role semantics, and published-contact field coverage. Measure current owner confirmation, handset ownership, mobile line type, DNC/TCPA, reachability, and delivery as separate future outcomes.
