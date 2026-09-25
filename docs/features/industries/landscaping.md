# Landscaping industry workflow review

Reviewed 2026-09-24. The live brain routes `landscaping` to recipe A: a published Maps business number is the starting point. That is a business-contact path, not proof of an owner cell. The free Colorado Secretary of State (SOS) entity source can corroborate a matched business identity and create an owner candidate, but its registered-agent fields cannot establish that the person owns the company, owns the handset, or may be contacted on a personal number.

## Hypothesis

For an independent landscaping business, first establish a core landscaping fit and an advertised business contact. A matching Colorado SOS row with a person registered agent at the principal address can support an identity/owner-candidate hypothesis. An agent surname appearing in the entity name is an additional signal. None of those facts turns the published number into a direct owner mobile. A franchise, multi-location business, or adjacent-only landscaping-related trade stays out of the owner-candidate path.

## Free bounded observation

I queried the catalog's VERIFIED public CO SOS Socrata endpoint, `4ykn-tg5h`, on 2026-09-24. The query was limited to 20 Good Standing entities with no organization agent and `LANDSCAP` or `LAWN` in the entity name. It requested only the entity and agent fields necessary to aggregate the documented heuristic. Names, addresses, entity IDs, and phone values were neither retained nor emitted; no phone fields were requested.

| Measure | Result |
| --- | ---: |
| Rows sampled | 20 |
| Person agent | 20/20 |
| Both address fields present | 20/20 |
| Normalized principal/agent-address match | 15/20 |
| Agent surname appears in entity name | 5/20 |
| Both address and surname signals | 4/20 |
| Phone fields requested / verified phones | 0 / 0 |

This is identity-field coverage only. It does not measure mobile line type, reachability, DNC status, ownership of a handset, owner confirmation, or delivery. The current parser admits a person agent whose address matches the principal address; it records, but does not require, the surname signal. The four-row intersection is therefore a stronger candidate subset, not a measured owner rate.

## Workflow

1. Start with the live Maps-first landscaping route and require a core fit: landscaping, landscaper, lawn care, lawn, landscape, or grounds maintenance. Hold hardscape, irrigation, tree, pest, snow-removal, and generic-contractor-only results.
2. Segment franchise and multi-location matches before forming an owner hypothesis. `lawn_landscape` brand recognition exists, but a brand result is not evidence of a local owner.
3. Treat the Maps number as a published business contact. If absent, hold; do not derive a person number from SOS identity data.
4. For a Colorado name-matched entity, use the existing SOS adapter only as identity evidence: Good Standing, person agent, and principal-address match. `Agent-Owner` is a source label for the surname signal, not independent owner confirmation. Do not use the agent address for personal-contact enrichment.
5. Run line-type, live, DNC, and delivery-dedupe checks on the published business number. These contact checks do not establish that the named candidate owns the handset.
6. Hold the result as a business contact unless independent evidence establishes both ownership and the relationship to the handset. Only then can a future owner-confirmed workflow deliver that classification.

## Landscaping-specific failure cases and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| Hardscape, irrigation, tree, pest, or snow-removal listings enter because they are adjacent to landscaping. | Require the runtime's core landscaping terms; hold adjacent-only and generic results. | Implemented relevance classifier |
| A registered agent is called the owner, or public filing data is used to find a personal phone. | Keep CO SOS as matched business identity/candidate evidence only. Do not use agent addresses for personal-phone enrichment; require independent owner and handset evidence. | Proposed correction |
| Lawn franchises and multi-location operators are treated as one-truck owner-operated shops. | Hold brand matches for a separate franchise segment before owner-candidate processing. | Brand detection exists; owner-path handling partial |
| An advertised office or dispatch number is called a direct owner mobile. | Keep the number business-level until line type, live, DNC, dedupe, independent owner, and handset-evidence checks each pass. | Existing contact gates; owner evidence missing |

## Iteration and source record

The starting assumption was that a person registered agent could act as an owner-contact source. The 20-row observation supports only the narrower claim that the public CO SOS file often has a usable person-agent and address-match identity signal (15 of 20 in this bounded result). Because the source has no phone field in this workflow and the surname signal appears in only 5 of 20 rows, the implementable correction is to preserve it as candidate evidence and never infer a phone or owner confirmation.

| Source | Evidence and use | Status |
| --- | --- | --- |
| Live landscaping route | `src/data/lead-engine-brain.json` routes landscaping to recipe A; `src/lib/lead-engine-industries.ts` provides core/adjacent classification. | Implemented business-contact discovery |
| CO SOS Business Entities, `4ykn-tg5h` | VERIFIED in `handoff/04_SOURCE_CATALOG.md` and `handoff/07_RESEARCH_BUILD_SPEC.md`; Public Domain. The endpoint supplies entity and registered-agent identity fields, not a phone field. | Proposed landscaping identity branch |
| CO SOS adapter | `src/lib/lead-engine-registers.ts`, `CO_SOS_PATTERNS`, `coSosAgentRow`, and `coSosAgents` implement Good Standing, person-agent, and address-match handling for `LANDSCAP` and `LAWN`. Its fixtures cover accepted, organization-agent, and address-mismatch rows. | Implemented adapter, unreachable for landscaping |

## Remaining measurement

Add synthetic Colorado landscaping fixtures for: a matching person agent, organization agent, address mismatch, surname match, core listing, adjacent-only listing, and franchise listing. A landscaping job must retain the eligible person only as an identity candidate, never use the agent address for personal-contact enrichment, and never deliver an owner-confirmed label without separately recorded owner and handset evidence. A later authorized outcome pilot must measure line type, DNC, reachability, reached owner, and delivery under separate denominators. No per-clean cost is established; `perCleanUsd` remains null.

## Runtime defect for shared-owner review

`src/data/lead-engine-brain.json` has `industries.landscaping.recipe = "A"` and no `register_source`; consequently `src/lib/lead-engine-brain.ts` function `route` always returns the Maps route for landscaping. The implemented `coSosAgents` adapter in `src/lib/lead-engine-registers.ts` includes `LANDSCAP` and `LAWN` segments but cannot serve a landscaping job.

Do not fix this merely by mapping landscaping to the current recipe-B path: `pullNames` in `src/services/lead-engine-jobs.service.ts` carries register street fields into the parcel/trace workflow, which is unsuitable for this identity-only landscaping proposal. Add a tested, name-matched CO SOS identity branch that discards agent-address enrichment and records candidate evidence separately from a published business contact. Then add an explicit owner-evidence field and gate before any owner-confirmed classification is deliverable.
