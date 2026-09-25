// Local-only metadata assembly. Never calls providers, loads credentials or changes routing.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateWorkflow } from '../src/lib/lead-engine-workflows.ts';
const root = new URL('../', import.meta.url);
const brain = JSON.parse(await readFile(new URL('src/data/lead-engine-brain.json', root), 'utf8'));
const dir = new URL('src/data/industry-workflows/', root);
const files = (await readdir(dir)).filter(file => file.endsWith('.json'));
const result = {};
const routingOnly = value => JSON.stringify({...value, industries:Object.fromEntries(Object.entries(value.industries).map(([key,entry])=>{ const {workflow_review,...baseline}=entry; return [key,baseline]; }))});
const baseline = routingOnly(brain);
for (const key of Object.keys(brain.industries)) {
  if (!files.includes(`${key}.json`)) throw Error(`Review missing: ${key}`);
  const review = JSON.parse(await readFile(new URL(`${key}.json`, dir), 'utf8'));
  validateWorkflow(review, key);
  result[key] = review;
}
if (files.length !== Object.keys(result).length) throw Error('Unexpected industry review files');
await writeFile(new URL('src/data/lead-engine-workflows.json', root), `${JSON.stringify(result, null, 2)}\n`);
for (const key of Object.keys(result)) brain.industries[key].workflow_review = { file:`src/data/industry-workflows/${key}.json`, reviewed_at:'2026-09-24' };
if (routingOnly(brain) !== baseline) throw Error('Review packaging changed historical routing or measurements');
await writeFile(new URL('src/data/lead-engine-brain.json',root),JSON.stringify(brain,null,2)+'\n');
const artifact = new URL('artifacts/lanes/L03/industry-workflows/',root);
await mkdir(artifact,{recursive:true});
await writeFile(new URL('brain-preservation.json',artifact),JSON.stringify({reviewDate:'2026-09-24',industryCount:files.length,onlyNewReviewReferences:true,unchangedRoutingAndMeasurementsSha256:createHash('sha256').update(baseline).digest('hex')},null,2)+'\n');
console.log(`Packaged ${files.length} independently reviewed workflows. No provider calls.`);
