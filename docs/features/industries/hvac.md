# HVAC industry workflow review

Reviewed 2026-09-24. The live brain keeps HVAC in recipe A with Anas's historical `expected_clean` 0.20 and `n` 500. Those values are not restated as a new measurement here.

## Hypothesis

For independent HVAC contractors, the publicly listed business number is a useful business-contact starting point, but a named licensee or qualifying individual is only an owner candidate. Deliver only after the existing mobile, live, DNC, duplicate, and owner-evidence gates pass. A public license register can improve name and trade evidence; it does not establish that a mobile belongs to the owner.

Texas illustrates the distinction. TDLR's A/C Contractor register provides a person-shaped `owner_name` in many rows, but the catalog says the A/C rows have no phone. Therefore its free path is owner-candidate identity plus a separately published business contact, never an owner-confirmed mobile by itself.

## Free bounded observation

I called the catalog's VERIFIED public endpoint `https://data.texas.gov/resource/7358-krk7.json` with `license_type='A/C Contractor'` and `$limit=10`. No contact values, names, or addresses were retained or emitted.

| Measure | Result |
| --- | ---: |
| Rows returned | 10 |
| `owner_name` present | 10/10 |
| Person-shaped `owner_name` under a conservative aggregate heuristic | 10/10 |
| `business_name` present | 7/10 |
| `business_telephone` present | 0/10 |
| `owner_telephone` present | 0/10 |

This confirms only field coverage in a small free sample. It measures neither mobile line type, reachability, DNC status, owner role, ownership of a handset, nor delivery yield. `verifiedPhones` remains zero.

## Workflow

1. Start with an HVAC-positive business discovery result under the live recipe-A route (`hvac`, air conditioning, heating, cooling); reject generic contractors and adjacent plumbing/electrical-only results.
2. When the state has a legally usable public HVAC register, retain a matching active HVAC license only as an owner/qualifier candidate. Texas A/C Contractor rows are identity-only because both telephone fields were empty in the sample.
3. Keep the published business contact as a business contact. Run the existing line-type, live, DNC, shared-delivery dedupe, and review/website owner-evidence gates.
4. Deliver only a number that passes those gates. If owner evidence remains absent, hold or classify it as a business contact; do not label it an owner-confirmed mobile.

## Industry-specific failure cases and correction

| Failure | Why it matters for HVAC | Mitigation | Status |
| --- | --- | --- | --- |
| A license qualifier is called an owner | HVAC licenses can name a responsible individual who is an employee, RMO, or qualifier. | Persist the role as `Qualifier`/candidate; require independent owner evidence before owner labeling. | Proposed |
| Texas A/C fields are mistaken for direct phones | The live sample had zero `business_telephone` and zero `owner_telephone`. | Treat TDLR A/C as identity-only; do not send it to a phone-verification branch without a separately published business number. | Proposed |
| Adjacent trade is accepted as HVAC | Plumbing, electrical, refrigeration, and duct cleaning appear alongside HVAC searches. | Require an HVAC core term or a matching HVAC license class; adjacent-only rows go to review/reject. | Existing discovery classifier; state license filter missing |
| A shared office number is represented as a direct owner cell | Multi-tech HVAC businesses often publish a dispatch line. | Keep phone role as business until line type, DNC, dedupe, and owner evidence all pass. | Existing gates; owner evidence remains incomplete |
| Florida HVAC takes an unfiltered contractor route | `contractor_fl` maps all construction/electrical DBPR rows, while the generic `hvac` profile is Maps-first. This can mix non-HVAC qualifiers into HVAC city/identity work. | Add a state-aware HVAC mapping such as `fl_dbpr_construction:CAC` (and explicitly decide any mechanical class); retain the source's `Qualifier` title. | Runtime correction needed |

## Iteration completed

The initial hypothesis treated Texas TDLR A/C as a candidate source for a direct business phone. The bounded live sample returned zero populated phone fields, so the implementable free correction is to use it only for licensed HVAC identity/role confirmation and keep it out of any phone-source branch.

## Source record

| Source | Tag | Exact reference | Use | Status |
| --- | --- | --- | --- | --- |
| TX TDLR All Licenses, A/C Contractor | VERIFIED | `handoff/04_SOURCE_CATALOG.md`, Group A row “TX TDLR All Licenses”; `handoff/07_RESEARCH_BUILD_SPEC.md`, TX row and detail note | Public licensed HVAC owner-candidate identity; no phone in the observed sample | Proposed adapter/filter |
| Live HVAC brain entry | VERIFIED runtime configuration | `src/data/lead-engine-brain.json`, `industries.hvac`; loader `src/lib/lead-engine-brain.ts` | Current recipe-A discovery | Implemented |
| HVAC relevance classifier | VERIFIED runtime implementation | `src/lib/lead-engine-industries.ts`, `PROFILES` HVAC entry and `classifyRelevance` | Core versus adjacent trade filter | Implemented |
| FL DBPR construction extract | VERIFIED source; corrected runtime field statement | `src/lib/lead-engine-registers.ts`, `FL_DBPR_FILES`, `flDbprRecord`, `flDbprConstruction` | Qualifier candidate and class code; adapter documents no phone column | Implemented adapter; HVAC filter proposed |

## Cost and remaining measurement

The free register observation has `$0` input cost. It is not an outcome measurement, so cost per clean delivered owner contact is unknown and remains null. The historical brain rate uses a different denominator and is not evidence for this source.

The next bounded measurement is a synthetic/runtime test for a Florida HVAC request: it should select only active HVAC class codes, preserve `Qualifier` as a candidate role, and reject a row with no independent owner evidence from owner delivery. A later authorized outcome sample must measure line type, DNC outcome, reachability, and owner confirmation separately before any per-clean cost can be asserted.

## Runtime defect for shared-owner review

`src/lib/lead-engine-brain.ts` function `matchIndustry` routes the normal input `HVAC Florida` to generic `hvac` recipe A because `contractor_fl` only has the ordered alias `florida hvac`. `Florida HVAC` routes to `contractor_fl` recipe D, so equivalent wording changes the source path. Separately, that `contractor_fl` mapping has no HVAC class filter. Correct this in the shared brain/routing layer by resolving state tokens independently of word order, then map HVAC/FL to a dedicated filtered source such as `fl_dbpr_construction:CAC` (with an explicit mechanical-class decision), rather than the unfiltered contractor mapping.
