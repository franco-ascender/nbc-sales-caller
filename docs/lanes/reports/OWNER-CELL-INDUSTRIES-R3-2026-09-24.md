# Owner Cell — tool diagrams, revision 3

> Current state-list correction: [revision 4](OWNER-CELL-INDUSTRIES-R4-2026-09-24.md). Evidence below belongs to revision 3.

Date: 2026-09-24 America/New_York. Published and verified at 2026-09-25 03:40:39 UTC.
Franco visual acceptance: pending. Deployment: `dpl_GuAFxNUji37fggPks8iWfKHx6tax` (Ready).

## Correction requested

Revision 2 removed the diagram and substituted opaque prose. Revision 3 restores connected cards, arrows, a phone-present decision, labelled YES/NO branches and a merge. Every card names its tool, input and output; expanding it explains the operation. Desktop branches sit side by side; mobile branches stack with a visible connecting line.

The 35 niches/state variants and all 44 source reviews remain. Method B is now named “Start with licensed people, then resolve the contact”, with its actual dependencies visible rather than a single legacy warning. The real-estate/Illinois case specifically exposes:

- Illinois IDFPR import covers managing brokers and stores no phone field.
- NBC/Supabase source filtering precedes contact handling.
- A record with an existing number uses BatchData phone verification.
- Missing-phone records use the older, unvalidated dependency in existing code; its Cook County coverage and BatchData dependency are visible at an architectural level. This revision adds no residential lookup capability or execution.
- NBC/Supabase delivery rules and result storage follow candidate results.

Other paths show Apify Google Maps discovery or comparison where the runner uses it. Conditional owner-name extraction for A/D names the website reader, Apify reviews and Anthropic Haiku. Telnyx is explicitly not wired into the current runner. Tool references do not certify credentials, connectivity or measured results. No provider calls, purchases, jobs or migrations were started.

## Files and contract

- New `src/lib/lead-engine-tool-flow.ts`: source labels and typed diagram model based on effective route metadata.
- New `src/components/lead-engine/LeadToolDiagram.tsx` and `.module.css`: responsive branching diagram and accessible native detail disclosure.
- `LeadBrain.tsx`: installs diagrams and concrete route explanations; retains niche/state organization and audit evidence.
- `lead-engine-niches.ts`: readable method names and optional enrichment dependency metadata type.
- `lead-engine-workflow-routing.ts`: adds quote-derived enrichmentSource, enrichmentCounty and registerAddressUsed to the protected route-inspection response. Source labels only; no person/address records or secrets.
- `tests/lead-engine-tool-flow.test.ts`: provider topology, exact Illinois example, blocked routes and input/output coverage.
- Browser/live review scripts updated to the new diagrams; feature updated before code.

Existing quote/routing decisions, source adapters, budgets, auth and database schema are unchanged. GET /api/lead-engine/brain remains active-admin/operator-only and no-store. Global API_DOCS consolidation should record the three additional inspection metadata fields; architecture/lookup should reference lead-engine-tool-flow and LeadToolDiagram. DB_SCHEMA has no change. Git push/merge/tag: not executed.

## Evidence on this revision

Artifacts: `artifacts/lanes/L03/industry-workflows-r3/`.

- `node --experimental-strip-types --test tests/lead-engine-tool-flow.test.ts tests/lead-engine-niches.test.ts tests/lead-engine-workflows.test.ts`: 13 passed (`unit.log`).
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed during implementation. Isolated and Vercel final builds also passed strict type checking.
- Isolated `next build --webpack` with synthetic loopback Supabase configuration: passed (`build.log`). No real credentials copied into that build.
- `L01_REVIEW_BASE_URL=http://127.0.0.1:3117 node tests/lead-engine-workflows-browser.mjs`: all 35 niche diagrams, 44 preserved reviews, six access cases, state switching, keyboard disclosure, Illinois source/provider assertions and 390px layout passed (`browser.log`). Synthetic loopback Auth requires fixture-only CSP bypass; production CSP is unchanged.
- First browser run stopped on an obsolete revision-2 copy assertion; updated to the new fallback explanation and reran successfully. No app defect was hidden by changing authorization expectations.
- `node scripts/vercel-project.mjs --check`, `--deploy`, and `--check nbc-sales-8u6itc80w-nbc-sales.vercel.app`: existing project, Ready (`deploy.log`, `deployment-inspect.log`).
- `node tests/lead-engine-workflows-live.mjs`: normal production domain, real admin sign-in, anonymous 401/admin 200, 35 niches/44 reviews, Minnesota source and Illinois diagram assertions, 390px fit, no browser exceptions. Zero paid-provider calls/job mutations (`production-validation.json`).

Whole historical suites, Python, database and paid provider tests were not rerun for this presentation-only revision. Diagram branches describe code paths, not successful phone outcomes. Screenshots hide account header only while capturing, without modifying application CSS/security.

## Review

Open https://nbc-sales-nbc-sales.vercel.app/lead-engine → Brain (admin) → Real estate agents → Illinois. Follow the arrows through the tool cards and YES/NO branches. Then inspect Car detailing and Contractors/Minnesota to see Apify and comparison paths. Expand “What happens here?” with keyboard or pointer.

[Production Illinois diagram](../../../artifacts/lanes/L03/industry-workflows-r3/production-illinois-diagram.png) · [Mobile Illinois diagram](../../../artifacts/lanes/L03/industry-workflows-r3/illinois-diagram-mobile.png).

Candidate hashes: `artifacts/lanes/L03/industry-workflows-r3/candidate-sha256.json`. No independent final review or Franco approval claimed.

AInnovate changelog: 2026-09-24 | Changed | Owner Cell Brain | Restore tool-labelled branching diagrams with visible inputs/outputs; explain Illinois missing-phone source and conditional provider paths; preserve state/niche taxonomy. Request: Franco's rejection of missing diagrams and unnamed tools.
