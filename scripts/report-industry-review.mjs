import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const brain=await read('src/data/lead-engine-brain.json');
const reviews=await read('src/data/lead-engine-workflows.json');
const checks=await read('artifacts/lanes/L03/industry-workflows/local-validation.json');
const live=await read('artifacts/lanes/L03/industry-workflows/production-validation.json');
if(checks.some(check=>check.exitCode!==0)) throw Error('Local validation has failures');
const browserLog=await readFile(new URL('artifacts/lanes/L03/industry-workflows/browser.log',root),'utf8');
if(!browserLog.includes('"passed":true'))throw Error('Browser evidence missing');
const inspection=await readFile(new URL('artifacts/lanes/L03/industry-workflows/deployment-inspect.log',root),'utf8');
const deploymentId=inspection.match(/dpl_[A-Za-z0-9]+/)?.[0];
if(!deploymentId||!inspection.includes('Ready'))throw Error('Ready deployment evidence missing');
const esc=value=>String(value).replaceAll('|','/').replaceAll('\n',' ');
const short=value=>esc(value).length>190?esc(value).slice(0,187)+'…':esc(value);
const modes=Object.values(reviews).reduce((out,r)=>({...out,[r.measurement.kind]:(out[r.measurement.kind]??0)+1}),{});
const lines=[
'# Owner Cell: industry workflow review',
'',
'Request: one independent agent per live industry, bounded hypothesis/test/correction loops, source-specific logic and an admin decision-map dashboard. Review date: 2026-09-24. Candidate revision: 1.',
'',
'## Delivery status',
'',
'Published UI and conservative runtime corrections; **partial production readiness**. This is not certification of 44 working, optimized owner-phone pipelines. All 44 live entries have independently assigned reviews, bounded evidence, failure cases, proposed decision branches and a next measurement. New paid phone checks: **0**. New reached-owner outcomes: **0**. Paid lead-data provider spend from this review: **$0**. No purchases, outbound calls, campaigns or migrations were performed.',
'',
'Root: Astra orchestration/integration. Workers: one Terra/medium task per industry, at most three concurrent workers. Source studies distinguish identity fields, business-contact candidates, mobile/active/DNC results and actual owner conversations. Residential/private-phone discovery was not added, executed or optimized. Existing legacy recipe-B code remains a material unresolved boundary and is labelled in the state inspector; proposed holds in worker diagrams are not automatically executable runtime gates.',
'',
'Production review: https://nbc-sales-nbc-sales.vercel.app/lead-engine → **Brain (admin)**. Publication uses the existing project/domain, as permanently authorized in the request. No Git commit exists for this candidate; use the file-hash manifest. Push/merge/tag: NOT EXECUTED.',
'',
`Verified production deployment: ${deploymentId}; Ready. Read-only production browser check: ${live.date}. Build and inspection logs are in artifacts/lanes/L03/industry-workflows/.`,
'',
'## What changed in executable code',
'',
'- Med-spa NPPES admissions no longer treat clinical-only director/doctor/DDS/DMD titles as owner evidence.',
'- TX childcare no longer substitutes an administrator for an unresolved person-named provider.',
'- Pool sourcing no longer treats bare wellness “spa” as pool relevance.',
'- Detailing excludes car-wash-only businesses; collision repair and jewelry now recognize legitimate category synonyms; exotic dealers require exotic/luxury/classic automotive context. These narrow cohorts reject adjacent-only businesses before phone verification.',
'- Structural pest sourcing excludes agricultural/crop-only cases while preserving explicit mixed structural services.',
'- FMCSA name equality no longer turns a corporation, partnership or unknown entity into Sole Proprietor. TABC person labels preserve License Holder evidence rather than claiming restaurant ownership.',
'- NY attorney parsing enforces its declared NY-address scope. The never-Maps guard now covers attorney_ny at quote and final gates.',
'- Owner-name extraction requires explicit Mobile evidence, including in standalone helper use. The runner supplies verification.lineType; missing/null/other types cause no website fetch, paid request or meter call.',
'- Export status no longer invents residential tracing merely because a row used recipe B. A differing register/Maps phone is not called a proven owner line. Ownership stays unconfirmed in contact-status wording.',
'- Admin UI: searchable 44-industry list, branched SVG diagrams with keyboard-selected details, source scopes, measured/fixture evidence, costs, failure cases and iterations. The state inspector runs existing pure quote rules for all 50 states plus DC, distinguishing configured recipes, effective Maps fallbacks, blocked quotes and legacy B paths.',
'- Existing admin authorization remains server enforced. Metadata is served through the protected no-store Brain endpoint; it is not bundled into the public client.',
'',
'Fifteen industry reviews include root integration follow-ups. These are shared corrections, not fifteen newly connected sources. Historical Anas values and routing settings are unchanged; only new workflow_review references were added to brain entries. Packaging records a hash of unchanged routing/measurements.',
'',
'## Rejected or qualified findings',
'',
'An Austin schema-removal claim from one worker did not reproduce: the exact adapter query returned HTTP 200, five rows and all seven selected fields. Its conclusion was corrected, and the working adapter was not disabled. A missing state mapping, a different adapter recipe or an expiry-day predicate is recorded as a review issue; none was blindly converted into a new paid route or a relaxed eligibility rule.',
'',
'Worker “implemented” source tags can identify existing adapter/helper components, not a fully connected owner-evidence pipeline. Proposed DAG branches, absent owner corroboration and unsupported source joins remain explicitly pending. The state inspector is the current quote configuration, not a legal opinion or operational certification.',
'',
'## Evidence by industry',
'',
`Review methods: ${Object.entries(modes).map(([kind,n])=>`${kind}: ${n}`).join('; ')}. Free field samples are not phone verification or representative yield studies. Historical Anas sample dates were not established by this review; the brain version is not a measurement date. Every current measured cost per clean owner contact remains unknown.`,
'',
'All rows below concern **candidates**. The linked dossier/diagram provides source state scopes, contrasts, rejection branches, verification requirements and iteration detail. Mobile, reachable, DNC/TCPA, duplicate/suppression and owner evidence must not be collapsed into one success flag.',
'',
'| Industry | Owner-candidate source | Published business-phone candidate | Current review evidence | Baseline (not newly measured) | Measured cost / clean owner |',
'| --- | --- | --- | --- | --- | --- |',
];
for(const [key,r]of Object.entries(reviews)){
 const b=brain.industries[key];
 const baseline=b.measured_by==='anas'?`${Math.round(b.expected_clean*100)}% configured; historical Anas n=${b.n}, date not established`:b.measured_by==='research_measured_identity_only'?`${Math.round(b.expected_clean*100)}% configured; identity-only n=${b.n}, not phone yield`:`${Math.round(b.expected_clean*100)}% configured estimate, n=${b.n??0}`;
 lines.push(`| [${esc(r.title)}](../../features/industries/${key}.md) | ${short(r.ownerSource)} | ${short(r.phoneSource)} | ${r.measurement.kind}; n=${r.measurement.sampleSize}; ${r.measurement.observedAt}; verified=0 | ${baseline} | Unknown |`);
}
lines.push('', '## Current stack and economics', '',
'Maps finds published business listings; its configured cost is $0.0037/place. BatchData checks supplied numbers; the brain configures $0.007/number. Public register queries used in the reviews were free. Review/name extraction may use Apify and Haiku in legacy runtime, but none was invoked here. These settings are estimates, not current account-specific price confirmations.', '',
'At the configured verification rate, 20 inputs budget $0.14 and 100 budget $0.70 for verification only. Twenty inputs do not promise twenty delivered contacts. Separate scrape/review charges, minimums, retries and true owner outcomes change total unit cost. No pilot amount is approved or spent. Confirm the effective account tariff before requesting an exact spend approval.', '',
'A/C sale price is two $0.10 credits per billed contact; the existing 60% provider cap is $0.12/contact. It limits spend, not guarantees profit or quality. Stop a losing path rather than silently add vendors. No claim of a 15% or other uplift can be supported by this review.', '',
'### Potential additions, in plain terms', '',
'| Addition | What it actually does | Published price / basis | Where it might help | Measured improvement here |',
'| --- | --- | --- | --- | --- |',
'| Telnyx lookup | Classifies an existing number/carrier; does not find an owner or clear DNC | LRN $0.0015/query; MCC/MNC $0.0025/query; CNAM $0.003/query; destination/tax qualifications | Public registers with many non-mobile lines, subject to a measured bake-off | Unknown; no calls made |',
'| Direct FTC Do Not Call access | Supplies the suppression list of people who requested no telemarketing calls | FY2026: first five area codes free, $82/additional area code/year, $22,626 nationwide cap; recheck after September 30 | Audit/version provenance across applicable outreach, not lead discovery | No extra owner phones promised |',
'| Public registry bulk ingestion / published business-contact corroboration | Improves coverage, role matching and repeatable evidence | Existing source access may be free; infrastructure/maintenance cost not quoted | Source-specific contractor, professional, salon and agency records where terms permit | Unmeasured; many integrations still pending |', '',
'Prices checked 2026-09-24: [Telnyx rate card](https://telnyx.com/pricing/number-lookup), [FTC FY2026 notice](https://www.ftc.gov/news-events/news/press-releases/2025/08/telemarketer-fees-access-ftcs-national-do-not-call-registry-increase-2026). [BatchData public pricing](https://batchdata.io/pricing) does not confirm NBC’s effective $0.007 setting. No private-mobile append service is recommended.', '',
'Illustrative economics only: with a $0.0025 precheck plus $0.007 verification, prechecking saves verification cost only below 64.3% of inputs proceeding. At 20% proceeding: $0.0039/input; at 80%: $0.0081/input. These scenarios exclude classification errors and are not measured industry rates.', '',
'## Validation performed on this candidate', '');
for(const check of checks)lines.push(`- ${check.command}: ${check.exitCode===0?'PASS':'FAIL'}; ${check.startedAt}; log in artifacts/lanes/L03/industry-workflows/${check.id}.log.`);
lines.push('','Additional commands: isolated `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3234 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic SUPABASE_SECRET_KEY=synthetic NBC_OPERATOR_EMAIL=operator@example.test node node_modules/next/dist/bin/next build --webpack` (build.log); `L01_REVIEW_BASE_URL=http://127.0.0.1:3117 node tests/lead-engine-workflows-browser.mjs` (browser.log); `node scripts/vercel-project.mjs --check`, `node scripts/vercel-project.mjs --deploy`; `node tests/lead-engine-workflows-live.mjs`. No real credentials were copied into the isolated build.','',`Production read-only validation: ${JSON.stringify(live)}. Isolated browser validation covers all 44 diagrams, keyboard node selection, 390px layout and six access cases (anonymous/invalid/student/coach/suspended/admin). Build/browser evidence is stored alongside the logs. The isolated browser context bypassed CSP only for its loopback synthetic Auth transport; the production review retains the application CSP. Initial browser attempts exposed a fixture mismatch (invalid tokens return the existing 403) and the loopback CSP restriction, both corrected without changing authentication or production CSP. Earlier expected-label fixtures were updated for deliberately corrected roles; initial new discovery fixtures also needed required URL/operating-state fields. Those intermediate failures are not presented as successful runs.`, '',
'## Review steps for Franco', '',
'Screenshots: [production industry list](../../../artifacts/lanes/L03/industry-workflows/production-list.png), [production med-spa detail](../../../artifacts/lanes/L03/industry-workflows/production-med-spa.png), [production mobile](../../../artifacts/lanes/L03/industry-workflows/production-mobile.png), [isolated diagram close-up](../../../artifacts/lanes/L03/industry-workflows/decision-map-desktop.png).', '',
'1. Open the usual production URL, sign in as admin, and open Lead Engine → Brain (admin). You should see 44 industries, not a new project or link.',
'2. Search “med spa” and open it. Select diagram nodes with click or Enter. Read the current source sample, zero verified-phone count and proposed/unwired gates.',
'3. Change the state. Check the configured recipe against the actual quote path and any legacy/blocked notice. Then inspect childcare center or pest control to see the Maps fallback where no register is mapped.',
'4. Inspect detailing, auto body, jewelers, movers/tree/haulers or TX restaurants to read the root-tested corrections and original evidence. Costs per clean owner remain “Not measured”.',
'5. Narrow the browser to phone width. The page should fit; only the diagram scrolls horizontally. Students/coaches have no access to Brain metadata.', '',
'## Remaining work and requested input', '',
'- Independent owner/direct-business-contact corroboration is not an enforced end-to-end pipeline across the 44 industries. Generic verified-mobile status is insufficient. Legacy residential/trace paths were neither executed nor certified by this review.',
'- Wire and test eligible public-business source joins where current routes lack mappings, trade class filters or explicit published contact fields. Existing named sources are not automatically connected.',
'- Run separately approved paid verification on a small, deduplicated, source-labeled public-business cohort, after confirming the account tariff. Then log caller outcomes with owner reached / employee / wrong business / wrong number separately. No outreach was authorized or performed here.',
'- Each proposed source must pass its own terms/scope check; no blanket permission for unknown-state or prohibited-list use. Do not activate a purchase or alternate vendor to make a demo appear complete.',
'- No supported percentage uplift or final cost per owner reached exists yet. A five-row fixture or populated phone field cannot establish convergence or “best possible” quality.', '',
'Suggested next task (not started): implement a consented/public-business pilot for one well-scoped industry, with independent owner-evidence recording and account-verified cost approval. Measure against the current public-listing baseline before expanding.', '',
'## Contracts, schema, and candidate', '',
'GET /api/lead-engine/brain: existing active-admin/operator authentication, no-store; now includes workflowReviews and per-industry effectiveRoutes. 401 anonymous; 403 invalid token/non-admin/suspended; no provider calls or storage mutation in the inspection. No new environment variables, dependencies or migrations. Existing service-role/RLS boundaries unchanged.', '',
'Feature: docs/features/owner-cell-industry-workflows.md. Per-industry handoffs: docs/features/industries/*.md. Source metadata: src/data/industry-workflows/*.json; aggregate: src/data/lead-engine-workflows.json. Root corrections are documented in fifteen dossiers. Historical routing/measurement preservation proof: artifacts/lanes/L03/industry-workflows/brain-preservation.json.', '',
'AInnovate changelog block: 2026-09-24 | Changed / Fixed | Owner Cell industry review | 44 independent reviewed workflows; admin state-aware decision diagrams; conservative industry/role filters and truthful provenance; source evidence and unmeasured economics. Request: one industry agent, hypothesis/test/correction, admin logic dashboard. Global docs not consolidated: API_DOCS should add these protected Brain response fields; architecture/lookup should reference the review bundle and packaging validator; DB_SCHEMA needs no change.', '',
'Technical validation: automated checks and root integration review; no independent final reviewer approval claimed. Franco visual approval: pending. Publication authorized by the user’s permanent deployment instruction. No Git push, merge or tag.', '');
await writeFile(new URL('docs/lanes/reports/OWNER-CELL-INDUSTRIES-2026-09-24.md',root),lines.join('\n'));
const own=['docs/features/owner-cell-industry-workflows.md','src/components/lead-engine/LeadBrain.tsx','src/components/lead-engine/LeadBrain.module.css','src/lib/lead-engine-workflows.ts','src/lib/lead-engine-workflow-routing.ts','src/lib/lead-engine-industries.ts','src/lib/lead-engine-registers.ts','src/lib/lead-engine-gates.ts','src/lib/lead-engine-jobs.ts','src/services/lead-engine-jobs.service.ts','src/services/lead-engine-jobs-http.ts','src/services/lead-engine-reviews.service.ts','src/data/lead-engine-brain.json','src/data/lead-engine-workflows.json'];
for(const key of Object.keys(reviews))own.push(`docs/features/industries/${key}.md`,`src/data/industry-workflows/${key}.json`);
for(const file of ['lead-engine-industry-corrections.test.ts','lead-engine-workflows.test.ts','lead-engine-workflows-browser.mjs','lead-engine-workflows-live.mjs','lead-engine-registers.test.ts','lead-engine-reviews.test.ts','lead-engine-gates-jobs.test.ts','lead-engine-jobs.test.ts','lead-engine-jobs-live.mjs'])own.push('tests/'+file);
for(const file of ['package-industry-workflows.mjs','record-industry-review-corrections.mjs','validate-industry-review.mjs','report-industry-review.mjs'])own.push('scripts/'+file);
const hashes={};for(const path of own.sort())hashes[path]=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
await writeFile(new URL('artifacts/lanes/L03/industry-workflows/candidate-sha256.json',root),JSON.stringify(hashes,null,2)+'\n');
console.log(`Report written; ${Object.keys(reviews).length} industry reviews; ${own.length} candidate file hashes.`);
