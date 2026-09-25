# Florida contractors — DBPR qualifier identity and separate business-contact evidence

## Hypothesis

Florida DBPR construction and electrical public-record extracts can establish a current named licensee as a `Qualifier` candidate, plus class code, DBA, status, and business-address context. They cannot establish ownership of the business or a handset. The actual adapter documents no phone column, so a published business number must come from a separate route and remain a business-contact candidate until the existing contact and independent-owner-evidence gates pass.

## Live route and bounded audit

The live `contractor_fl` brain entry selects recipe D and maps Florida to `fl_dbpr_construction`. `flDbprRecord` reads `CONSTRUCTIONLICENSE_1.csv` and `lic08el.csv`, requires primary status `C`, secondary status blank or `A`, and a future expiration, then emits a `Qualifier` title. Its returned `nameRow` has no `phone10` assignment. This corrects the stale brain description that says “phone on file.”

On 2026-09-24, a five-case local fixture/code audit examined the parser and bucket branches without calling a provider or retaining contact values:

| Case | Expected branch | Observation |
| --- | --- | --- |
| Current construction person | Current qualifier candidate | Emits a named `Qualifier` and no phone. |
| Current electrical person | Current qualifier candidate | Emits a named `Qualifier` and no phone. |
| Expired record | Reject | Returns `expired`. |
| Non-current primary status | Reject | Returns `status_not_current`. |
| Current business-only licensee | Identity only | Does not create a person owner candidate; it retains business context only. |

This is parser behavior, not a field-coverage or outcome measurement. It establishes no mobile status, reachability, DNC result, phone ownership, owner confirmation, or delivery rate. Sample n=5; verified phones=0.

## Workflow and failure cases

1. Admit only the documented eligible Florida DBPR extract route.
2. Retain a record only when it is current, unexpired, and parses to a person; preserve `Qualifier` and class code.
3. Treat the person as a license-role candidate, never an owner confirmation.
4. Recipe D may discover contractor listings in cities derived from the register. A credible business match is required; city co-location, DBA text, or address similarity does not prove a person-phone relationship.
5. Apply mobile line type, live, DNC, suppression/dedupe, and independent owner-evidence checks. A published business phone or a named qualifier alone is held.

| Failure | Correction | Status |
| --- | --- | --- |
| Brain description says DBPR has “phone on file.” | Correct the shared brain description to no phone column; leave register phone null and require a separately published business contact. | Runtime/metadata correction needed |
| License qualifier becomes owner. | Persist `Qualifier` as candidate provenance and require independent owner evidence. | Partial |
| City-scraped Maps result becomes the qualifier's direct phone. | Require a credible entity match; preserve that it is business-contact evidence only. | Partial |
| Phoneless DBPR row loses its matched-Maps association. | Retain an explicit held association with match strength and Qualifier provenance. | Runtime correction needed |
| Construction/electrical class is used for a narrower trade without filtering. | Preserve `classCode`; add an explicit trade filter before a trade-specific route. | Proposed |

## Sources

| Source | Evidence and use | Status |
| --- | --- | --- |
| FL DBPR contractor public-record extracts | VERIFIED. `CONSTRUCTIONLICENSE_1.csv` and `lic08el.csv` are parsed by `flDbprRecord` as current Qualifier identity/class/DBA/address records. The adapter explicitly documents no phone field. References: `handoff/04_SOURCE_CATALOG.md` Group A FL row; `handoff/07_RESEARCH_BUILD_SPEC.md` FL row; `src/lib/lead-engine-registers.ts`. | Implemented adapter |
| Live `contractor_fl` route | VERIFIED configuration: recipe D and `fl_dbpr_construction` for FL. References: `src/data/lead-engine-brain.json`, `src/lib/lead-engine-brain.ts`. | Implemented, stale phone wording |
| Recipe-D Maps bucket and contact gates | VERIFIED runtime: register cities drive Maps discovery; `bucketStep` compares rows and normal verification applies afterwards. References: `src/services/lead-engine-jobs.service.ts`. | Partial provenance support |

## Iteration and safe correction

The first hypothesis, inherited from the brain description, was that DBPR contributed a qualifier and a phone. The five-case audit falsified the phone part: the implemented parser has no phone field. The safe free correction is to describe DBPR as identity-only and require a separately published business contact before verification. Do not infer a personal or direct-owner number from the record.

There is a second, material runtime gap. In `bucketStep` in `src/services/lead-engine-jobs.service.ts`, a phoneless register row is marked `filtered` with `drop_reason: no_register_phone`. When it matches a Maps row, that Maps row is marked bucket 4, but it does not retain the DBPR qualifier or the match association. Consequently, a DBPR qualifier cannot serve as provenance for later owner-evidence review; the Maps contact is just a Maps contact. The concrete shared correction is to persist a held, scored register-to-Maps association including source row, `Qualifier` title, class code, and match evidence, without promoting the person or contact to owner status. The verification/delivery path must still require independent owner evidence.

## Cost and remaining measurement

This fixture audit costs $0 and establishes no cost per clean delivered owner contact, which remains null. The historical `contractor_fl` brain estimate has a different, unverified denominator and is not evidence for this source.

The next bounded test should use five synthetic recipe-D rows: a current Florida Qualifier with a credible Maps match, an unmatched qualifier, an expired record, a business-only record, and a shared or office Maps line. It must preserve credible-match provenance as held candidate evidence, reject owner promotion, and deliver only after independent owner evidence plus mobile, live, DNC, and dedupe gates pass. A later authorized study must separately count current register rows, named qualifiers, credible business matches, published contact presence, mobile/live/DNC-cleared contacts, owner-confirmed contacts, and deliveries.
