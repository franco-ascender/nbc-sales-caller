# Painting contractor workflow review

Reviewed 2026-09-24. The live brain sends `painting` to recipe A with historical `expected_clean` 0.20 and `n` 100. Those values remain historical Anas benchmarks; this review did not re-measure a clean-phone rate.

## Hypothesis

For independent painting contractors, Colorado's public entity record can supply a person-form registered-agent identity candidate when the entity is painting-positive. That person is not owner-confirmed: a registered agent may be counsel, a filing service, or another non-owner representative. A published business number remains a business-contact candidate, not a direct-owner or mobile claim. Deliver only after independent ownership evidence and the existing line-type, reachability, DNC, suppression, and duplicate gates pass.

This is distinct from a generic home-services route because painting discovery needs to reject paint stores, art studios, coatings manufacturers, and franchise brands before the contractor/owner hypothesis is tested. Cabinet refinishing, drywall, wallpaper, and pressure washing may be service adjacencies; they do not alone establish a painting-contractor match.

## Bounded free observation

On 2026-09-24, a free, public 20-row request to Colorado's Socrata entity endpoint (`4ykn-tg5h`) filtered to Good Standing entity names containing `PAINT` returned 17 rows with both a first and last name for the registered agent and no organization-agent name, and 3 rows with an organization agent. Only aggregate counts were retained. The sample measures registry identity-field availability, not contractor relevance precision, ownership, a person-to-business relationship beyond the registered-agent role, phone presence, mobile status, reachability, DNC clearance, or delivery yield.

The same live endpoint reported 4,381 matching Good Standing `PAINT` name rows, with 3,743 first-name and 3,743 last-name agent fields and 631 organization-agent fields. This aggregate inventory is context, not a painting-owner denominator or a phone result.

## Workflow and failure cases

1. Start from a Good Standing, painting-positive Colorado business record. A person-form registered agent becomes an identity candidate only; an organization-form agent ends the owner-candidate branch.
2. Require contractor-oriented painting evidence from the business's public-facing materials or an approved discovery record. Hold paint retail, art/studio, manufacturer, generic contractor, and adjacent-only records.
3. Look for explicit, independent public ownership evidence that matches the business and candidate. A registered-agent role, a review mention, or a person on a website by itself does not prove ownership.
4. Associate only a published business number with the confirmed business. Its presence does not prove that it is the candidate's handset or mobile.
5. Apply the existing phone/compliance gates. A delivered row requires separate owner confirmation; all other branches remain held.

| Failure case | Correction | Status |
| --- | --- | --- |
| Registered agent is called the owner | Preserve the agent's role as `owner_candidate`; require independent explicit ownership evidence. | Proposed |
| Paint retailer, art studio, coatings manufacturer, or adjacent-only service enters the contractor cohort | Require painting-contractor evidence and route non-contractor/ambiguous records to hold. | Proposed |
| CertaPro, Five Star Painting, WOW 1 DAY, Fresh Coat, or 360 Painting is treated as an independent owner-operator | Route brand matches to a franchise hold; do not delete a possible franchisee or label it owner-confirmed. | Proposed |
| A published business or tracking/VoIP number is labeled as a direct owner mobile | Keep identity and phone verification separate; use the line, reachability, DNC, suppression, and dedupe gates before delivery. | Existing gates |
| No explicit ownership proof exists | Retain at most a business-contact lead; do not create an owner lead from the registry candidate. | Proposed |

## Iteration and implementation

The initial source hypothesis was that a person-form registered agent could be a viable owner signal for painting businesses. The 20-row free sample shows that the field is commonly present (17/20), but it cannot resolve the role ambiguity. The correction is a free Colorado registry adapter that emits a role-labeled identity candidate only after painting-contractor and franchise filters, then holds it until separately corroborated public ownership evidence exists. It must not read or use registry addresses for identity enrichment.

The current implementation is only the generic painting recipe-A discovery profile in `src/data/lead-engine-brain.json`; it has no Colorado-painting registry candidate adapter or ownership-evidence gate. The published Maps business-number path is therefore descriptive of existing discovery, not a free live measurement in this review.

The material shared-runtime defect is that `nameOwners` in `src/services/lead-engine-jobs.service.ts` selects rows without `line_type`, while `extractOwnersForRows` in `src/services/lead-engine-reviews.service.ts` treats a missing `line_type` as `Mobile`. Consequently, owner extraction can fetch websites and start a metered reviews run before line type is known. The correction is to select `line_type` and require `row.line_type === 'Mobile'` before any owner-extraction work; add a regression case for a null/missing line type. This matters for painting because its existing recipe-A phone is a business number and cannot be presumed mobile.

## Sources and remaining experiment

- `handoff/04_SOURCE_CATALOG.md`, Group B: Colorado SOS endpoint `4ykn-tg5h`, public access, agent fields, no phone field, and its registered-agent limitation.
- `handoff/07_RESEARCH_BUILD_SPEC.md`, Group B hypotheses and attacks: Maps line-type separation, franchise routing, tracking/VoIP, duplicate removal, and Spanish-language routing boundaries.
- `src/data/lead-engine-brain.json`: live painting route and historical benchmark fields.
- `src/lib/lead-engine-industries.ts`: painting core and adjacent keyword profile.
- `src/lib/lead-engine-gates.ts`: delivery line/compliance/suppression/duplicate gates.
- `src/services/lead-engine-jobs.service.ts` and `src/services/lead-engine-reviews.service.ts`: pre-line-type owner-extraction defect.

The next bounded experiment is a free 5-20 row aggregate review of painting-positive Colorado entity records after a contractor/franchise classifier exists. It should report separate counts for source rows, contractor-qualified entities, person-agent candidates, independently owner-confirmed candidates, published business contacts, and authorized line outcomes. It must not use registry or residential addresses to find personal phones. `perCleanUsd` remains null until a lawful outcome measurement exists.

## Root integration regression check, 2026-09-24

Owner-name extraction now requires explicit Mobile evidence; undefined/null/Landline/VoIP inputs trigger no website fetch, meter or provider call. The runner reads verification.lineType, not a nonexistent job-row line_type column. It already selects delivered rows; the old omission was a helper-evidence default, not proof that production called unverified phones.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
