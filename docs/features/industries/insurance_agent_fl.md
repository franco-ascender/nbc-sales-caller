# Florida insurance agents — licensee identity, agency ownership, and business-phone separation

## Hypothesis

Florida DFS’s public individual-license CSV can establish that a named person holds a currently `VALID` Florida insurance license and can provide a published business phone and address. It does not establish that the person owns an agency, that the listed number reaches that person, or that the number is a mobile. An individual licensee must remain a licensee candidate until independent agency-role evidence supports ownership.

The catalog identifies the individual file as a free public source and says its phone is person-level in the source record. That describes the field placement, not handset ownership. The same catalog warns that phones repeated on more than three rows are agency lines. The Business and active-appointment files are listed but their needed owner/DRLP columns are UNKNOWN and no runtime adapter reads them.

## Bounded five-case fixture and code audit

On 2026-09-24, a five-case local parser audit called `flDfsRecord` only. It made no source, Maps, vendor, phone-lookup, residential, or credential request and retained no contact values. The cases were a valid General Lines row, a valid Adjuster row, a non-VALID row, a malformed entity-name row, and a second valid license class for the first licensee with the same business phone.

| Case | Observed parser behavior | Meaning |
| --- | --- | --- |
| Valid General Lines licensee | Kept with title, business label, and business phone. | Licensee and published business contact only. |
| Valid Adjuster - All Lines licensee | Also kept. | The current adapter does not narrow to a producer/agency cohort. |
| Non-VALID license | Skipped as `status_not_valid`. | Current-status gate works. |
| Entity-shaped name | Skipped as `not_a_person`. | A business entity is not promoted to a person candidate. |
| Second valid class, same license/person/phone | Kept at snapshot level; `dedupeNames` removes the repeated person source ID. | Deduplication is by licensee, not an agency-owner relationship or a phone-frequency check. |

This was a fixture/code audit, not a source-coverage study. Sample n=5; verified phones=0. It measures no mobile status, live reachability, DNC result, ownership, agency relationship, or delivery outcome.

## Live runtime and material defect

`insurance_agent_fl` selects recipe C in `src/data/lead-engine-brain.json`, so the job quotes a register-to-verification path. `flDfsIndividual`, however, declares recipe D, and the source catalog’s recipe hint is D: compare the register number against a Maps business contact and frequency before verification. Recipe C skips that contrast, even though shared agency office lines are the stated dominant failure case.

The brain note also asserts that appointment counts of three or more carriers identify an independent agency owner, and that a single captive appointment identifies a captive owner-operator. Neither appointment file is mapped to `fl_dfs_individual`, and `flDfsRecord` reads no appointment fields, business-file row, owner role, agent-in-charge role, DRLP role, or agency relationship. That statement is not genuine current runtime metadata. A carrier count is not independent role proof in any event: it may describe an employee producer, and one carrier does not prove ownership.

The existing individual parser further accepts every `VALID` person license type, including Adjuster - All Lines. It therefore does not implement the buyer/cohort selection implied by an insurance-agent or independent-agency workflow.

## Required branches

1. Admit the documented public FL DFS individual file only when the license status is `VALID` and the name is a person.
2. Reject or hold non-producer license types such as adjusters unless the requested cohort explicitly includes them.
3. Retain the individual as `FL DFS licensee`, never as agency owner. Keep the listed number as `published business phone` only.
4. Before any paid verification, run the recipe-D shared-phone frequency and credible agency/Maps comparison. A repeated number, equal agency/Maps number, or office line is a business-contact branch, not a direct-licensee-phone branch.
5. Owner confirmation requires an independent, implemented role edge: a verified agency business row that explicitly identifies the same person as owner, principal, agent in charge, or DRLP. The current FL Business-file columns are UNKNOWN, so this branch must hold pending source-schema validation; name, address, appointment count, carrier count, or a business phone cannot substitute.
6. Only after independent owner-role evidence and the existing mobile, live, DNC, suppression, and dedupe gates may the workflow deliver. No such outcome was measured here.

## Failure cases and correction

| Failure | Safe correction | Status |
| --- | --- | --- |
| Recipe C verifies a register phone without the required agency-line contrast. | Change the live `insurance_agent_fl` recipe to D, consistent with `flDfsIndividual` and the catalog; add a synthetic quote/bucket regression before integration. | Shared runtime correction needed |
| Licensee is represented as agency owner. | Remove the appointment/carrier ownership claim from live metadata. Preserve role as `FL DFS licensee` until a distinct, explicit agency role is ingested and matched. | Shared metadata correction needed |
| Appointment count is treated as proof of independence or ownership. | Do not use carrier count as ownership proof. Keep it unavailable until an appointment source is actually ingested, then use it only as a cohort signal under a separately validated model. | Blocked |
| Agency office phone is treated as a direct licensee mobile. | Apply recipe-D frequency and Maps comparison before verification; preserve business-line evidence and hold shared/equal lines for owner-role review. | Shared runtime correction needed |
| All valid DFS license types enter an insurance-agent pipeline. | Add an explicit approved producer-license allowlist or hold non-producer classes. The current adapter accepts Adjuster - All Lines. | Shared runtime correction needed |

## Sources and remaining measurement

| Source | Evidence and use | Status |
| --- | --- | --- |
| FL DFS individual bulk CSV | VERIFIED in catalog and implemented as `fl_dfs_individual`; active individual license, business phone/email/address fields. Reference: `handoff/04_SOURCE_CATALOG.md`, Group F row “FL DFS Licensee Search bulk downloads”; `src/lib/lead-engine-registers.ts`. | Implemented |
| FL DFS business and active-appointment files | VERIFIED as listed files, but the relevant business-owner/agent-in-charge/DRLP fields are UNKNOWN and no adapter uses them. Reference: same catalog row; `handoff/07_RESEARCH_BUILD_SPEC.md` open question 1. | Blocked |
| FL insurance route metadata | VERIFIED local configuration: recipe C, `fl_dfs_individual`, and an unimplemented appointment-count owner claim. Reference: `src/data/lead-engine-brain.json`. | Needs correction |
| Recipe-D buckets | VERIFIED runtime provides Maps/phone-frequency contrast for register phones, but it is not selected by this brain entry. Reference: `src/lib/lead-engine-buckets.ts`. | Implemented but unused here |

The next safe measurement is five synthetic job/bucket cases: exclusive register phone with credible agency match; repeated agency phone; register phone equal to Maps phone; valid adjuster; and a licensee with an explicit, independently ingested agency-owner role. It should prove that only the final case can receive owner-candidate provenance, while every phone remains unconfirmed until normal contact gates pass. A later authorized aggregate public-source sample must record separate denominators for valid individual licensees, producer-eligible licensees, unique business phones, shared agency phones, independent explicit agency-role matches, mobile/live/DNC-cleared contacts, and deliveries. Cost per clean delivered owner contact remains null.
