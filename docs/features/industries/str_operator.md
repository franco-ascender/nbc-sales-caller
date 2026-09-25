# Short-term-rental operator review

Reviewed 2026-09-24. The live brain maps `str_operator` to recipe C in Louisiana (`nola_str`) and Florida (`orlando_str`). Its `expected_clean` of 0.45 and `n` of zero remain research estimates in the brain; this review does not convert them into an owner, mobile, reachable, or cost measurement.

## Hypothesis

An official STR permit can establish a current permit/license-holder or published permit-contact candidate. It can support an operator workflow only when the row supplies an explicitly published business contact and separately supports the person's current operating-owner relationship. A host, permit contact, property owner, manager, or license holder is not automatically the business owner, and a mobile verification cannot supply that missing relationship.

No property address, owner address, parcel, residence, or private-phone lookup is a permissible way to repair a missing role or contact fact. The register is read only for its published permit fields.

## Five-case offline parser audit

On 2026-09-24 I ran five synthetic rows through `nolaStrRow` and `orlandoStrRow`, using no network requests, credentials, paid vendors, real contact values, or address/property lookups. The fixtures used distinct placeholder permit IDs, names, streets, and phone-shaped values.

| Case | Current parser result | Meaning |
| --- | --- | --- |
| NOLA Issued; person contact equals person license holder | Accepted with title `Contact` | A role label does not state ownership or that the phone is business-use contact evidence. |
| NOLA Issued; person contact differs from person license holder | Accepted as the contact person | A manager/co-host/contact can replace the named holder as the lead identity. |
| NOLA Pending; person contact equals holder | Accepted | A pending application is not an issued/current permit. |
| NOLA Issued; entity holder plus person contact | Accepted as the contact person | The contact is not shown to own or operate the entity. |
| Orlando Active; person license holder plus entity property owner | Accepted as license holder | Holder and property-owner roles differ; property-owner data must not be used for residence or personal-contact discovery. |

The fixture audit measures parser behavior only. It does not measure endpoint coverage, contact consent, line type, reachability, DNC/TCPA, ownership, or delivery. `verifiedPhones` is zero.

## Actual runtime and correction

`nolaStrRow` accepts both `Issued` and `Pending` rows and preferentially turns `contact_name` into the lead whenever it is person-shaped, even when it differs from `license_holder_name`. `orlandoStrRow` accepts an active person license holder. Recipe C then selects any non-null register phone and the generic verification/delivery path can deliver a mobile after line-type, DNC/TCPA, reachability, and time-zone gates. Those gates do not establish that the person is the STR business owner or that the permit phone is an explicitly published business contact.

The safe shared-runtime correction is:

1. Change `nolaStrRow` to accept `Issued` only; retain pending applications as held/skipped source records.
2. Persist a source-specific role fact for NOLA (`permit_contact`, `license_holder`, and whether the person names match) and Orlando (`license_holder`). Do not substitute a differing NOLA contact for the holder as an owner identity.
3. In `settleVerified`, hold `str_operator` rows unless independently recorded current-owner evidence **and** explicit published-business-contact evidence are true. Existing NOLA and Orlando schemas do not provide both facts, so they remain candidate/held rows. Do not use property-owner names or addresses, parcel data, a residence, skip trace, or phone append to satisfy either field.

This is conservative: it preserves the public-register ingest for audit and future lawful business-contact evidence, while stopping an unsupported owner delivery claim. It does not assert that every permit holder is a host, owner, manager, or business operator.

## Sources and limits

| Source | Evidence | Runtime status |
| --- | --- | --- |
| New Orleans STR permit applications, `en36-xvxg` | VERIFIED in `handoff/04_SOURCE_CATALOG.md` and `handoff/07_RESEARCH_BUILD_SPEC.md` §5.9: fields include permit status, contact name/phone/email, license-holder name, and address. The catalog describes personal email/address exposure; it does not document an owner or business-contact role for every contact. | Implemented parser, unsafe owner delivery path |
| Orlando STR licenses, `ssrj-rbua` | VERIFIED in the same catalog/spec: active status, license-holder phone/email, property-owner names and addresses. It does not establish that a holder is the business owner or that the owner address may be used for contact discovery. | Implemented parser, unsafe owner delivery path |
| Recipe-C register selection | VERIFIED at `src/lib/lead-engine-brain.ts`, `src/lib/lead-engine-jobs.ts`, and `src/services/lead-engine-jobs.service.ts`: non-null register phones pass to paid verification and generic delivery gates. | Implemented, incomplete role gate |
| Independent current-owner plus explicitly published business-contact evidence | UNKNOWN | No adapter or row-level evidence gate is implemented; blocked pending a lawful source with those facts |

## Failure cases

| Failure | Correction | Status |
| --- | --- | --- |
| A pending NOLA application is treated like a current permit. | Restrict the parser to `Issued`; retain `Pending` as non-deliverable source evidence. | Proposed shared correction |
| A NOLA contact/manager can replace a different license holder. | Retain each role and hold differing contact/holder identities from owner delivery. | Proposed shared correction |
| A permit or license holder is called an operating business owner. | Require independent, current owner evidence; otherwise label only as candidate/held. | Proposed shared correction |
| A public permit phone is treated as an explicitly published business contact. | Require an affirmative source fact for business-use publication; do not infer it from a permit phone/mobile result. | Proposed shared correction |
| Property-owner address/name becomes a path to residential or private-phone enrichment. | Do not use property-owner data for lookup, matching, parcel work, skip trace, or append. | Implemented workflow boundary; runtime needs the STR hold gate |

## Cost and next measurement

The offline code audit cost $0. No paid discovery, verification, append, or contact lookup ran, so `perCleanUsd` remains null. The brain's historical estimate and the research claim of low economics use different assumptions and are not observed cost per delivered owner contact.

After the shared correction, repeat the five synthetic cases: only an issued row with its role facts retained may become a candidate; pending, entity-contact-only, and differing-contact/holder rows must hold. Before any live contact study, obtain a legally eligible source whose schema explicitly supports a business contact and current owner relationship, then separately measure business fit, role/ownership, line type, DNC/TCPA, reachability, suppression, and delivery. Do not collect personal or residential contact data.

## Runtime defect for shared-owner review

[lead-engine-registers.ts](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-registers.ts) `nolaStrRow` accepts `Pending` and preferentially names any person-shaped `contact_name`; [lead-engine-jobs.service.ts](/Users/francocappanera/NBC%20Sales/Caller/src/services/lead-engine-jobs.service.ts) `settleVerified` has no STR owner/business-contact role gate. Together, a pending application or a manager/contact with a published permit phone can enter generic mobile delivery as though it were an owner workflow.

Restrict NOLA to issued permits, retain holder/contact roles without substitution, and hold all STR rows until explicit business-contact and independently supported current-owner facts are present. Do not repair the evidence with property-owner/residential lookup or private-phone enrichment.
