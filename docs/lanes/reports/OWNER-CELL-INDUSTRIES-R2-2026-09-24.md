# Owner Cell — niche-first workflow guide, revision 2

> Current UI: [revision 3, tool diagrams](OWNER-CELL-INDUSTRIES-R3-2026-09-24.md). Historical evidence below is preserved.

Date: 2026-09-24 America/New_York (production check 2026-09-25 03:26 UTC).
Status: published and browser-verified. Franco visual acceptance: pending.

## Request and result

Franco rejected the technical diagrams, unexplained recipes and state-named industries. Brain now starts with **35 business niches**, retaining the 44 original review records as state variants and cross-niche research. Opening a niche shows a persistent state selector, the actual selected method in plain language, why the current route uses it, its source, scope limitations and a vertical numbered journey. Sideways SVG diagrams are removed from the main experience. The original decision nodes, branches, historical benchmarks and experimental evidence remain in collapsed audit details.

Examples:

- Contractors contains Florida and Minnesota variants, the WA/OR/CA register variant and Austin permits. Austin coverage is explicitly city-only; the existing Texas quote currently falls back to listings because its name-source mapping is incomplete.
- Law firms and auto repair contain their New York variants. Insurance agencies contain Florida/Texas variants.
- Salons/barbershops contain their NY/FL variants. Salon suites remain a distinct business type, with Texas coverage research inside the niche.
- Pennsylvania licensee research and the healthcare phone-comparison study are supporting research, not business niches.
- New Orleans/Orlando rental sources and liquor-licensed restaurant coverage have visible scope limitations.

The explanation separates niche-specific reasoning from current execution: using Maps because a register path is not connected is disclosed as a fallback, not claimed as the best-performing strategy. Method comparisons explain what an alternative would add or what is missing. Legacy identity enrichment remains explicitly unvalidated; no new residential lookup capability was added.

## Boundaries and contracts

Presentation changes only to taxonomy and route explanations. Existing job identifiers, routing rules, historical rates, verification, budgets, source adapters and authorization are unchanged. Selecting a niche/state inspects configuration; it does not create a job or reroute a saved job.

GET /api/lead-engine/brain retains its existing protection and no-store response. Each effectiveRoutes entry now also includes `reason`, `explanation` and `blockers`, derived from the existing quote result. Unauthenticated: 401; invalid token/non-admin/suspended: 403; configured active admin: 200. No database or environment changes, new dependencies, provider calls or migrations. Paid-provider spend: $0.

## Changed files

- `src/lib/lead-engine-niches.ts`: presentation catalog, state-specific review selection, US state names, method comparisons and readable journey steps.
- `src/lib/lead-engine-workflow-routing.ts`: explanations of selected routes, fallback reasons and exact quote blockers.
- `src/components/lead-engine/LeadBrain.tsx` and `.module.css`: searchable niche catalog, state selector, vertical journey and progressively disclosed audit evidence.
- `tests/lead-engine-niches.test.ts`: grouping coverage, state variants, scope, route explanation and state-name regressions.
- `tests/lead-engine-workflows-browser.mjs` and `tests/lead-engine-workflows-live.mjs`: current UI checks; revision-2 artifacts kept separately.
- `docs/features/owner-cell-industry-workflows.md`: revision-2 contract before implementation.
- Revision-1 report now links here without rewriting its historical evidence.

Candidate: production deployment `dpl_4rAaiUkFosDZKDHLJqA82aASCohQ`. No Git commit or push. File hashes: `artifacts/lanes/L03/industry-workflows-r2/candidate-sha256.json`.

## Validation actually performed

- `npm test`: 412 passed before the additional state-name regression. Log: `unit.log`.
- `node --experimental-strip-types --test tests/lead-engine-niches.test.ts tests/lead-engine-workflows.test.ts`: final affected set, 10 passed. Log: `niches.log`.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed. Log: `typescript.log`.
- Isolated production build with synthetic loopback Supabase variables and `next build --webpack`: passed. Final deployed source also passed Vercel production build. Log: `build.log`, `deploy.log`.
- `L01_REVIEW_BASE_URL=http://127.0.0.1:3117 node tests/lead-engine-workflows-browser.mjs`: all 35 niche views, preservation of 44 reviews, six access cases, state changes FL/MN/WA/TX, keyboard audit access, desktop fit and 390px mobile fit passed. Local Auth fixture bypasses CSP only for its loopback transport; production CSP is unchanged.
- `node scripts/vercel-project.mjs --check`, `--deploy`, and `--check nbc-sales-9ha5d1w8m-nbc-sales.vercel.app`: Ready in the existing project.
- `node tests/lead-engine-workflows-live.mjs`: normal production domain, real admin sign-in, anonymous 401/admin 200, 35 niches/44 records, Minnesota contractor source and mobile overflow check passed. No jobs or paid requests triggered. Account header masked in production captures.

The visual check caught US state abbreviations being incorrectly interpreted as country codes by Intl.DisplayNames; explicit US state names and a regression test fixed it before publication. Screenshot capture now requests reduced motion; viewport bounds are asserted. Vercel's unpinned npx lookup initially requested an uncached CLI version. Reused already installed cached Vercel 60.0.0 via local node_modules symlinks; no package manifest/lock or deployment wrapper changed.

Python, provider integration and database tests were not rerun: this revision changes none of those implementations. No new owner-reach or cost-effectiveness result is claimed.

## Review on the normal link

1. Open https://nbc-sales-nbc-sales.vercel.app/lead-engine → Brain (admin).
2. Search Contractors. One niche appears; no separate Florida/Minnesota niche cards.
3. Select Minnesota, Florida, then Washington. The source and method change within Contractors. Select Texas to see the Austin scope warning and current fallback reason.
4. Read the numbered journey without horizontal scrolling. Open Compare the four methods to understand the alternatives.
5. Open Evidence & technical details for original records and historical benchmarks. Return to the catalog; the selected state is retained.

Screenshots: [desktop viewport](../../../artifacts/lanes/L03/industry-workflows-r2/contractors-viewport.png), [production Contractors](../../../artifacts/lanes/L03/industry-workflows-r2/production-contractors.png), [mobile approach](../../../artifacts/lanes/L03/industry-workflows-r2/approach-mobile.png), [mobile journey](../../../artifacts/lanes/L03/industry-workflows-r2/journey-mobile.png).

## AInnovate consolidation

2026-09-24 | Changed | Owner Cell Brain | Organize 44 technical/source reviews into 35 niches with state variants; explain actual quote routing; replace horizontal diagrams with readable journeys; retain technical evidence on demand. Request: Franco's correction of diagram readability and industry/state hierarchy.

Global docs consolidation remains pending: API_DOCS should describe new effectiveRoutes reason/explanation/blockers fields; architecture/lookup should reference lead-engine-niches.ts as presentation-only taxonomy. DB_SCHEMA unchanged. No independent reviewer approval claimed. Suggested next task: review the sourcing explanations with Franco before any additional source integration.
