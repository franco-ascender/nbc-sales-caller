# Florida property-manager workflow review

Reviewed 2026-09-24. The live brain routes `property_manager` in Florida to recipe B through `fl_re:property_management`, with historical Anas `expected_clean` 0.38 and `n` 40. Those historical figures are not reproduced here and are not a measurement of owner confirmation, phone outcome, or cost per clean contact.

## Hypothesis

An active Florida BK Broker record can provide a property-management identity candidate only when the management signal belongs to an independently operating broker. A broker license, DBA, employer name, or real-estate role does not establish ownership of a property-management company or ownership of a handset.

The reviewed Florida register has no phone field. Its recipe-B implementation carries a broker street into parcel and skip-trace processing. That is a residential/private-contact route, so it is held for this workflow: this review neither used nor recommends property search, parcel lookup, skip trace, or phone append.

## Five-case fixture audit

I ran an offline, five-case parser and routing audit on 2026-09-24. It called `flReRecord`, `splitRegisterSource`, `registerSourceFor`, and `route` with synthetic values only. No network endpoint, paid vendor, secret, residential lookup, phone value, or personal-contact data was used.

| Synthetic active BK Broker case | Current `businessType` | Selected by `fl_re:property_management`? | Meaning |
| --- | --- | --- | --- |
| Property-management employer | `Broker: Property Management` | Yes | An employer-backed broker can enter the route. |
| Sole broker with property-management DBA | `Broker` | No | The likely independent-business signal is missed. |
| Rental employer | `Broker: Property Management` | Yes | Employer text drives the signal. |
| Leasing employer | `Broker: Property Management` | Yes | Employer text drives the signal. |
| Generic sole broker | `Broker` | No | Correctly not selected, but indistinguishable from the matching DBA case. |

`route('property management', 'FL')` selected recipe B and `fl_re:property_management`, as intended by the brain. The adapter requests `RE_rgn1.csv` through `RE_rgn7.csv` and returns no request for region 8 or later, although the verified catalog lists regions 1 through 14.

This is code behavior only. It does not measure public-business coverage, current ownership, line type, DNC/TCPA, reachability, or delivery. `verifiedPhones` is zero.

## Actual workflow and holds

1. Read only Current, Active Florida BK Broker records from the DBPR regional CSV adapter.
2. Check property-management vocabulary in the DBA and employer fields. A generic broker remains outside this niche.
3. Treat a sole broker with a matching DBA as the stronger identity candidate. An employer-backed broker is employee/role evidence unless independently corroborated.
4. Hold every record that has only a register address. Do not turn that address into a person contact.
5. A future separately approved route may use an explicitly published business contact, then must record line type, reachability, DNC/TCPA, suppression, freshness, current ownership, and handset relationship independently.
6. Deliver an owner-confirmed classification only after all of those evidence gates pass.

## Failure cases and concrete correction

| Failure | Current result | Correction | Status |
| --- | --- | --- | --- |
| Employer-backed broker is selected as a property manager. | `flReRecord` tests only `employer` for `FL_PM_PATTERN`; `pullNames` selects its `business_type`. | In `src/lib/lead-engine-registers.ts` `flReRecord`, assess DBA and employer for management vocabulary, but emit a property-manager filter value only when a sole broker's matching DBA supports the independent-business candidate. Keep employer-backed rows as unresolved role evidence. | Proposed shared correction |
| Sole broker with a matching property-management DBA is omitted. | Its current `business_type` is simply `Broker`. | The same parser correction should give the qualifying sole-DBA row a filterable property-manager value. | Proposed shared correction |
| Nearly half of the catalogued regional source is unrequested. | `FL_RE_FILES` is built from `[1, 2, 3, 4, 5, 6, 7]`. | Expand the array to all fourteen catalogued regional files, preserving the positional parser and active-BK gates; add a region-8 request fixture. | Proposed shared correction |
| Register street is used as a route toward private contact discovery. | Recipe B recognizes `fl_re` as carrying a home street and skips parcel before trace processing. | Keep this branch held for `property_manager`. Do not use private/residential lookup or append as the remediation. | Blocked by workflow scope |
| Broker identity becomes owner confirmation. | A `Sole Broker` title is stronger than an employed broker role but still does not prove ownership of a property-management company or phone. | Preserve it as candidate evidence and require independently recorded current ownership and handset evidence. | Implemented classification rule |

## Sources and implementation status

| Source | Evidence | Runtime status |
| --- | --- | --- |
| Florida DBPR regional real-estate CSVs | VERIFIED in `handoff/04_SOURCE_CATALOG.md` and `handoff/07_RESEARCH_BUILD_SPEC.md` §4a. They carry BK Broker, DBA, employer, status, and address fields; no phone field. | Implemented adapter subset |
| `flReRecord` and `FL_PM_PATTERN` | VERIFIED at `src/lib/lead-engine-registers.ts`. Current/active/Florida/BK guards are implemented; property-manager marking is employer-only. | Implemented, incomplete |
| Brain source filter and job-name query | VERIFIED at `src/data/lead-engine-brain.json`, `src/lib/lead-engine-brain.ts`, and `src/services/lead-engine-jobs.service.ts`. | Implemented, unsafe role selection for this niche |
| Property-manager-specific published business-contact adapter | No such adapter is implemented. | Blocked |
| Recipe-B residential/private-contact steps | VERIFIED at `src/lib/lead-engine-parcel.ts`, `src/lib/lead-engine-jobs.ts`, and `src/services/lead-engine-jobs.service.ts`. | Blocked for this workflow scope |

## Cost and remaining measurement

The fixture audit cost $0. No clean delivered owner contact was measured, so `perCleanUsd` remains null. The historical property-manager benchmark uses another denominator.

After the shared parser fix, rerun these five synthetic cases and add a region-8 request fixture. Only a sole broker with a matching property-management, rental, or leasing DBA should enter the identity-candidate branch; employer-backed, generic, inactive, and out-of-state records should hold. A contact study requires explicit approval of a lawful published-business-contact source and must record business fit, current ownership, line type, DNC/TCPA, reachability, and delivery separately, without residential or private-phone enrichment.

## Runtime defect for shared-owner review

`flReRecord` in [lead-engine-registers.ts](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-registers.ts) sets `propertyManagement` from `employer` only, while [lead-engine-brain.ts](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-brain.ts) and [lead-engine-jobs.service.ts](/Users/francocappanera/NBC%20Sales/Caller/src/services/lead-engine-jobs.service.ts) use that resulting `business_type` as the property-manager selection filter. The five synthetic cases show this selects property-management employers and misses a sole broker whose DBA says property management. The adapter's `FL_RE_FILES` also stops at region 7 despite the catalogued region 1-14 source set.

The safe correction is to classify matching sole-broker DBAs as the property-manager identity-candidate branch, hold employer-backed brokers pending independent ownership evidence, and cover all fourteen verified regions. Do not solve the missing phone field by routing broker residences into private contact enrichment.
