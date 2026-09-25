# Pest control

## Hypothesis

A licensed structural-pest business can supply a business identity and a named responsible certified applicator or qualifying operator candidate. Neither a business licence nor an applicator licence proves that the person owns the business, and neither establishes that a printed or advertised business number belongs to that person. Agricultural crop-pest activity is outside this structural-pest business cohort.

## Source and runtime position

The live brain entry is `pest_control`, recipe C, with TX TDA, CA CDPR Businesses, and FL FDACS company search named as sources. The source catalog records TX TDA's five current-license CSVs as VERIFIED to exist, but their join columns are UNKNOWN; CA CDPR's lists are VERIFIED; and the FL company search is VERIFIED per record while bulk availability remains UNKNOWN. The catalog describes all three paths as B-pending/per-record identity routes, not an implemented phone-bearing recipe-C route.

No pest-specific adapter is registered in `src/lib/lead-engine-registers.ts`, and `industries.pest_control` has no `register_source` in `src/data/lead-engine-brain.json`. `quoteJob` therefore sees the descriptive `name_source` but no mapped ingest source and selects the Maps fallback. A C job cannot start its names step until a mapped source exists.

## Bounded fixture/code audit

On 2026-09-24, a five-case pure relevance audit called `classifyRelevance(text, 'pest_control')`. It made no provider, phone, or personal-data request and retained no contact values.

1. `Acme Pest Control` returned `core`.
2. `Acme Wildlife Removal` returned `core`.
3. `Acme Mosquito Lawn Treatments` returned `adjacent`.
4. `Acme Crop Pest Management` returned `core`.
5. `Acme Sanitizing Services` returned `adjacent`.

The first two are plausible structural-pest business candidates. Mosquito/lawn and sanitizing-only results need an explicit structural-pest fit before paid contact work. The crop-pest result exposes a classification defect: agricultural crop activity can enter the structural-pest cohort based on the word “pest.” This audit measures parser behavior only; it does not measure source coverage, mobile status, reachability, DNC status, handset ownership, owner confirmation, or delivery. Sample n=5; verified phones=0.

## Industry-specific failure cases

| Failure | Mitigation | Status |
| --- | --- | --- |
| An employee applicator, technician, apprentice, or certified operator is labelled the owner. | Persist exact licence type and role. Treat the responsible applicator/operator only as a candidate; hold employee-class licences and require independent business-ownership evidence. | Proposed |
| A crop-pest, agricultural, fumigation-supply, mosquito/lawn-only, sanitizing, insulation, or crawl-space service enters as structural pest control. | Require a structural-pest core fit and reject crop/agricultural activity; hold adjacent-only services for manual scope review. | Partial: crop exclusion missing |
| A business registration or register phone is labelled a direct owner mobile. | Treat it as a published business contact only. Require line type, active/reachability, DNC/suppression, dedupe, independent owner evidence, and handset relationship evidence. | Partial |
| TX, CA, or FL is represented as a running licence route although its actual ingest mapping and adapter do not exist. | Keep the route unavailable until an adapter parses source-specific business and role fields, a `register_source` is mapped, and source terms/columns are verified. | Blocked |
| A franchise or multi-location pest brand is treated as a local owner-operated business. | Segment recognized brands before an owner hypothesis; a local published business contact does not establish a local owner cell. | Partial |

## Implementable free correction

The shared relevance profile in `src/lib/lead-engine-industries.ts` needs a pest-specific agricultural exclusion before it returns `core`: reject names/categories containing crop, agricultural/agriculture, farm, orchard, greenhouse, or agronomy unless independent structural-pest evidence is present. Add five synthetic cases covering the audit above and a mixed `Crop Pest Control & Termite` case whose expected treatment is explicit. This blocks agricultural contamination without discovering or appending personal contacts.

For the register route, do not map an invented source ID. First implement a source-specific parser that preserves business and employee/applicator roles separately, confirms the TX join key and the CA/FL usable fields, and maps only the licensed-business source through `register_source`. Do not use employee-applicator data to enrich a private phone.

## Remaining measurement

After those parsers and terms are verified, run a free aggregate field-coverage sample separately for TX business rows, TX employee/applicator rows, CA business rows, and FL company-search results. Measure only active structural-pest business rows, role distribution, business-contact-field fill, duplicates, and core/adjacent/agricultural classification. A separately authorized outcome study would then measure line type, DNC, reachability, independently confirmed ownership, and delivery under separate denominators. No clean-contact cost is established.

## Runtime defect for root review

`classifyRelevance` in `src/lib/lead-engine-industries.ts` selects the `pest` profile for `pest_control` and treats its generic `pest` core term as sufficient. The five-case audit shows `Acme Crop Pest Management` is returned as `core`, allowing agricultural pest activity into this structural-pest workflow.

Safe correction: add a pest-profile agricultural exclusion ahead of the core return, with a narrowly specified mixed-service rule and fixtures. Separately, `src/data/lead-engine-brain.json` lacks `industries.pest_control.register_source`, while `src/lib/lead-engine-jobs.ts` uses `registerSourceFor` to decide whether a recipe-C register path can open. The live job correctly falls back to recipe A today, but the brain's recipe-C/source wording is misleading and cannot execute a register route. Do not add a mapping until a matching adapter exists.

## Root integration regression check, 2026-09-24

Crop/agricultural-only pest listings now fail relevance. Explicit residential/structural/termite/exterminator evidence preserves mixed businesses. Dedicated state pesticide-business adapters remain unimplemented.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
