# Permit contractors — Austin implemented, NYC not yet wired

## Hypothesis

A current building-permit record can establish a named **Permit Contractor** candidate, a contractor trade, recent activity, and a city-published business-contact candidate. It does not establish that the named person owns the company or that the published number is that person's mobile. Contractor-permit routing must preserve source, trade, and role, reject an off-target or shared-contact path, and require the existing contact/compliance and independent-owner-evidence gates before delivery.

The live brain defines `contractor_permits` as recipe D, maps Texas to `austin_permits`, and labels NYC as a name source. The runtime adapter registry contains Austin only: there is no NYC permit adapter and no `register_source.NY` mapping. NYC is therefore catalog context, not a runnable route.

## Bounded fixture/code audit

On 2026-09-24, a five-case audit ran `austinPermitRow` against the first five rows of `tests/fixtures/registers/austin_permits.json`, without provider calls or retaining contact values. Each case parsed a named person, a `Permit Contractor` title, contractor trade, and a normalized contact candidate. The five cases include mechanical and general-contractor trades; they show parser field handling, not a trade-specific owner or phone outcome.

The audit does not measure contractor relevance, independence, company size, handset ownership, mobile line type, reachability, DNC status, owner confirmation, or delivery. Sample n=5; verified phones=0.

## Runtime and catalog evidence

| Route | Evidence | Current behavior | Boundary |
| --- | --- | --- | --- |
| Austin Issued Construction Permits | `handoff/04_SOURCE_CATALOG.md` Austin row; `src/lib/lead-engine-registers.ts` `austinPermits` | The TX mapping selects recent rows with `contractor_phone`, parses `contractor_full_name` as a person, stores `contractor_trade`, and labels the person `Permit Contractor`. Root reproduced the exact seven-field adapter selection today: HTTP 200, limit 5, with all fields represented. | A contractor trade and permit contact do not prove ownership, a direct line, or suitability for every contractor trade. |
| NYC DOB legacy permits | `handoff/04_SOURCE_CATALOG.md` NYC legacy BIS row; `src/data/lead-engine-brain.json` `name_source.NY-NYC` | The catalog describes a public candidate source, but `RegisterSource`, `REGISTER_ADAPTERS`, and the live brain lack a NYC runtime mapping. | Do not represent NYC as ingested or runnable until an adapter, parser, and route mapping exist and are verified. |

The exact Austin selection intentionally contains seven needed fields: `permit_number`, `contractor_trade`, `contractor_company_name`, `contractor_full_name`, `contractor_phone`, `contractor_zip`, and `issue_date`. The parser also reads `contractor_city`, but the adapter never selects it, so Austin name rows have a ZIP but no city for city-level matching. It also reads `contractor_address1`; keep that field omitted because it is unnecessary here and could be residential. The missing city is a data-completeness defect, separate from field availability.

## Industry-specific failure cases

| Failure | Mitigation | Status |
| --- | --- | --- |
| A permit filer, employee, or qualifier is called the owner. | Persist `Permit Contractor`; require independent owner evidence before an owner label. | Partial |
| Mechanical, electrical, general, or another trade is silently treated as a requested trade. | Branch by explicit `contractor_trade`; a trade-specific campaign must use a matching trade filter and hold generic or mismatched rows. | Partial |
| A city-published contractor phone becomes a direct owner mobile. | Treat it as business-contact evidence; require global exclusivity, line type, live, DNC, suppression/dedupe, and owner evidence. | Partial |
| A high-volume firm, franchise, or shared dispatch line enters an independent-contractor route. | Apply business-size/brand and cross-source phone-reuse holds before contact verification. | Partial |
| NYC appears available because it is named in the brain. | Hold NY until a dedicated adapter and `register_source.NY` mapping are implemented and tested, or remove the NYC name-source claim. | Blocked |
| Austin city matching is assumed despite `contractor_city` not being selected. | Include `contractor_city` only in the adapter select, then add a fixture assertion; preserve the existing seven fields and continue omitting address. | Proposed |

## Iteration and safe correction

The initial risk was a stale claim that Austin's contractor fields had been removed. Root's exact current request contradicts that: it returned HTTP 200 with five rows and all seven selected fields. The source must remain enabled; an unfiltered sparse response cannot justify schema removal.

The actionable defect is instead route completeness. `contractor_permits` advertises NYC but cannot select a NYC source, and the Austin parser consumes city/address fields that its request omits. The safe correction is:

1. Do not add NYC to the active permit route until a dedicated public adapter, parser fixture, and `register_source.NY` mapping have been reviewed. If NYC is not being built now, remove its `name_source` entry so the brain matches runtime.
2. Amend the Austin adapter's explicit `$select` to include `contractor_city` only, and add a fixture test that the stored city is non-null when the selected field is present. Continue omitting `contractor_address1`; city is enough for city-level business matching and avoids residential-address ingestion. This does not change role or phone classification.
3. Before a trade-specific campaign uses Austin, gate `contractor_trade` against that campaign's core trade profile and preserve `Permit Contractor` as candidate-only evidence.

## Cost and remaining experiment

The audit was local and the official Austin endpoint is free; `perInputUsd` is 0 for this evidence and `perCleanUsd` remains null. Historical brain rates and the catalog's field-coverage claims have different denominators and are not outcome measurements here.

Next, run a synthetic five-case routing test: matching trade, mismatched trade, generic trade, named permit contractor with shared contact, and named permit contractor without owner evidence. Verify that only trade fit reaches contact verification, and none can receive an owner label from permit fields alone. Separately test NYC only after an official adapter exists.
