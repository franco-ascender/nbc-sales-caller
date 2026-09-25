# Owner Cell App: engineering handoff package (read this first)

Prepared September 21, 2026 by Franco Cappanera (Head of AI, NBC Sales). This package merges two bodies of work into one build:

1. **Anas Daoud's Owner Cell App** (files 05 and 06): a credits based SaaS that wraps a working CLI engine (engine.py) and a routing config (brain.json). Recipes A (scrape), B (name to home to trace) and C (registry with phone). Measured yields from live runs in September 2026. Product shell: wallet, job state machine, sample gate, quality gates, caches, compliance.
2. **The Nalify research program** (files 07 and 08): seven industry modules, about 115,000 words, that map every free public register that names an owner, measure the register phone versus Google Maps phone effect (36.7 percent differ on 682 NPPES records), add new industries and states, add a fourth recipe (D, contrast and buckets), and specify the two things that make the product defensible: the call outcome feedback loop and the compliance ledger.

**Who decides.** Franco Cappanera owns this build day to day. Anas's documents are the starting point, not a constraint: his measured numbers are data (keep them, tagged measured_by anas, until a new run replaces them), and his vendor and design choices are the current defaults. When a better option appears (lower cost per clean cell, higher clean rate, better legal footing, simpler code), the engineering agent measures it, writes up the comparison, and Franco presents it to Anas; once approved it becomes the new default and brain_v2.json is edited. The bake-offs in 03_BUILD_PLAN.md (DataZapp, Telnyx, mobile rate per register) exist for exactly this reason. Everything the research adds is marked as an estimate (n = 0) in brain_v2.json until a sample run replaces it.

**The existing code is the base.** engine.py (in this package) is the working CLI: meter, Outscraper scrape, BatchData verify and skip trace, free name sources, parcel lookup, investors, deliver. Everything is built on top of it, module by module, keeping its rules (estimate before spend, cap before every paid call, any API error stops the run). Refactor it into a package as you go; do not throw it away.

## Files in this package

| File | What it is | Who wrote it | Use it for |
|---|---|---|---|
| 00_START_HERE.md | This file. Project rules, stack, what to build, in what order | Franco | Treat as CLAUDE.md for the repo |
| 01_MERGED_ARCHITECTURE.md | Anas's product plus the research additions, reconciled. Recipes A, B, C, D. Data model deltas. Vendor decisions and open bake-offs | Franco | The design you implement |
| 02_brain_v2.json | brain.json extended: recipe D, 20 new industries, 8 new states, new guardrails, new output columns. Anas's entries untouched and tagged measured_by anas | Franco, from Anas's v1 | Load this instead of v1 once recipe D exists; until then v1 is valid |
| 03_BUILD_PLAN.md | Phased tasks with acceptance criteria, measurement tasks, and what not to build | Franco | Your task list |
| 04_SOURCE_CATALOG.md | Every register, endpoint, dataset id, file name, field, cadence, cost, legal note and tag (VERIFIED, REPORTED, UNKNOWN) from the research, one table per industry group, plus known traps and about 85 open verification requests with the exact request to run | Research | The only place to look up an endpoint. Never invent a URL that is not here |
| 05_ANAS_DEV_HANDOFF.md | Anas's handoff, unchanged | Anas | Product shell, credits, job flow, data model, quality gates, do-not-build list |
| 06_anas_brain_v1.json | Anas's brain.json, unchanged | Anas | Reference and diff |
| 07_RESEARCH_BUILD_SPEC.md | The full research: executive sections plus Appendices A to G (one per industry group) with hypothesis loops, state maps, workflows, stack tables, legal checks | Research | Deep reference when a source or a yield needs context |
| 08_BRIEF_FOR_LEADERSHIP.md | The 33 page brief for Anas: logic, grouping, stack, one diagram per industry | Franco | Orientation; the diagrams are in diagrams/ |
| diagrams/ | PNG and Mermaid source of the logic diagram per industry | Franco | Docs and README |
| engine.py | The working CLI engine (meter, scrape, verify, names, parcel, investors, trace, deliver) | Anas and Franco | The code base you extend |
| 09_CLAUDE_CODE_PROMPT.md | The kickoff prompt and the reporting protocol | Franco | Paste into the first message |

**engine.py is in this package.** Two documents Anas references are not: STATE-COVERAGE-where-each-lane-works.md (parcel endpoints not yet coded) and MASTER-PROMPT (keyword map for routing). Their content is partly reproduced in 05 and 06; ask Franco for the originals if a parcel endpoint is missing.

## Stack (fixed)

Next.js plus TypeScript on Vercel for the UI and API routes. Supabase Postgres for everything persistent (ledger, jobs, caches, names, ledger of provenance). Python workers for the engine (engine.py wrapped as job steps; new steps written in the same style). Outscraper for Google Maps (Anas's key and price, $0.0037 per business; Apify compass/crawler-google-places at $0.004 is the documented alternative if Outscraper fails). BatchData for verify ($0.007 per number: line type, DNC, litigator, reachable) and skip trace ($0.07 per person). FTC National DNC Registry direct subscription (own account, $82 per area code per year, first five free) as the DNC source of record for the 31 day rescrub. Telnyx and DataZapp are experimental only until the Phase 2 bake-off (see 01, section 4).

## Non negotiable rules (from both documents)

- **Never spend money without a cap check.** Every paid call checks the job's remaining credits first. Cap hit: deliver what exists, settle, stop.
- **Any API error stops the job.** No retries with another vendor. Log the body, mark needs_attention. BatchData returns 403 "Insufficient balance" in the body with a 200 status: check the body.
- **Never deliver the same number twice to a user; never deliver a suppressed number to anyone.** Suppression is global and permanent.
- **Manual dialing only. No SMS path, ever. No autodialer.**
- **Dial window 08:00 to 20:00 recipient local time** (Florida's cap; use it everywhere). Time zone on every row; rows without a resolvable time zone are held back.
- **DNC applies to sole proprietors' cells** (Chennette v. Porch.com, 9th Cir. 2022). Strict mode is default. Rescrub every 31 days. Litigator rows dropped in every mode.
- **Every delivered row has a ledger record** (provenance, timestamps, business line evidence, scrub versions). Every dial has an outcome record with a feature snapshot. These two tables are built in Phase 0 because the data they hold cannot be recovered later.
- **Never use** voter files, DMV data, South Carolina or Utah licensee lists, Washington liquor lists, NIPR, manufacturer provider locators, and never dial California small family child care home phones (legal gates, not negotiable). **Default off, revisable with a measurement and Franco's approval:** BatchData property search, Google Maps as the deliverable for attorneys, CPAs or med spas, Apollo, ZoomInfo, TLOxp, Twilio Lookup, Clay, Data Axle (rejected on cost or coverage so far).
- **Verify before asserting.** A source exists only if 04_SOURCE_CATALOG.md tags it VERIFIED or you have hit it yourself and read the payload. UNKNOWN items carry the exact request to run.

## What to build, in one paragraph

Phase 0: credits ledger, job state machine, per job cap, plus the two research tables (row_ledger, dial_outcomes). Phase 1: Lane A worker wrapping outscraper, verify and deliver with the businesses and verified caches, quality gates, coverage table in the UI. Phase 2: Lane C worker on every register that carries a phone (WA, OR, CA, PA, plus the research additions: FL DBPR, FL DFS, IRS PTIN, NY attorneys, FMCSA, PA and NY and TX childcare, TX mini salons, NOLA and Orlando STR), and the three measurement tasks (mobile rate per register, Telnyx pre-gate, DataZapp versus BatchData). Phase 3: recipe D (Maps contrast, four buckets, licensed but invisible) on top of Lane C. Phase 4: Lane B worker (name ingest, parcel matcher, trace) with the research's new name sources (NY salons, NY auto, TX TDI, TABC, Sunbiz officers, NPPES address roster for med spas). Phase 5: Owner Probability Score, daily register diffs, refresh and DNC flag export. Details and acceptance criteria in 03_BUILD_PLAN.md.

## How to read the yields

Two yield systems coexist. Anas's are **clean rate per record entering the paid step** (clean = mobile and not DNC and not litigator), measured, n given. The research's are **cost per verified owner cell** and **owner identification rate**, estimated from register statistics and vendor prices, n = 0 for verified cells (except the NPPES identity measurement, n = 682). The sample gate uses Anas's expected_clean; for research industries the first 20 cell sample sets the number and the JSON is edited. Do not mix the two systems in one comparison.
