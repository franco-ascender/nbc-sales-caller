# Texas restaurants and bars — workflow review

Reviewed 2026-09-24. `restaurant_tx` is mapped to the implemented `tx_tabc` recipe-B adapter. This review does not revise the live brain's historical `expected_clean`, `expected_any`, or `n` values.

## Hypothesis and bounded audit

The public TABC `owner` field can identify a named **liquor-license-holder candidate** for an active retail alcohol license. It does not establish that the named person operates the restaurant, owns its operating business, manages the permit, or owns a telephone. In particular, a restaurant operator and a liquor-license holder or permit manager can be different people. TABC's active BG, BQ, NT, and MB rows also include off-premise, nonprofit, university, catering, bar, and entity-held licenses, so an alcohol-license class alone does not establish an independent restaurant operator.

I ran a five-case local fixture/code audit on 2026-09-24 against the first five saved rows in [tx_tabc.json](../../../tests/fixtures/registers/tx_tabc.json), through `txTabc`. The three person-form `owner` values were retained by the parser; two entity-form values were held as `owner_is_entity`. One of the retained people had a mailing address different from the premises, and the current adapter puts that address into the recipe-B home-address candidate field. The fixture contains no phone field. This was a local fixture/code audit only: no network, secret, paid source, append, trace, phone verification, residential/property lookup, or contact export ran.

The fixture confirms parser behavior, not that a retained individual owns or operates the named restaurant/bar, is a permit manager, owns a handset, is reachable, is DNC/TCPA-clear, or should be delivered. The denominator is five saved rows; `verifiedPhones` remains zero.

## Workflow and failure cases

The TABC row is first restricted to active supported license types and a parseable person-form license holder. Entity, institutional, incomplete-name, and out-of-scope-license rows stay held. A person-form TABC `owner` is then retained as liquor-license-holder evidence only. It cannot become an operator, permit-manager, business-owner, or direct-owner-contact label based solely on name, trade name, address, or a later phone match.

No TABC phone is present. A different mailing address is not a permissible fallback: it can be residential and must never be parcel-searched, appended, traced, or used to infer a private phone. The only contact branch in this workflow starts with an **explicitly published business contact** from a separately implemented, legally eligible public business source that is matched to the exact trade name and premises. That source is not implemented for `restaurant_tx`; therefore the safe current outcome is a hold. A public business number remains a business-contact candidate, not proof that it belongs directly to the license holder or restaurant operator.

The mandatory later proof sequence is separate: exact business identity, current restaurant-operation evidence, current owner/operator evidence, explicit business-role link for the same published contact, then line, reachability, DNC/TCPA, suppression, duplicate, freshness, and timezone gates. A liquor-license-holder row, a permit-manager title, a public business number, or mobile line type alone does not satisfy those proofs.

## Runtime finding and safe correction

Two shared behaviors conflict with this boundary. `txTabcRow` in [lead-engine-registers.ts](../../../src/lib/lead-engine-registers.ts) labels a parseable TABC `owner` as `titleCode: 'Owner'` and copies a different `mail_address` into the name row. `pullNames` then records that address as `home_street`, while `parcelStep` and `traceStep` in [lead-engine-jobs.service.ts](../../../src/services/lead-engine-jobs.service.ts) parcel-search or send recipe-B home addresses to BatchData skip trace. The generic quote path in [lead-engine-jobs.ts](../../../src/lib/lead-engine-jobs.ts) specifically considers `tx_tabc`'s differing mailing address a recipe-B home path.

Safe correction proposed for root:

1. Change the TABC parser's title/provenance to `Liquor license holder candidate`; preserve the source field but do not call it `Owner`, `Operator`, or `Permit manager`.
2. Add an explicit `restaurant_tx` guard in `quoteJob`, `pullNames`, `parcelStep`, and `traceStep`: do not derive, retain as `home_street`, parcel-search, append, or trace any TABC mailing or premises address. Existing restaurant_tx recipe-B rows should be held with `published_business_contact_unavailable` before either residential phase.
3. Make the only fallback an explicitly implemented public business-contact source matched to the TABC trade name and premises. Require separate restaurant-operation, ownership/operator, and direct-business-contact evidence before owner-labelled delivery. Until that source exists, keep the job/row held rather than silently falling back to a residential path.

This requires no new provider, source call, paid request, or private data. I did not edit shared runtime files.

## Remaining measurement

After the hold guard and an eligible published-business-contact source are implemented, run only a lawful 5–20-row aggregate study. Measure separately: active TABC rows; person-form liquor-license holders; restaurant-operation match; license-holder versus operator/permit-manager role; explicit published business contact; current independent owner/operator support; direct-business-role support for that contact; mobile; reachable; DNC/TCPA-clear; suppression/duplicate-clear; and delivery. Do not use TABC mailing addresses, parcel/property sources, residential addresses, private-phone discovery, paid appends, secrets, or prohibited lists.

## Root integration regression check, 2026-09-24

The TABC adapter now labels the person License Holder rather than Owner. That does not establish restaurant ownership or a direct handset; a separately published business-contact route is still pending.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
