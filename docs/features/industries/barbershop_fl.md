# Florida barbershops — establishment-owner evidence without practitioner or private-contact expansion

Reviewed 2026-09-24. This review covers only the live `barbershop_fl` Florida DBPR route. No source request, paid service, private/residential lookup, phone append, or contact data collection was performed.

## Hypothesis

The free weekly `lic03bb.csv` establishment (`BS`) record can provide a named barbershop-owner candidate when address line 1 is a parseable person. It contains no phone field. A named `BS` record is ownership evidence for the shop, but it is not a confirmed owner handset. `BB` and `BR` rows identify barbers or restricted barbers and carry their home street; they are practitioner records, not evidence that the practitioner owns a barbershop.

There is currently no verified, implemented public business-contact source for this route. Do not use the named owner or a practitioner/home address to discover, append, trace, or represent a private number.

## Five-case fixture audit and live runtime path

The existing local `fl_dbpr_barbers` fixture and parser test were run on 2026-09-24 with `node --experimental-strip-types --test tests/lead-engine-registers.test.ts tests/lead-engine-parcel.test.ts`. The targeted test passes and parses the full eight-row fixture; the following five branches are the bounded review sample. No network request or contact outcome was involved.

| Case | Parser result | Required treatment |
| --- | --- | --- |
| Current `BS`, person in address line 1 | `Owner`, `Barbershop`, no street | Hold as named shop-owner candidate; no number is available. |
| Current `BS`, address line 1 is a street | `owner_not_named` | Reject; a street is not an owner name. |
| Current `BB`, usable residence-format street | `Barber` with the record street | Reject from the shop-owner path. |
| Current `BR`, unit street | `Restricted Barber` with the record street | Reject from the shop-owner path. |
| Current `BR`, ordinary street | `Restricted Barber` with the record street | Reject from the shop-owner path. |

The parser is accurate about field interpretation, but the connected recipe-B path is unsafe for this business-contact review. `homeStreetSource('fl_dbpr_barbers', 'Barber', street)` returns `register`; `pullNames` then copies that street into `home_street` and bypasses parcel matching. A `BS` row instead falls into the parcel branch. Both paths can advance toward tracing even though the catalog says the extract has no email or phone and the source does not establish a public business contact.

## Branched workflow

1. Read only the verified free Florida DBPR `lic03bb.csv` extract and require current, active, unexpired Florida records.
2. For `BS`, accept only a person parsed from address line 1 as a barbershop-owner candidate. Hold the candidate because this extract has no public business-contact field.
3. Reject `BB` and `BR` from the owner-shop workflow. Their person and street describe a practitioner; neither proves shop ownership or authorizes use of a residential location.
4. Reject `BS` rows without a parseable owner. Do not turn the shop address into a person identity.
5. If a separately verified and permitted published business-contact source is later mapped, retain its line as business-contact evidence only. Owner confirmation and all line/compliance gates remain separate.

## Failure cases and correction

| Risk | Safe treatment | Status |
| --- | --- | --- |
| `BB`/`BR` practitioner becomes shop owner. | Exclude those classes from `barbershop_fl`; no practitioner ownership inference. | Runtime correction needed |
| Residence-format practitioner street becomes an append or trace key. | Do not persist it for this workflow and do not enter parcel/trace processing. | Runtime correction needed |
| `BS` owner name becomes a phone or handset claim. | Keep it as owner candidate evidence only; the register has no phone/email. | Implemented source interpretation; route must be held |
| `BS` address line 1 holds a street rather than a person. | Reject with `owner_not_named`. | Implemented |
| A public shop number is treated as a direct owner line. | Require a separately reviewed public source plus independent handset, ownership, and compliance evidence. | Blocked pending source |

## Sources, cost, and next measurement

The source catalog marks the Florida DBPR barbers extract as VERIFIED, free, weekly, and explicitly without email or phone. It reports that `BS` rows carry the owner name in address line 1 on about 70–85% of its historical sample and that `BR` rows carry practitioner home street. These are source-structure observations, not a current contact-yield or ownership-handset measurement. The research build spec likewise identifies Florida barbershops as establishment-owner evidence, while its proposed contact stages require separately governed work.

This fixture audit cost $0. It measured no phones, mobile status, reachability, DNC result, owner confirmation, delivery, or cost per clean contact; `perCleanUsd` remains null. The next experiment is possible only after a legally eligible, verified public business-contact endpoint is mapped: use a 5–20-record aggregate field-coverage check that separately counts current `BS` records, parseable owner candidates, rows with a published business-contact field, independent owner support, and authorized delivery outcomes. It must exclude `BB`/`BR` and collect no residential or private-contact data.

## Concrete shared-runtime correction for root review

`src/lib/lead-engine-registers.ts:flBarberRecord` currently admits `BB` and `BR` and emits `Barber` records with their street. `src/lib/lead-engine-parcel.ts:homeStreetSource` labels those rows `register`, and `src/services/lead-engine-jobs.service.ts:pullNames` stores their home street and advances recipe B toward trace processing. Change `flBarberRecord` to accept only `BS` for `barbershop_fl` and return a non-owner/practitioner skip for `BB`/`BR`. Then add a fail-closed `barbershop_fl` guard in the recipe-B names/trace route: retain no residential street and freeze or hold the job until a separately verified public business-contact source is mapped. The `BS` owner candidate must never be promoted to an owner-confirmed contact from this extract alone.
