# Electrical industry workflow review

Reviewed 2026-09-24. The live brain keeps electrical in recipe A with Anas's historical `expected_clean` 0.20 and `n` 200. Those values are not restated as a new measurement here.

## Hypothesis

For independent electrical contractors, a published business number can begin a business-contact workflow. A register field called `owner_name` or `owner_telephone` is not sufficient owner or handset evidence. Deliver only after the existing line-type, live, DNC, shared-delivery dedupe, and independent owner-evidence gates pass.

Texas TDLR Electrical Contractor rows illustrate the risk. In the bounded sample, each row had both phone fields, but `owner_telephone` exactly matched `business_telephone` in all ten rows. `owner_name` also exactly matched `business_name` in all ten. This source supplies a business-contact candidate, not a named owner or a second/direct owner phone.

## Free bounded observation

I called the catalog's VERIFIED public endpoint `https://data.texas.gov/resource/7358-krk7.json` with an Electrical Contractor filter and `$limit=10`. No contact values, names, or addresses were retained or emitted.

| Measure | Result |
| --- | ---: |
| Rows returned | 10 |
| `business_name` present | 10/10 |
| `owner_name` present | 10/10 |
| `business_name` exactly equals `owner_name` | 10/10 |
| `business_telephone` present | 10/10 |
| `owner_telephone` present | 10/10 |
| `business_telephone` exactly equals `owner_telephone` | 10/10 |

This confirms only small-sample field coverage and duplication. It measures neither mobile line type, reachability, DNC status, owner role, ownership of a handset, nor delivery yield. `verifiedPhones` remains zero.

## Workflow

1. Start with an electrical-positive business discovery result under the live recipe-A route (`electrician`, `electrical`); reject generic contractors and generator, solar, lighting, or low-voltage-only results.
2. When the state has a legally usable public electrical register, retain a matching active license as business and license evidence. Treat TDLR's duplicated `owner_name` as business identity, not owner evidence.
3. Retain one copy of a published business phone when the two TDLR phone fields normalize to the same value. Run the existing line-type, live, DNC, and global delivery-dedupe gates.
4. Deliver only a number that passes those gates. If independent owner evidence remains absent, hold or classify it as a business contact; do not label it an owner-confirmed mobile.

## Industry-specific failure cases and correction

| Failure | Why it matters for electrical | Mitigation | Status |
| --- | --- | --- | --- |
| TDLR `owner_name` is called an owner | The observed values duplicate the business name, so the column label does not prove a person or ownership. | Treat it as unverified business identity when duplicated; require independent person/ownership evidence. | Proposed adapter/filter |
| Mirrored TDLR phones are treated as two contacts | `owner_telephone` duplicated `business_telephone` in all observed rows. | Normalize and collapse a matching pair before verification and delivery dedupe. | Existing global dedupe; source-specific intake missing |
| Adjacent electrical work becomes electrical contracting | Generator, solar, lighting, low-voltage, and security businesses can share search terms without providing core electrical service. | Require an electrical core term or matching class; adjacent-only rows go to review/rejection. | Implemented relevance classifier |
| Florida DBPR rows are treated as phone-bearing | The brain's `contractor_fl` text says "phone on file," but the implemented extractor has no phone column. | Use the Florida file as qualifier identity only and require a separate published business contact. | Runtime correction needed |

## Iteration completed

The initial Texas route could have interpreted `owner_name` and `owner_telephone` as owner evidence. The bounded live observation found every sampled owner field duplicated its business counterpart. The implementable free correction is source-specific field semantics: collapse the matching phone fields to one business-contact candidate and never let either owner field satisfy owner evidence.

## Source record

| Source | Tag | Exact reference | Use | Status |
| --- | --- | --- | --- | --- |
| TX TDLR All Licenses, Electrical Contractor | VERIFIED | `handoff/04_SOURCE_CATALOG.md`, TX TDLR row; `handoff/07_RESEARCH_BUILD_SPEC.md`, Electrical/TX row; `https://data.texas.gov/resource/7358-krk7.json` | Public electrical business identity and phone candidate; owner fields are duplicated in the observed sample | Proposed adapter/filter |
| Live electrical brain entry | VERIFIED runtime configuration | `src/data/lead-engine-brain.json`, `industries.electrical`; loader `src/lib/lead-engine-brain.ts` | Current recipe-A discovery | Implemented |
| Electrical relevance classifier | VERIFIED runtime implementation | `src/lib/lead-engine-industries.ts`, `PROFILES` electrical entry and `classifyRelevance` | Core versus adjacent trade filter | Implemented |
| FL DBPR construction/electrical extract | VERIFIED runtime implementation | `src/lib/lead-engine-registers.ts`, `FL_DBPR_FILES`, `flDbprRecord`, `flDbprConstruction` | Qualifier candidate and class code; no phone column | Implemented adapter; routing correction proposed |

## Cost and remaining measurement

The free register observation has `$0` input cost. It is not an outcome measurement, so cost per clean delivered owner contact is unknown and remains null. The historical electrical brain rate uses a different denominator and is not evidence for this source.

The next bounded measurement is a synthetic/runtime test for Texas mirrored owner phone fields and Florida electrical routing: the former must produce one business-contact candidate and no owner label; the latter must be word-order independent and hold DBPR records without a separately published business phone. A later authorized outcome sample must measure line type, DNC outcome, reachability, and owner confirmation separately before any per-clean cost can be asserted.

## Runtime defect for shared-owner review

`src/data/lead-engine-brain.json` says `contractor_fl` has a qualifier "phone on file," while `src/lib/lead-engine-registers.ts` function `flDbprRecord` parses the 22-field construction/electrical extract and sets no `phone10`; its source comment confirms the extract has no phone column. The shared brain must label this route identity-only and require a separate published business-contact source.

Also, `src/lib/lead-engine-brain.ts` function `matchIndustry` matches ordered aliases. `Florida electrician` matches `contractor_fl`, whereas `electrician Florida` falls through to generic `electrical` recipe A. Resolve state tokens independently of word order, then map Florida electrical to a class-filtered identity-only DBPR route rather than a phone-bearing recipe-D route.
