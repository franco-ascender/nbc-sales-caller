# Industry workflow review

Request: independent industry hypotheses, bounded free experiments, failure analysis, implemented corrections and admin-only diagrams for every live brain entry. Started 2026-09-24.

## Scope and evidence

Each industry receives an independent agent assignment. Three workers may run concurrently. The root integrates their results and reviews the shared runtime. Paid discovery, verification, model calls and appends are not authorized. An endpoint sample measures identity/contact-field coverage only, never mobile, reachable, DNC clearance or ownership of a handset. Historical Anas benchmarks remain unchanged, including their denominators. No uplift or cost per delivered owner contact is asserted without observations.

Work concerns contacts explicitly published for business use. Do not compile residential addresses or use property matching to uncover personal/unpublished mobile numbers. A person named in a license, clinician roster or LLC is a candidate, not automatically an owner. A different telephone is not automatically a direct owner contact.

## Delivery

- One English dossier at `docs/features/industries/<key>.md`, with hypothesis, counterexamples, iterations, exact observations and outstanding measurements.
- One structured review at `src/data/industry-workflows/<key>.json`, served only through the existing admin-protected brain endpoint. No private rows or phone values in reports or browser metadata.
- Brain references these reviews via new metadata only. Existing historical rates and routing are not rewritten by a documentation update.
- Admin UI lists industries first. Branch labels are read in the selected-step detail so long conditions do not overlap diagram connectors. Opening one displays a branched diagram plus state/source coverage, filters, tests, denominators, cost basis, and remaining dependencies.
- The state inspector runs the existing pure quote rules for all 50 states and DC, displaying the effective fallback/blocked route separately from the configured recipe. Recipe B is identified as legacy and outside this public-contact review; a quoted path is not a verified or certified workflow.
- Shared runtime changes require root review, a regression test for the actual failure, and no additional paid calls.

## Review contract

JSON fields: `industry`, `title`, `hypothesis`, `ownerSource`, `phoneSource`, `workflow` (array of `{id,label,detail,kind}` where kind is source/filter/decision/verify/hold/deliver), `edges` (array of `{from,to,label}`), `failures` (array of `{risk,mitigation,status}`), `sources` (array of `{label,scope,evidence,reference,status}`; evidence is VERIFIED/REPORTED/UNKNOWN and status is implemented/proposed/blocked), `iterations` (array of `{hypothesis,test,observed,change}`), `measurement` (`kind`: free_source_sample/fixture/code_audit, `sampleSize`: integer, `observedAt`: ISO date, `result`: string, `verifiedPhones`: 0), `cost` (`basis`, `perInputUsd`: number or null, `perCleanUsd`: null, `note`), `implementation` (`status`: reviewed/partial/blocked, `summary`, `runtimeFiles`: string[]), `nextMeasurement`.

## Validation and publication

Export provenance correction: recipe B can contain a published register phone that never passed through tracing. Its status must not claim it was traced to an owner's home. Status labels use row evidence and keep ownership unconfirmed; different Maps/register numbers likewise do not prove a direct owner line. This changes truthful export wording, not the stable column contract or a phone's compliance result.

FMCSA role correction: officer/legal-name equality alone must not label a corporation or unknown entity a sole proprietor; require the published entity type INDIVIDUAL. Pest-control scope correction: agricultural/crop-pest-only listings do not establish a structural/residential pest service. Preserve mixed businesses only when there is explicit structural/residential evidence. Both corrections require synthetic positive/negative fixtures before integration.

NY attorney parsing must enforce the adapter's declared NY-address scope as well as its request query, so cached/malformed inputs cannot bypass it. A Texas liquor-license holder is retained as License Holder evidence, not promoted to restaurant Owner by the adapter label.

Root integration corrections under review: reject clinical-only NPPES titles as owner proof; stop promoting childcare administrators to owner candidates; remove bare wellness-spa relevance from pool sourcing; reject disconnected workflow diagrams. These are conservative classification changes, not new sources or paid pipelines. Reproduce reported source failures with the adapter's exact query before disabling a working source. The Austin query returned HTTP 200 and five rows on root reproduction, contradicting an earlier worker's unfiltered sample; retain both observations and correct the conclusion.

Owner-name extraction must receive the explicit `verification.lineType` stored on delivered job rows. Missing evidence must not default to Mobile. The runner already queries delivered rows, but the helper can be reused independently and must fail closed before website/review requests. Extend the existing never-Maps rule to the `attorney_ny` alias; it belongs to the same prohibited-deliverable profession, including fallback quotes.

Fixture reviews found missing relevance profiles for collision repair, jewelry and exotic dealers. Add dedicated aliases and core phrases; for these narrow cohorts and car detailing require a core match before paid verification. Watch-only/pawn shops, generic used-car dealers, unrelated auto repair and car-wash-only businesses must not be silently widened into the requested cohort. Preserve all historical brain rates; test true positives and counterexamples through the discovery parser.

Validate exact industry coverage, graph references, nullable measured cost, protected historical brain fields, and no paid invocation. Exercise the existing role guard and the new UI with synthetic data before production. Deploy with the official wrapper, then read-only review on the normal production domain. One consolidated final report will distinguish implemented behavior, proposed routes, free observations, and paid measurements still awaiting approval.

## Economics and measurements, checked 2026-09-24

The live brain configures Maps at $0.0037/input and BatchData verification at $0.007/number. These are planning inputs, not independently confirmed account tariffs or a measured cost per owner reached. Twenty verification inputs would budget $0.14 at that configured rate, excluding all other steps; no such spend is authorized or executed. A/C sell at two $0.10 credits with a configured 60% vendor-spend cap, or $0.12 per billed contact. Caps are limits, not expected spend or guarantees of profit.

[Telnyx's public rate card](https://telnyx.com/pricing/number-lookup) lists LRN $0.0015/query, MCC/MNC $0.0025/query and CNAM $0.003/query, with destination/tax qualifications. The type of query required for our carrier test must be confirmed before requesting an exact spending approval. This would classify an already supplied business number; it does not discover a missing owner or verify ownership/DNC. No uplift is measured.

Illustrative break-even only: with a $0.0025 precheck and $0.007 verification, prechecking saves verification spend only if fewer than 64.3% of inputs proceed to verification (`0.0025 + mobile_fraction * 0.007 < 0.007`). At 20% proceeding it costs $0.0039/input; at 80%, $0.0081/input. These are scenarios, not measured industry mobile rates. Errors in preclassification and lost good contacts must be evaluated too.

[FTC FY2026 notice](https://www.ftc.gov/news-events/news/press-releases/2025/08/telemarketer-fees-access-ftcs-national-do-not-call-registry-increase-2026) lists the first five area codes free and $82/additional area code/year, nationwide cap $22,626. This supplies a suppression list of people requesting no telemarketing calls, not more leads or an owner-identity service. FY2026 ends September 30, 2026; recheck the applicable annual rate before purchase. State-list requirements and allowed use still need source-specific handling. No subscription was created.

[BatchData's public pricing page](https://batchdata.io/pricing) does not establish this account's negotiated verification rate. Do not represent the configured $0.007 as a current vendor quote. The experiment backlog must separate discovery, unique businesses, published contacts, mobile/active/DNC outcomes, independently supported owners, and actual owner conversations, with spend recorded at each step. No private-mobile append vendor is recommended by this review.

## Candidate evidence

All 44 assignments are complete. Current local validation: 408 JavaScript/TypeScript tests, 33 Python tests, strict TypeScript check, isolated production build, and all 44 browser diagrams with keyboard selection and 390px overflow checks. Six API access cases preserve the existing contract: anonymous 401; invalid/student/coach/suspended 403; active configured admin 200. Browser fixture bypasses CSP only for its synthetic loopback Auth service; production retains CSP. Final live result, deployment evidence, candidate hashes and industry breakdown are consolidated in `docs/lanes/reports/OWNER-CELL-INDUSTRIES-2026-09-24.md`.

## Revision 2 — niche-first explanation (2026-09-24)

Franco rejected the technical diagrams and state-named industries. Replace the main Brain experience with a niche catalog, a persistent state selector, a plain-language explanation of why the current route is selected, and a numbered vertical journey with visible rejection conditions. No sideways diagram is required to understand a route. Keep original reviews, benchmarks and node/edge evidence inside collapsed audit details.

Group contractor registry/Florida/Minnesota/permit variants under Contractors; attorneys and auto repair each absorb their NY variant; insurance agencies absorb FL/TX; salons/barbers absorb NY/FL while salon suites remain a distinct business type. PA licensees and the healthcare phone-comparison study are cross-niche source research, not industries. Preserve all 44 original records and historical measurements. State selection chooses a review/configuration variant for inspection only; it neither rewrites job routing nor starts a job. Explicitly disclose city-only coverage (Austin, New Orleans, Orlando) and narrow source coverage (e.g. liquor-licensed restaurants).

Route explanations derive their selected method, fallback and blockers from the existing quote function. Extend protected metadata with reason codes and quoted blocker text. Show both a niche-specific sourcing rationale and why the current configuration uses this method; do not claim the method is empirically optimal. Method names precede internal A/B/C/D identifiers. Legacy identity enrichment is marked unvalidated and receives no new sourcing functionality. No providers, prices, auth, storage or routing rules change.

Validation: exact coverage of old review IDs, unique niche membership, FL/MN/WA contractor selection, NY attorney/auto and FL/TX insurance selection, fallback/blocked explanations and city scope. Browser checks every niche, state switching, keyboard access to audit details, no horizontal scrolling at 390px and unchanged protected API access. Publish and check the existing production domain. Record revision-2 evidence separately from revision 1.

Revision-2 delivery: 35 niches preserve 44 original reviews. Local niche/state/browser checks passed; production verified on the usual domain at 2026-09-25 03:26 UTC. See `docs/lanes/reports/OWNER-CELL-INDUSTRIES-R2-2026-09-24.md` for commands, screenshots, deployment and limits.

## Revision 3 — visible tools and branching diagrams (2026-09-25)

Franco rejected the numbered prose and opaque "Legacy identity lookup" label. Restore an actual connected diagram, fitted to the available width, with named tools, visible inputs/outputs, labelled yes/no branches and an inspectable explanation per node. A/B/C/D remain secondary identifiers. Keep niche/state grouping from revision 2.

Read the executable runner before describing it: A uses Apify Maps discovery, NBC filters, BatchData phone verification and NBC/Supabase settlement. C reads imported registry rows with phones. D adds Apify listing comparison and NBC bucketing. B has distinct existing-phone and missing-phone branches; describe its existing enrichment dependency at a high architectural level, visibly unvalidated, without adding or exercising residential lookup functionality. Source name, existing enrichment dependency label and county scope are quote-derived metadata. Illinois IDFPR importer specifically stores no phone and covers CPAs/managing brokers; do not imply all realtors or statewide enrichment coverage.

Show conditional A/D owner-name extraction after eligible delivery: website reader, Apify reviews and Anthropic Haiku, with absence/failure retaining an empty owner name. Telnyx is not wired into these paths. Tools shown as referenced by code are not claimed to have live credentials, successful connections or measured outcomes. No keys, provider requests, prices, paid actions, runtime routing or auth changes.

Use semantic HTML cards with CSS/SVG arrow connectors, a genuine branch and merge, and responsive stacking at 390px. Never truncate the blocked/B case to one warning. Acceptance includes the exact real-estate/Illinois screenshot scenario, all methods, full tool names, input/output labels, visible branch conditions and unchanged 35-niche/44-review coverage. Publish on the existing production domain and preserve revision-3 evidence separately.

Revision-3 production evidence: Ready deployment `dpl_GuAFxNUji37fggPks8iWfKHx6tax`; exact Illinois tool diagram and mobile verified. See `docs/lanes/reports/OWNER-CELL-INDUSTRIES-R3-2026-09-24.md`.

## Revision 4 — every US state visible in every niche

Franco correctly identified that the sidebar showed only states with mapped register variants. Replace that subset with all 50 states plus DC for every niche. Keep the existing national selector and diagrams synchronized with state-list clicks. Add state-name/code search, explicit total/match counts, a bounded scrollable list and short truthful status labels (configured source, listings fallback, existing unvalidated path, blocked, or unresolved). Empty search results must be recoverable. Do not hide blocked states or imply that listing a state connects a source.

Read-only audit: the existing city plan already covers all 51 jurisdictions. Inspecting 35 niches × 51 jurisdictions yields 1,785 routes: 140 blocked, 39 unvalidated legacy, 734 fallback, 872 other configured. These are configuration categories, not tested phone outcomes. No new source integration, paid call, route change, authorization change or database mutation is needed for this correction.

Validate 51 state buttons per niche, search by code/full name, recovery from no matches, selection of previously absent Alaska and Wyoming, blocked-state visibility, and mobile layout. Preserve source/city coverage warnings and all original reviews. Publish to the existing production URL and record revision-4 evidence independently.

Revision-4 delivery: 16 unit tests, strict TypeScript, isolated build and 35 × 51 browser coverage passed. Production login, Alaska/Wyoming selection, state search and mobile verified at 2026-09-25 03:59:51 UTC on Ready deployment `dpl_2asysZmxbkCbTDuqvc28gN2QNjLx`. Full handoff: `docs/lanes/reports/OWNER-CELL-INDUSTRIES-R4-2026-09-24.md`. No paid provider runs or job mutations.
