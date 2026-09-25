# Concrete industry workflow review

Reviewed 2026-09-24. The live brain routes `concrete` to recipe A, starting from a published Maps business number. That is a business-contact path, not an owner-cell workflow. Concrete is a licensed-trade case where a legally eligible contractor register can supply a named principal or personnel candidate, subject to legal, role, contact, and owner-evidence gates.

## Hypothesis

For active concrete contractors, an explicit specialty/class filter can establish trade fit and candidate identity. A register phone remains a business or candidate contact until it is exclusive, contrasted with the public listing, and passes mobile, live, DNC, dedupe, and independent owner-evidence gates. An individual registrant or CSLB `Sole Owner` is stronger evidence than a primary principal, qualifier, RMO, RME, or officer; none alone proves ownership of a handset.

## Free bounded observation

On 2026-09-24, a free public query of the catalog's VERIFIED WA L&I Socrata endpoint, `m8qx-ubtq`, requested 20 active rows whose `specialtycode1desc` contained `CONCRET`. It selected only status, specialty, principal-presence, phone-presence, and entity-type fields, then immediately reduced the response to aggregate counts. No names, phones, addresses, license numbers, or business names were retained.

| Measure | Result |
| --- | ---: |
| Rows sampled | 20 |
| Active | 20/20 |
| Concrete specialty present | 20/20 |
| `primaryprincipalname` present | 20/20 |
| `phonenumber` present | 20/20 |
| `businesstypecodedesc = Individual` | 3/20 |

This measures field coverage only. It does not measure concrete-fit precision beyond the source specialty, owner role, phone ownership, mobile line type, reachability, DNC status, owner confirmation, or clean delivery. `verifiedPhones` is zero.

## Workflow and concrete-specific failures

1. Apply the state legal gate. WA is a public PDDL dataset, but the catalog records the RCW commercial-list ambiguity; retain the documented caution and do not use prohibited or restricted lists.
2. Require an active explicit concrete class: WA `CONCRET` or California CSLB `C-8`. Generic contractor registration is not concrete evidence.
3. Contrast with an active Maps concrete listing where permitted. Hold ready-mix, cement and aggregate suppliers, hauling, materials retail, pure asphalt/pavers, excavation-only businesses, structural-industrial operators, franchises, stale records, and multi-location matches.
4. Preserve the source role. Individual entity, Sole Owner, partner, or member are stronger candidates. Primary principal, qualifier, RMO/RME, officer, and corporate roles need independent owner evidence.
5. Compare published register and Maps numbers where both exist. Missing, shared, duplicate, and office-only numbers stay held; no private number is inferred.
6. Apply mobile, live, DNC, global suppression/dedupe, and independent owner-evidence gates. Deliver only the classification the evidence supports.

| Failure | Correction | Status |
| --- | --- | --- |
| Maps-first discovery starts with an advertised business line. | Start legally eligible routes with concrete-class identity; use Maps as activity and contrast evidence. | Proposed |
| WA `CONCRET` and CA `C-8` cannot be selected after ingest. | Persist a normalized filterable specialty/class field, or add source-specific class filtering before mapping concrete to a register. | Runtime correction needed |
| Broad concrete terms include suppliers, aggregate/hauling, paving, excavation, and industrial firms. | Require explicit contractor/flatwork/foundation/slab/driveway fit; hold adjacent segments. | Partial |
| A principal, qualifier, or public office line is labeled owner-confirmed. | Preserve role and phone provenance; require all contact/compliance and independent owner-evidence gates. | Partial |
| TX or NC is treated as a statewide concrete license route. | Do not create that route; use only permitted Maps fallback or separately reviewed local sources. | Proposed |

## Sources and remaining measurement

WA L&I is a VERIFIED public source in [the source catalog](../../../../handoff/04_SOURCE_CATALOG.md) and the research build spec. Its adapter is `waLni` in `src/lib/lead-engine-registers.ts`. California CSLB supports `C-8` concrete and has Master classifications plus Personnel role data, but the same runtime persistence gap blocks specialty-scoped selection. The live recipe-A route comes from `src/data/lead-engine-brain.json` and the concrete relevance profile in `src/lib/lead-engine-industries.ts`.

The next bounded free test should use synthetic WA CONCRET/non-CONCRET rows and CA C-8/non-C-8 master/personnel rows. It must prove that a concrete job selects only the explicit class, preserves candidate roles, holds supplier/paving/asphalt/excavation/industrial/adjacent cases, and cannot deliver an owner-confirmed contact without independent evidence. A later authorized outcome study must separately measure mobile, live, DNC-cleared, reached-owner, and delivered counts. No per-clean cost is established.

## Runtime defect for shared-owner review

`src/services/lead-engine-jobs.service.ts`, `pullNames`, parses a register suffix such as `wa_lni:concret` or `cslb:c-8` and applies it only as `ilike('business_type', ...)`. But `src/lib/lead-engine-registers.ts` function `waLni` puts `businesstypecodedesc` (for example Individual/LLC/Corp) into `business_type`, while `cslbMasterRow` stores only `BusType` and `cslbPersonnelRow` has no classification. The raw rows contain WA specialty and CSLB `Classifications`, but normalized rows discard them. Therefore a concrete mapping cannot select only CONCRET/C-8 rows.

Root correction: add a normalized, filterable trade/class field to the register-name schema and adapters, then filter that field in `pullNames` (or implement source-specific class filtering). Add the state-specific concrete mapping only after fixtures cover CONCRET/C-8 and non-concrete rows; keep recipe A as an explicit permitted fallback.
