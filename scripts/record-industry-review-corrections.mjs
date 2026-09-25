// Reconcile independent observations with root-tested changes without replacing their evidence.
import { readFile, writeFile } from 'node:fs/promises';
const corrections = {
  attorney_ny: 'The NY attorney parser now enforces state=NY itself and holds non-NY or missing-address-state rows, matching the declared adapter query scope. The never-Maps guard and ownership-unconfirmed export wording also apply.',
  restaurant_tx: 'The TABC adapter now labels the person License Holder rather than Owner. That does not establish restaurant ownership or a direct handset; a separately published business-contact route is still pending.',
  movers_tree_haulers: 'FMCSA now requires business_org_desc=INDIVIDUAL as well as legal/officer-name equality before setting Sole Proprietor. Corporations, partnerships and missing entity types remain role candidates. Independent owner proof and service-specific fleet filtering are still pending.',
  pest_control: 'Crop/agricultural-only pest listings now fail relevance. Explicit residential/structural/termite/exterminator evidence preserves mixed businesses. Dedicated state pesticide-business adapters remain unimplemented.',
  med_spa: 'NPPES med-spa admissions now require an explicit owner/leadership title. Clinical-only director/doctor/DDS/DMD titles are held. Earlier 19/20 title matches describe the old broad expression, not the corrected filter. The resolver is still not wired; generic phone gates exist but independent owner proof remains unintegrated.',
  childcare_home: 'TX no longer substitutes administrator/director for an unresolved provider name. It holds the row with owner_identity_unresolved. Existing residential payload retention is not expanded and remains a separate limitation.',
  pool: 'Bare spa was removed from pool relevance. Wellness-only examples now fail while actual pool maintenance/construction still pass. Separate builder/service routing is still proposed.',
  painting: 'Owner-name extraction now requires explicit Mobile evidence; undefined/null/Landline/VoIP inputs trigger no website fetch, meter or provider call. The runner reads verification.lineType, not a nonexistent job-row line_type column. It already selects delivered rows; the old omission was a helper-evidence default, not proof that production called unverified phones.',
  car_detailing: 'Car-wash-only listings no longer qualify as core detailing. The parser requires a core match for this narrow cohort; detailing, ceramic coating and paint correction remain eligible.',
  auto_body: 'A dedicated collision/body-shop profile admits collision-center synonyms and rejects auto-repair/glass/parts-only rows before verification. Historical brain figures and allow field were not changed.',
  jewelers: 'Dedicated singular/plural jewelry aliases now pass discovery. Watch/pawn/antiques-only rows remain outside the narrow cohort. Historical benchmark fields were not changed.',
  exotic_car_dealers: 'A dedicated profile requires exotic/luxury/classic automotive context. Generic used/OEM dealers and luxury-spa counterexamples fail before verification even though the historical broad brain allow field remains unchanged.',
  dentist: 'Export wording now uses row evidence. A published NPPES contact is no longer described as traced to a home merely because the job uses recipe B. All exported contact-status labels retain ownership unconfirmed. A complete independent owner-evidence pipeline remains pending.',
  cpa: 'Export status no longer infers ownership or a home trace from recipe B. Current phone clearance and source-role identity remain distinct from independently supported ownership; the proposed owner-evidence pipeline is not yet wired.',
  attorney: 'The never-Maps delivery/quote guard now covers attorney_ny as well as attorney. Export status no longer represents a recipe-B public register number as traced to a home or owner-confirmed.',
};
for (const [key, correction] of Object.entries(corrections)) {
  const path = new URL(`../src/data/industry-workflows/${key}.json`, import.meta.url);
  const review = JSON.parse(await readFile(path, 'utf8'));
  const heading = 'Root integration regression check, 2026-09-24';
  review.iterations = review.iterations.filter(entry => entry.hypothesis !== heading);
  review.iterations.push({hypothesis:heading,test:'Focused synthetic regression checks in tests/lead-engine-industry-corrections.test.ts, lead-engine-reviews.test.ts, lead-engine-gates-jobs.test.ts and lead-engine-jobs.test.ts. No paid provider call.',observed:correction,change:'Shared runtime correction integrated. Original source samples are retained with their original denominators; no phone-yield improvement is claimed.'});
  review.implementation.summary = `${correction} Original review: ${review.implementation.summary.replace(/^.* Original review: /s,'')}`;
  if (key === 'med_spa') {
    review.measurement.result = review.measurement.result.replace('current owner-title matches','old owner-title matches (before root correction)');
    review.phoneSource = 'Explicitly published business-contact numbers only. NPPES LOCATION or AO fields are candidates; differing MAILING phones are not eligible without independent business-use evidence. No private phone enrichment.';
  }
  await writeFile(path, JSON.stringify(review,null,2)+'\n');
  const doc = new URL(`../docs/features/industries/${key}.md`,import.meta.url);
  const text = await readFile(doc,'utf8');
  if (!text.includes(`## ${heading}`)) await writeFile(doc, `${text}\n## ${heading}\n\n${correction}\n\nFocused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.\n`);
}
console.log(`Recorded ${Object.keys(corrections).length} integration corrections.`);
