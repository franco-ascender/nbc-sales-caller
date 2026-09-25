# Home-based child care workflow review

Date: 2026-09-24. Scope is the live `childcare_home` brain entry and the PA, NY, and TX public-directory adapters. This review did not query paid services, load secrets, append phones, or retain names, phone values, or addresses.

## Hypothesis

These directories can provide a legally eligible, publicly designated facility-contact path for some home-based providers, but the field is only a published business-contact candidate. It does not prove a mobile number, a reachable handset, DNC clearance, consent, or owner identity. PA has the strongest owner evidence where the responsible-person title is `OWNER`. NY identifies a provider, and TX identifies either a person-named operation/provider or an administrator/director; neither latter role confirms ownership.

California small family child care homes remain excluded from ingestion and dialing under the existing HSC 1596.86 guardrail. No residential/property matching or private-phone recovery is in scope.

## Source and role review

| State/source | Publicly designated role | Contact path | Required interpretation |
|---|---|---|---|
| PA OCDEL `ajn5-kaxt` | `responsible_person_*`; `responsible_person_title=OWNER` is explicit owner evidence | `facility_phone` | A non-OWNER title remains a provider/responsible-person candidate. |
| NY OCFS `cb42-qumz` | `provider_name` | `phone_number` unless `phone_number_omitted=Y` | Provider is not automatically owner. The omission marker is an opt-out and is already skipped. |
| TX HHSC `bc5r-88dy` | Person-form `operation_name` can support provider identity; `administrator_director_name` is only an administrator/director | `phone_number` | A business-named operation with an administrator fallback has no owner evidence. |
| CA CHHS family homes | Not eligible under current guardrail | None | Never ingest or dial small family homes. |

## Free bounded observation

A live, free TX Socrata request on 2026-09-24 used `limit=20` and selected only `operation_type`, `operation_status`, and `temporarily_closed`. The response was immediately reduced to aggregate counts: 20 records total, including 10 home records (1 Licensed Child-Care Home, 4 Registered Child-Care Home, 5 Listed Family Home); all 20 were active and not temporarily closed. No names, phone values, or addresses were retained.

A separate grouped aggregate over the three TX home types counted 4,704 rows and 4,667 populated `phone_number` fields; `administrator_director_name` was populated on 1,581 rows. That is contact-field coverage only. It supplies no verified phones and does not measure owner linkage, mobile status, reachability, DNC, opt-outs beyond NY's explicit flag, or clean-contact yield.

## Runtime review and correction

Two material defects need a shared-runtime change by the root owner:

1. `paChildcareRow`, `nyChildcareRow`, and `txChildcareRow` in `src/lib/lead-engine-registers.ts` persist `street` from home-care facility addresses and retain most raw address fields in `payload`. These are home-based providers, so this compiles residential location data even though the allowed path is a published business contact. Remove street/unit/geocode and raw facility/location/mailing/legal-entity address fields before persistence, and do not export them. A city/state/ZIP-only route should be separately justified if retained.
2. `txChildcareRow` falls back from a business-form `operation_name` to `administrator_director_name`, and the test at `tests/lead-engine-registers.test.ts` explicitly accepts that fallback. Administrator/director is not owner evidence. Hold or skip that branch for owner targeting until an independent owner source exists; do not let it be represented as an owner-confirmed contact.

The NY adapter correctly skips `phone_number_omitted=Y` before name creation. The current active/closed checks are also appropriate source filters, subject to ordinary contact and suppression gates.

## Implementable free correction

In the three childcare parser functions, construct a whitelisted payload that excludes location and address keys and set `street: null`. In TX, replace the administrator fallback with a skip/hold reason such as `administrator_not_owner`, or persist it under a distinct non-owner role that cannot enter owner-targeted delivery. Add regression fixtures for a PA/TX home record with street/mailing fields and for a TX brand-named operation with only an administrator, asserting no residential payload or street and no owner-targetable name row.

## Remaining experiment

After those corrections, perform a consented 5-20 record audit with distinct denominators for source rows, PA explicit-OWNER rows, provider-only rows, valid published business-contact fields, authorized contact-gate passes, and delivered outcomes. Cost per clean contact remains unknown; `perCleanUsd` must stay null until those outcomes are measured.

## Root integration regression check, 2026-09-24

TX no longer substitutes administrator/director for an unresolved provider name. It holds the row with owner_identity_unresolved. Existing residential payload retention is not expanded and remains a separate limitation.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
