# Chiropractor industry workflow review

Reviewed 2026-09-24. The live brain maps `chiropractor` to recipe B and `nppes:chiropractor`. That route reads active NPI-2 Authorized Official rows, then sends rows without `phone10` to a parcel lookup and paid skip trace. This is not an acceptable owner-contact workflow: an Authorized Official is not necessarily an owner, and a missing Authorized Official phone causes residential lookup and private-phone discovery.

## Hypothesis

An active NPPES NPI-2 record whose primary taxonomy is Chiropractor can establish a chiropractic-practice identity and an Authorized Official candidate. The NPPES LOCATION telephone is an explicitly published practice-contact candidate when present. Neither the Authorized Official title, the NPPES Authorized Official telephone, nor the practice line establishes current business ownership, a personal handset, or permission to contact a private number.

The safe alternative to legacy recipe B is a public-business-contact route: retain only the active, primary-taxonomy chiropractic NPI-2 record and its LOCATION phone; keep the Authorized Official as a role candidate; hold records without a published LOCATION phone. Do not parcel-match, trace, append, or use mailing/licence/property addresses to find a number.

## Bounded code audit

On 2026-09-24, five synthetic NPPES API-shaped NPI-2 inputs were passed directly to `nppesOrganization(item, 'Chiropractor')`. No network, secret, paid provider, address lookup, contact-data collection, or delivery operation occurred.

| Case | Parser observation | Implication |
| --- | --- | --- |
| Active Chiropractic organization, Owner title, no AO phone | Kept with `phone10 = null`. | Live recipe B can subsequently parcel-match and skip-trace the person. |
| Active Chiropractic organization, Owner title, AO phone | Kept with the AO phone as `phone10`. | The AO line is not independently proven to be an owner handset or a public practice contact. |
| Inactive organization | Skipped with `status_not_active`. | Active guard works. |
| Active Chiropractic organization, Credentialing Manager | Skipped with `staff_title_excluded`. | The staff-title guard works for this explicit title. |
| Active Dentist presented to Chiropractic taxonomy parser | Skipped with `primary_taxonomy_mismatch`. | Primary-taxonomy guard works. |

This is a five-case runtime-parser audit, not a coverage, ownership, line-type, reachability, DNC, consent, or delivery measurement. It has no verified phones.

## Workflow and failure cases

1. Read an active NPI-2 record only when the primary taxonomy is Chiropractor; preserve its organization and Authorized Official role as identity evidence.
2. Reject inactive, taxonomy-mismatched, missing-person, and explicit credentialing/billing/office-management records.
3. Keep only an explicitly published NPPES LOCATION phone as a business-contact candidate. An AO phone is not a substitute for the LOCATION contact and must not be called a direct owner phone.
4. Hold records without that public business contact. Do not derive a contact from NPPES mailing fields, licence/address data, a parcel, a skip trace, or an append.
5. Apply the existing line-type, live, DNC/TCPA, suppression, duplicate, and freshness gates to the published practice contact.
6. Require independently corroborated ownership plus an explicit direct-business-role link before an owner-confirmed classification. Otherwise retain only a business-contact classification.

| Failure | Safe handling | Runtime state |
| --- | --- | --- |
| An Authorized Official is treated as the practice owner. | Retain the title as a candidate role and require independent ownership evidence. | Partial: parser excludes some staff titles but accepts other AO titles. |
| An AO telephone is represented as an owner mobile or a practice phone. | Use only NPPES LOCATION phone for the proposed business-contact route; preserve AO phone as unproven metadata, never owner evidence. | Not implemented. |
| Missing AO phone activates parcel lookup and paid private tracing. | Hold the record when no published LOCATION phone exists; block chiropractor recipe-B parcel and trace steps. | Not implemented. |
| A corporate, repeated-AO, or franchise office is presented as an independent chiropractic owner. | Require independent ownership evidence and corporate/repeated-AO screening before owner-confirmed classification. | Proposed. |
| A published practice line is labelled a direct owner handset. | Keep it a business contact until an independent source explicitly links the same number to an owner/founder in a direct business role. | Proposed. |

## Sources and implementation status

| Source | Evidence and scope | Status |
| --- | --- | --- |
| NPPES NPI-2 API adapter | VERIFIED in runtime: requests active NPI-2 Chiropractic rows by state and ZIP prefix, checks primary taxonomy, parses AO identity, AO phone, and LOCATION phone. | Implemented, but its recipe-B downstream route is unsafe. |
| CMS/NPPES research catalogue | VERIFIED federal public directory source for provider/practice data; the build specification identifies LOCATION phone as the storefront/practice line. | Proposed public-business-contact use; no chiropractic-specific safe route is wired. |
| Independent owner evidence assessment | VERIFIED helper requires a current HTTPS business website directly linking the contact and a separate registry owner/founder corroboration. | Implemented helper, not wired as a chiropractor delivery requirement. |

## Iteration and remaining measurement

The initial live mapping assumed the NPPES name source could support recipe B. The five synthetic cases falsify that for this scope: a valid source row without an AO telephone follows the generic home-parcel and paid private-trace branch. The correction is to replace the chiropractor use of that branch with a public-practice-contact route that selects NPPES `location_phone` and holds all no-location-phone rows.

The next bounded test is a five-case route fixture after the correction: active chiropractic record with LOCATION-only phone; active record with AO-only phone; active record with both but different phones; active record with no phone; and credentialing-title record. It must select only a LOCATION phone as a business-contact candidate, hold the AO-only and no-phone records, reject the staff case, and make no parcel or trace call. A later lawful aggregate 5–20 row public-directory observation may separately measure active source rows, primary-taxonomy rows, published LOCATION-phone coverage, corporate holds, contact-gate passes, independently owner-supported cases, and delivered business contacts. Per-clean cost remains unknown.

## Runtime correction for shared-owner review

[`src/services/lead-engine-jobs.service.ts`](/Users/francocappanera/NBC%20Sales/Caller/src/services/lead-engine-jobs.service.ts:191) unconditionally invokes `parcelStep` and `traceStep` for every recipe-B job. For `chiropractor`, the mapped `nppes:chiropractor` source is parsed by [`nppesOrganization`](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-registers.ts:833), which sets `phone10` from `authorized_official_telephone_number`; its separately parsed `location_phone` remains only in payload. Thus missing AO phones enter the private residential path, while present AO phones can proceed as contact candidates without a LOCATION-phone rule.

Add a chiropractor-specific guard before recipe-B parcel/trace advancement that holds the job with a public-business-contact-only reason. Then wire a non-recipe-B public-contact path that maps active primary-taxonomy chiropractic rows' `location_phone` to the normal contact gates, retains the Authorized Official as identity-only, and holds AO-only/no-LOCATION-phone rows. Do not use a parcel, mailing address, skip trace, or append to resume those holds.
