# Movers, tree services, and haulers workflow review

Reviewed 2026-09-24. The live brain routes `movers_tree_haulers` to recipe C with the FMCSA Motor Carrier Census (`az4n-8mr2`) as its nationwide name and published-contact source. That is a carrier-register route, not a universal local-business register: a mover, tree service, junk remover, or hauler can be outside FMCSA coverage, and an FMCSA row does not establish service fit, ownership, handset ownership, or contact permission.

## Hypothesis

An active, specifically matched FMCSA carrier with one to three reported power units can supply a published business-contact candidate and a Company Officer 1 identity/role candidate. It cannot prove that the officer is the current owner. A legal-name/officer-name match becomes only a stronger sole-proprietor signal when it is consistent with the recorded entity type; it still does not prove the identity owns the published handset. Corporate officers, partnerships, blank entity types, and unsupported role claims remain candidate-only.

The three subverticals need separate relevance checks. A household-goods cargo flag supports a mover candidate. Tree, junk, or hauling wording must actually describe the service. Towing, machinery, generic freight, private-property transport, landscaping-only rows, and broad carrier names can otherwise contaminate the cohort.

## FMCSA applicability and role evidence

The source catalog and build specification mark the FMCSA census as a free, national source with carrier, officer, phone, email, entity-type, power-unit, and cargo fields. Its useful scope is active USDOT-reporting carriers. The build specification says it reaches truck-equipped businesses that meet the applicable USDOT/state carrier requirements; it also records secondary state mover registries as per-record, blocked, or unresolved. Therefore, absence from FMCSA cannot reject a local business, and presence cannot prove a business is a mover, tree service, or hauler without the specific service branch.

`Company Officer 1` is an officer field, not an owner field. The fixture audit below found the current parser conflates a legal-name/officer-name match with a sole proprietorship even on corporate rows. The published `cell_phone` and fallback `phone` fields are carrier/business-contact fields. Neither field proves it belongs to the named officer, is mobile in current service, can be reached, or is cleared for contact.

## Bounded fixture and code audit

I ran the existing focused FMCSA adapter test and a local five-row parser audit on the first five saved rows in `tests/fixtures/registers/fmcsa.json`:

```text
node --experimental-strip-types --test --test-name-pattern='fmcsa' tests/lead-engine-registers.test.ts
node --experimental-strip-types --input-type=module -e '<local five-row aggregate parser audit>'
```

The focused test passed. The aggregate-only five-row audit found:

| Measure | Result |
| --- | ---: |
| Saved active rows parsed | 5/5 |
| Person candidates retained | 5/5 |
| Non-toll-free published phone retained | 4/5 |
| Rows marked `Sole Proprietor` by current parser | 5/5 |
| Those rows whose fixture entity type was `CORPORATION` | 2/5 |

This is a fixture/code audit, not a live source measurement. It used no network request, credential, paid provider, phone export, private lookup, phone verification, or delivery. It does not measure ownership, handset ownership, mobile line type, reachability, DNC status, suppression, or outcome yield. `verifiedPhones` is zero.

## Workflow

1. Start with an active FMCSA row and describe it as a USDOT-carrier candidate. Do not use it as a complete inventory of local movers, tree services, junk removers, or haulers.
2. Require specific business fit: household-goods cargo for moving, or clear tree, junk, hauling, or equivalent service evidence. Hold towing, freight, machinery, private-property, landscaping-only, and generic transport rows unless another reviewed workflow admits them.
3. Apply the existing small-carrier hypothesis only when `power_units` is known and no more than three. Hold larger and missing counts outside the micro-owner branch.
4. Preserve Company Officer 1, `business_org_desc`, and legal-name comparison as distinct facts. An `INDIVIDUAL` carrier whose legal name matches the officer may be a stronger candidate; an officer, corporation, partnership, or blank entity type is not owner-confirmed.
5. Treat FMCSA `cell_phone` or `phone` as a published business contact. Do not derive or append a private number from officer or address data.
6. Apply independent line-type, live, DNC, suppression, global-dedupe, owner-evidence, and handset-evidence gates. Deliver only the classification those checks support.

## Failures and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| FMCSA presence or absence is treated as universal local-business coverage. | Keep its scope to USDOT-reporting carriers; retain separately reviewed business-listing/local-register routes for non-covered businesses. | Implemented source distinction |
| Broad name/cargo filters admit towing, freight, machinery, private-property, landscaping-only, or generic transport. | Require a service-specific branch and hold adjacent or ambiguous rows. | Partial |
| A Company Officer 1 match is reported as an owner or a sole proprietor even for a corporation. | Keep entity type and role provenance; require `INDIVIDUAL` consistency for a sole-proprietor signal and independent owner evidence for all owner labels. | Runtime correction needed |
| A carrier phone or `cell_phone` is described as the officer's direct mobile. | Retain it as business-contact evidence until independent contact, compliance, owner, and handset gates pass. | Partial |
| The brain's small-carrier note is not represented in the implemented FMCSA segments. | Apply `power_units <= 3` before the micro-business owner-candidate branch and hold unknown/larger fleets. | Runtime correction needed |

## Sources

| Source | Evidence and use | Status |
| --- | --- | --- |
| FMCSA Motor Carrier Census, `az4n-8mr2` | VERIFIED in `handoff/04_SOURCE_CATALOG.md` and the Group B / Movers section of `handoff/07_RESEARCH_BUILD_SPEC.md`. Supplies carrier, officer, entity-type, phone/email, power-unit, and cargo facts for the active carrier route. | Adapter implemented |
| Live brain and FMCSA adapter | `src/data/lead-engine-brain.json`, `src/lib/lead-engine-brain.ts`, and `src/lib/lead-engine-registers.ts` (`FMCSA_FILTERS`, `fmcsaRow`, `fmcsa`). | Implemented, with role/segment defects below |
| Saved FMCSA fixture and focused test | `tests/fixtures/registers/fmcsa.json` and `tests/lead-engine-registers.test.ts`. Supports parser behavior only. | Implemented fixture coverage |
| Non-FMCSA local mover/service coverage | The build spec describes state mover registries as secondary, per-record, blocked, or unresolved. No general free local route is implemented here. | Blocked/unknown |

## Iteration and next measurement

The five-row audit falsified the safe version of the current sole-proprietor heuristic: 2 of 5 rows marked Sole Proprietor were corporations in the saved fixture. The implementable correction is to make `fmcsaRow` require an explicit individual entity type before emitting `Sole Proprietor`; otherwise retain `Company Officer 1` and entity type as role evidence only. Add regression cases for an Individual name match, a Corporation name match, a blank entity type, an over-three-power-unit carrier, and adjacent towing/freight rows. The service classifier must be proven to hold those adjacent cases before it becomes a delivery route.

A future authorized live study should measure, separately by movers, tree services, junk removal, and hauling: FMCSA coverage of known local businesses; small-carrier share; published-phone line type; DNC and suppression outcomes; reachability; reached-owner confirmation; and delivery. None of those outcomes was measured here, so no clean-contact rate or cost per clean contact is asserted.

## Runtime defect for shared-owner review

`src/lib/lead-engine-registers.ts`, `fmcsaRow`, currently computes `soleProprietor` solely as `upper(legal_name) === upper(company_officer_1)`, then sets `businessType` to `Sole Proprietor`. In the five saved fixture rows, this labels two `business_org_desc = CORPORATION` rows as sole proprietors. That makes the role classification unsafe for the owner-candidate branch.

Root correction: normalize `business_org_desc` and require `INDIVIDUAL` before assigning the Sole Proprietor business type or `soleProprietor: true`; retain legal-name equality as separate, non-owner evidence for corporation, partnership, and blank entity types. Add a regression assertion that the corporate equality rows retain Company Officer 1 but are not labeled Sole Proprietor. In the same review, apply the brain's documented `power_units <= 3` constraint and explicit service filters before any small-carrier owner-candidate scoring.

## Root integration regression check, 2026-09-24

FMCSA now requires business_org_desc=INDIVIDUAL as well as legal/officer-name equality before setting Sole Proprietor. Corporations, partnerships and missing entity types remain role candidates. Independent owner proof and service-specific fleet filtering are still pending.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
