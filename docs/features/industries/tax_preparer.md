# Tax preparers — workflow review

## Hypothesis 1

An IRS PTIN state-extract row gives a paid-preparer identity and an explicitly published **business** phone. It does not establish that the person owns the business, that the phone is mobile, or that it belongs directly to the named preparer. A surname-in-DBA row with an exclusive-enough phone is an owner/direct-line candidate only.

The live brain maps `tax_preparer` nationwide to `irs_ptin`, but calls it recipe C. The actual `irsPtin` adapter and catalog specify recipe D. This is material: C requires a register phone and goes directly from names to verification; D performs the Maps contrast and bucket step. The current route therefore has no bucket evidence, while the source documentation describes it as D.

## Evidence and five-case test

The catalog's verified IRS PTIN source publishes name, DBA, business address, website, `BUS_PHNE_NBR`, credential, and AFSP indicator. The adapter normalizes `BUS_PHNE_NBR` and writes `dbaHasSurname`; it does not apply an owner, franchise, or firm-principal classification. Source: [04_SOURCE_CATALOG.md](../../../handoff/04_SOURCE_CATALOG.md) and [lead-engine-registers.ts](../../../src/lib/lead-engine-registers.ts).

On 2026-09-24, I ran a five-case fixture/code audit against the first five data rows in [irs_ptin.json](../../../tests/fixtures/registers/irs_ptin.json), using `node --experimental-strip-types --test --test-name-pattern='irs_ptin' tests/lead-engine-registers.test.ts`. No endpoint fetch, paid provider, contact lookup, private/residential source, or phone verification ran.

| Fixture role signal | Cases | Observed adapter behavior | Interpretation |
| --- | ---: | --- | --- |
| DBA contains surname | 3 | Kobert, Bantekas, and Swett set `dbaHasSurname=true`; each retained a normalized published business phone | Owner candidate only |
| Chain DBA | 1 | H & R Block parsed and remained eligible; `dbaHasSurname=false` | Likely employee/franchise ambiguity; must hold/drop from owner claims |
| Multi-name firm DBA | 1 | Schreiner/Weskamp/Schmerge parsed and remained eligible; `dbaHasSurname=false` | Firm employee/partner ambiguity; do not select a principal without evidence |

The denominator is five saved fixture rows parsed by the adapter. It is not a live-source count, mobile rate, reachable rate, DNC/TCPA result, owner-confirmation rate, or delivery result. `verifiedPhones = 0`; no cost per clean owner contact is known.

## Failure cases and correction

PTIN coverage includes employees as well as owners. A chain/franchise name and a non-surname firm DBA must not become an owner label. A blank DBA is a weak sole-proprietor heuristic, not proof. A credential (CPA, EA, ATTY, or blank) describes professional status, not role. `BUS_PHNE_NBR` is explicitly business phone data, not a confirmed mobile or named person's handset. A number reused more than three times is correctly screened by the current names query, but is still office-line evidence rather than a direct-owner line.

The safe shared-runtime correction is for root to align `industries.tax_preparer.recipe` in [lead-engine-brain.json](../../../src/data/lead-engine-brain.json) with `irsPtin.recipe` (`D`), then add regression coverage proving PTIN rows enter `bucketStep`. Before enabling owner-labelled delivery, add a PTIN role classifier that excludes known chain/franchise staff, groups rows by normalized DBA plus address, keeps a firm principal only when separately supported, and otherwise holds the row. Keep role evidence, published-business-phone provenance, line/compliance results, and owner/direct-contact proof separate.

I did not edit those shared runtime files. The review graph in [tax_preparer.json](../../../src/data/industry-workflows/tax_preparer.json) makes the required branches explicit.

## Remaining measurement

After the routing and role gate exist, a lawful 5–20 row aggregate public-source study can measure successive denominators: PTIN people, usable published business phones, chain/employee exclusions, firm-principal-supported candidates, reuse at most 3, buckets, mobile, reachable, DNC/TCPA-clear, owner-supported, direct-contact-supported, and delivered. It must not use residential/property data, private-phone lookup, paid verification/append calls, or prohibited lists.
