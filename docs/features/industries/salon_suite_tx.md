# Texas salon-suite licensees workflow review

Reviewed 2026-09-24. Scope is the live `salon_suite_tx` brain entry and the implemented `tx_tdlr_salons` adapter for Texas `Mini Establishment` records. This was a fixture/code audit only. It did not call an endpoint, collect names, phone numbers, or addresses, load secrets, perform a private/residential lookup, run an append, or use a paid service.

## Hypothesis

A current Texas Mini Establishment license can provide a public salon-business and published business-contact candidate. It does not name a human owner: `owner_name` is a duplicate licensee/business label. A person-like business name is at most a licensee candidate. The repeated `owner_telephone` field is the same business line and cannot become a second number or evidence that an owner personally uses it.

Suite tenants and salon-suite operators are different businesses. A Mini Establishment row can support a tenant/licensee candidate; it cannot identify a building operator, and an address cluster alone cannot turn a tenant into the operator. Likewise, an operator's shared suite-building number must not be attributed to any individual tenant. No owner-confirmed mobile, reachability, DNC, or delivery result was measured.

## Bounded fixture and code audit

On 2026-09-24, five Mini Establishment fixture rows from `tests/fixtures/registers/tx_tdlr_salons.json` were inspected only through aggregate field comparisons. All five had a populated business telephone, `owner_name` equal to `business_name`, and `owner_telephone` equal to `business_telephone`. All five business addresses and business telephones were distinct in this small fixture; two of five had a nonempty mailing street different from the business street.

This confirms the adapter's explicit mirror flags and its choice to preserve only `business_telephone` in `name.phone10`. It is not a live coverage measurement and cannot establish that Mini Establishments are always one-person businesses, that a business number reaches the licensee, or that a differing mailing field identifies an owner. The historical brain rates retain their separate research-estimate denominator.

## Runtime review and correction

`txTdlrSalonRow` in `src/lib/lead-engine-registers.ts` correctly flags both mirror fields and does not use a differing `owner_telephone`. It also parses a person-like `business_name` as a `Licensee`, which must remain candidate-level evidence rather than owner confirmation.

The material shared-runtime defect is that the adapter builds `payload` with `omit(row, ['business_mailing'])`. That preserves `mailing_address_line1` and the related mailing-address fields, while the source catalog says these fields often contain the owner's home mailing address. The delivery path must not retain those private/residential fields merely because they are present in the public license row.

Root correction: in `txTdlrSalonRow` (`src/lib/lead-engine-registers.ts`), replace the broad raw-row payload with a whitelist that excludes all `mailing_address_*` fields and `business_mailing`; retain only source/license/status fields needed for provenance and the two mirror flags. Add a fixture assertion that a row with mailing address fields cannot persist them. This review does not authorize any reverse-address append or use of mailing data.

## Workflow and failure handling

1. Start with a current Mini Establishment license row.
2. Distinguish the licensed tenant/business from a suite-building operator. Hold any ambiguous shared-address or operator claim.
3. Record the public business number only once. Reject a missing or malformed number; do not treat `owner_telephone` as an additional or owner line.
4. Keep a person-like licensee label as a candidate only, and hold business/entity labels or unsupported owner claims.
5. Remove residential mailing fields before persistence. A future authorized contact/compliance gate and independent owner evidence would still be required before delivery.

## Sources

| Source | Evidence | Exact reference | Use |
| --- | --- | --- | --- |
| Texas TDLR All Licenses, dataset `7358-krk7` | VERIFIED | `handoff/04_SOURCE_CATALOG.md` Texas TDLR cosmetology and barber entry; `handoff/07_RESEARCH_BUILD_SPEC.md` §5.5 Group E | Mini Establishment license, business contact field, and documented mirror/name traps. |
| TX Mini Establishment runtime adapter | VERIFIED | `src/lib/lead-engine-registers.ts` `txTdlrSalonRow`, `txTdlrSalons` | Current expiry check, public business-phone extraction, and mirror flags. |
| Five-row fixture | VERIFIED fixture/code audit | `tests/fixtures/registers/tx_tdlr_salons.json`; `tests/lead-engine-registers.test.ts` | Bounded mirror-field and mailing-difference audit; no live outcome measurement. |

## Remaining measurement

After the mailing-field removal, use a consented 5-20-row business-contact audit with aggregate-only results. Keep separate denominators for current Mini Establishment rows, rows with valid published business numbers, records classified as tenant versus operator/ambiguous, independently evidenced owner candidates, authorized contact-gate passes, and delivered contacts. Do not query or append residential mailing data. Cost per clean owner contact remains unknown.
