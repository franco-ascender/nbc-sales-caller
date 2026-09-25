# New York auto repair: public-business-contact hold

## Hypothesis

The existing NY DMV repair-shop adapter can identify a current RS or RSB facility and a person-form value from its `owner_name` field. That is historical licensee-of-record evidence only. Although the adapter currently assigns the parsed value `titleCode: Owner`, it does not establish that the person currently owns the shop, answers its public line, or owns a handset.

The register carries a facility address and no phone. The only safe future contact route for this review is an explicitly published business contact for the same repair business, followed by independent current owner/direct-business-contact evidence and the ordinary authorized contact gates. Missing or shared public contacts hold. No parcel, residential, skip-trace, private-phone append, or DMV fetch is eligible.

## Five-case local fixture/code audit

On 2026-09-24, `tests/fixtures/registers/ny_repair_shops.json` was parsed locally through `nyRepairShops` using `node --experimental-strip-types`. No network, secret, paid provider, contact-data export, residential lookup, or DMV request ran.

| Fixture outcome | Count |
| --- | ---: |
| Saved fixture rows | 5 |
| Current in-scope rows retained | 3 |
| Retained `RS` rows | 2 |
| Retained `RSB` rows | 1 |
| Held as expired | 1 |
| Held as out-of-scope `ISP` | 1 |
| Parsed phone candidates | 0 |

The retained rows carry person-form licensee values, facility/business fields, and facility street/city/state/ZIP. This establishes parser behavior and the absence of a parsed phone in these five saved rows. It does not measure live register coverage, current ownership, business-contact coverage, handset ownership, line type, reachability, DNC/TCPA, consent, or delivery.

## Existing adapter and material runtime defect

`nyRepairShopRow` in `src/lib/lead-engine-registers.ts` restricts records to `RS`/`RSB`, rejects non-future expirations and non-person names, and maps `facility_street` into the row's `street`. The adapter is correctly useful as a current license and named-licensee candidate source, with no phone field. Its label and `titleCode: Owner` are historical source semantics; they must not become an owner-confirmed-contact claim.

The live `auto_repair_ny` brain entry maps NY to `ny_repair_shops` under recipe B. `pullNames` in `src/services/lead-engine-jobs.service.ts` saves every parsed person to `owner_name`. Since `homeStreetSource('ny_repair_shops', ...)` returns `parcel`, the subsequent recipe-B `parcelStep` runs an owner-occupied residential parcel lookup for each phoneless name. A match supplies `home_street`, and `traceStep` can then submit it to BatchData. The source row's `facility_street` is a business location, but the generic B pipeline tries to discover a separate residence. There is no source-specific public-business-contact branch or owner-evidence hold before those steps.

The safe correction for root is a source-specific hold before `parcelStep` and `traceStep` for `auto_repair_ny` / `ny_repair_shops`: update phoneless rows to `held` with `public_business_contact_required`, preserve only license provenance and named-licensee-candidate status, and prevent both parcel and trace selection. A later authorized intake may admit only an explicitly published business contact matched to the facility; it must hold shared/unlinked contacts and require `assessOwnerEvidence` (or an equivalent independent current owner/direct-contact check) before any owner-labelled delivery. This is a conservative routing correction, not a new enrichment source.

## Failure cases

| Failure case | Required handling |
| --- | --- |
| Parser `Owner` label or DMV `owner_name` becomes current-owner or handset proof | Preserve it as named licensee-of-record candidate evidence only. |
| `RSB` body-shop row is silently widened into general repair | Keep the explicit business type; use only a matching, separately evidenced business-contact route. |
| Expired RS/RSB or non-repair `ISP` row enters the workflow | Keep the existing `expired` and `business_type_out_of_scope` holds. |
| No phone in the register triggers parcel matching or skip tracing | Hold as `public_business_contact_required`; do not call parcel or trace. |
| A directory/reception/shared number is treated as the named licensee's direct line | Hold unless it is explicitly published for the same business and independently linked to the current owner. |

## Sources and remaining measurement

- `src/data/lead-engine-brain.json` `industries.auto_repair_ny`: live recipe-B mapping to `ny_repair_shops`; its research estimates remain outside this audit.
- `src/lib/lead-engine-registers.ts` `nyRepairShopRow` and `nyRepairShops`: implemented RS/RSB, expiry, person-form parsing and facility fields.
- `tests/fixtures/registers/ny_repair_shops.json` and `tests/lead-engine-registers.test.ts`: saved five-case parser fixture and focused expectations.
- `src/services/lead-engine-jobs.service.ts` `pullNames`, `parcelStep`, and `traceStep`; `src/lib/lead-engine-parcel.ts` `homeStreetSource`: the private-route defect.
- `handoff/04_SOURCE_CATALOG.md` Group G and `handoff/07_RESEARCH_BUILD_SPEC.md` Automotive/NY entries: catalog evidence that NY DMV is a public facility/license identity source with no phone; the historical append plan is not used by this review.

After the hold is implemented, add a synthetic job-row regression proving `ny_repair_shops` phoneless rows become `held/public_business_contact_required` and never reach parcel or trace. A later authorized public-business-contact study may separately count active rows, person-form licensees, explicit business contacts, shared/unlinked contacts, independently supported current owners, and authorized contact outcomes. It must not use residential/property data or private-phone appends.
