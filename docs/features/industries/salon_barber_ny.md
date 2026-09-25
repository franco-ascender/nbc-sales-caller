# New York salons and barbershops: license-role review

## Hypothesis

The NY DOS establishment register can identify a named license holder for an active salon or barbershop. A `DOSAEBUSINESS` or `DOSBARSHOPOWNER` holder is owner evidence for the licensed establishment. A `DOSAERENTER` or `DOSBARRENTER` holder is a chair-renter or independent service-business candidate, not evidence that the person owns the salon, suite operator, or building. A cosmetologist or barber drawn from the separate individual-license dataset is a practitioner only: it supplies neither employment nor ownership evidence.

The register has no phone. A safe contact alternative is an explicitly published shop business contact, only after current independent evidence identifies the same person as an owner or founder and explicitly links that business-use contact to them. A shared reception, booking platform, or suite-operator number remains a shop contact, not a direct owner line. No license role proves that a person owns a handset.

## Bounded audit

On 2026-09-24, the local five-row fixture at `tests/fixtures/registers/ny_salons.json` was parsed through `nySalons`. All five saved rows are active `DOSAEBUSINESS` rows with person-form holders, business/shop address fields, and no phone. The focused parser test also covers a synthetic `DOSAERENTER` row, which receives `Suite Renter`, and an expired row, which is held as `expired`.

This is a five-case fixture/code audit, not a live source sample. It establishes parser handling only. It does not measure live register coverage, owner truth beyond the license role, public-contact coverage, mobile status, reachability, consent, DNC/TCPA status, or delivery. No network call, secret, paid provider, property lookup, private-phone append, trace, or phone verification was used.

## Runtime finding and safe correction

The adapter in `src/lib/lead-engine-registers.ts` implements the useful role distinction. It limits the source to the four establishment/renter license types, requires a future expiration and a person holder, and preserves `Owner` versus `Suite Renter` in `titleCode`. It does not ingest the individual-practitioner dataset and does not attach a phone.

The live workflow conflicts with the safe contact boundary. `salon_barber_ny` maps to `ny_salons` under recipe B in `src/data/lead-engine-brain.json`. In `pullNames` at `src/services/lead-engine-jobs.service.ts`, every parsed holder is saved into `owner_name`. Because the source carries no phone, `parcelStep` then attempts to resolve a home address and `traceStep` can submit that address to BatchData. Neither step distinguishes a New York salon establishment holder from a renter, and neither has a public-shop-contact or independent owner-evidence gate. This would use residential/private contact discovery, which is unsuitable for this workflow.

The concrete safe correction for root is to add an early `salon_barber_ny` hold before `parcelStep` and `traceStep`: set the rows to `held` with `public_shop_contact_required`, retain the license role and register provenance, and never invoke parcel or trace for them. A later public-contact route should accept only an explicitly published business line and should call `assessOwnerEvidence` before normal contact/compliance gates. Require `supported` evidence for an establishment holder; for a renter, also retain renter status and require evidence for the renter's own business, never the host salon. This is a conservative runtime change with no new source or provider call.

## Failure cases

| Failure case | Required handling |
|---|---|
| Individual barber, stylist, or cosmetologist at the address | Hold as practitioner/employment-only. The individual dataset has no role that proves shop ownership. |
| `DOSAERENTER` or `DOSBARRENTER` holder | Preserve `Suite Renter`; consider only the renter's independently evidenced service business, never the host shop/operator ownership. |
| Establishment holder named on `DOSAEBUSINESS` or `DOSBARSHOPOWNER` | Keep the license-role owner evidence, but do not infer personal mobile, reachability, or a direct line. |
| Booking, reception, or suite-operator number | Treat as public shop contact only; hold unless explicit direct-business-contact and independent owner/founder evidence identify the same person. |
| Multi-chair or suite address | Do not assign the shared address/line to each holder. Address clustering is not implemented in this NY recipe, so unresolved shared contacts must hold. |
| Missing public shop contact | Hold. Never parcel-match the shop address or trace a residence to find a private phone. |

## Sources and status

- `handoff/04_SOURCE_CATALOG.md`, Group E: NY DOS dataset `y3u4-jbgh` is verified as daily, person-named business/renter licensing data with no phone. The separate individual dataset `ucu3-8265` is a name pool with no address and no owner/employment role.
- `handoff/07_RESEARCH_BUILD_SPEC.md`, §5.5: the historical plan distinguishes establishment holders, renters, and multi-chair shops. Its Maps/append suggestions are not implemented in the live NY recipe and do not override the private-contact boundary of this review.
- `src/lib/lead-engine-registers.ts`: `NY_SALON_TYPES`, `nySalonRow`, and `nySalons` implement the current active/person/type parsing.
- `tests/lead-engine-registers.test.ts`: focused five-row fixture assertions and renter/expired branches.
- `src/services/lead-engine-jobs.service.ts`: the material routing defect is the recipe-B `pullNames` to `parcelStep` to `traceStep` path. `src/lib/lead-engine-research.ts` contains the existing conservative `assessOwnerEvidence` definition but it is not called by that path.

## Remaining experiment

After the private-route hold and a lawful public-shop-contact intake are implemented, use a consented 5-20 row aggregate study. Record separate denominators for active establishment holders, renters, practitioner holds, public shop contacts, shared contacts, independently supported owner contacts, and authorized line outcomes. Do not use residential/property data, private-phone appends, paid tracing, or an unverified contact source. The historical brain estimates remain unchanged and are not a measured clean-owner-contact rate.
