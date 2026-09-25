# Med spas: person-first owner candidate review

## Hypothesis

For an independent med spa, start with a public clinician or founder connected to the exact business suite, then seek corroboration from the applicable state entity source. A clinician at the suite is an owner **candidate**, not confirmation. A medical director assigned to several facilities is a supervising clinician, not an owner. Published NPPES phone fields are business-contact candidates only; this review did not determine handset ownership, mobile status, reachability, consent, or DNC status.

## Observed free evidence

On 2026-09-24, a bounded live request to the free CMS NPPES Registry API returned 20 Florida NPI-2 records for `organization_name=*aesthetic*` (limit 20). All 20 had an organization name, Authorized Official first/last name, Authorized Official title, Authorized Official telephone field, and a LOCATION telephone field. Nineteen of 20 AO titles matched the current owner-title expression; none matched its staff-title exclusion expression.

This is a source-field coverage observation, not a med-spa universe measurement. The query selects organizations which have an NPI and match “aesthetic”; it excludes cash-pay businesses without an NPI and can include adjacent aesthetic practices. It also does not establish that an Authorized Official owns the entity or that either published line is direct to that person. No phone values, addresses, or personal records were retained in this dossier.

The historical research remains the appropriate constraint: only 17% of 41 Tampa/Austin storefronts were reported to have an organization NPI, and the reported 35% suite-roster hit is a lower-bound address result. Neither rate was re-measured here, so neither is a current uplift claim.

## Live implementation compared with the research

`src/lib/lead-engine-medspa.ts` implements the useful person-first pieces: NPPES NPI-1 NP/PA/RN roster retrieval inputs; exact house-number, ZIP, and suite-sensitive matching; sole-proprietor and differing mailing-line signals; franchise/telehealth and registered-agent exclusions; and the Tennessee three-or-more-facility medical-director exclusion. `src/services/lead-engine-medspa.service.ts` provides free NPPES orchestration and labels the Texas Comptroller parser as unverified.

The implementation does not implement Florida Sunbiz two-hop member resolution, website/team-page founder extraction, NPPES bulk AO repetition/geography checks, or a verified Texas PIR officer endpoint. Those remain proposed or blocked routes. Most materially, `resolveMedSpaOwnerLive` has no caller outside its declaration, so its evidence and candidates are not connected to job execution or an admin result.

## Failure cases and handling

| Failure case | Current handling | Required interpretation |
|---|---|---|
| Cash-pay spa has no NPI-2 | NPI-2 adapter remains a narrow name path | Never treat a zero NPI result as absence of the business. |
| Shared building, different suite | Suite mismatch rejects a roster match | Missing suite remains weaker evidence, not owner proof. |
| Medical director covers multiple spas | Tennessee graph marks names on 3+ facilities `director_only` | Hold the candidate even if the director has a published practice line. |
| Franchise, telehealth, or registered-agent service | Brand and agent-service blocklists run before candidate output | Exclusion is appropriate for this owner-contact workflow; do not relabel as an owner. |
| NPPES AO is corporate staff or HQ | Title filter only on NPI-2 adapter | Do not deliver AO identity or phone until repetition/geography evidence is added. |
| Texas officer source | HTML parser is fixture-tested and explicitly unverified | Do not claim officer coverage or ownership from this path. |

## One review iteration

The initial implementation hypothesis was that the NPPES NPI-2 name path could yield titled person candidates. The live 20-row field check supports that it yields name/title/contact fields for its selected universe, but not ownership or direct-line truth. The workflow therefore keeps NPI-2 as corroboration and routes missing or ambiguous evidence to hold. The concrete implementation correction is to wire `resolveMedSpaOwnerLive` into the job runner, preserving its candidate evidence and keeping every candidate blocked from delivery until normal line, DNC, and ownership gates exist.

## Remaining experiment

Use a consented, bounded 5–20 independent-spa sample with a public business register/discovery input to measure: exact-suite NPI-1 match coverage; how often non-director candidates are corroborated by an entity officer or explicit founder statement; and how often a published differing line actually reaches the named business contact. Record separate denominators for discovered businesses, candidate identities, corroborated owners, and line outcomes. Any mobile/reachability/DNC measurement requires separately authorized validation; it was not run here.

## Sources and paths

- `handoff/04_SOURCE_CATALOG.md`, Group D: NPPES access/limits, Florida Sunbiz, Tennessee director registry, Texas Comptroller status, and legal/source constraints.
- `handoff/07_RESEARCH_BUILD_SPEC.md`, §5.4: person-first workflow, 17% NPI-2 storefront observation, reported 35% suite-roster lower bound, and director-graph rationale.
- `src/lib/lead-engine-medspa.ts`: match, candidate, franchise, agent, and director logic.
- `src/services/lead-engine-medspa.service.ts`: NPPES roster calls and explicitly unverified Texas adapter.
- `src/lib/lead-engine-registers.ts`: NPI-2 `nppes_medspa` source path and AO title filters.

## Root integration regression check, 2026-09-24

NPPES med-spa admissions now require an explicit owner/leadership title. Clinical-only director/doctor/DDS/DMD titles are held. Earlier 19/20 title matches describe the old broad expression, not the corrected filter. The resolver is still not wired; generic phone gates exist but independent owner proof remains unintegrated.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
