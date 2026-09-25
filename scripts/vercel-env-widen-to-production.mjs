// Widen every Vercel project environment variable so its existing scope also covers Production.
// It PATCHes each variable's target list — secret values are never read, decrypted, moved or printed.
//
//   node scripts/vercel-env-widen-to-production.mjs          → shows what would change
//   node scripts/vercel-env-widen-to-production.mjs --apply  → applies it
//
// NEXT_PUBLIC_* values are baked in at build time, so redeploy afterwards or they stay empty.
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env.local')) loadEnvFile('.env.local');

const token = process.env.VERCEL_TOKEN, project = process.env.VERCEL_PROJECT_ID, team = process.env.VERCEL_TEAM_ID;
const apply = process.argv.includes('--apply');
if (!token || !project) { console.error('VERCEL_TOKEN and VERCEL_PROJECT_ID must be set in .env.local.'); process.exit(1); }

const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const suffix = team ? `?teamId=${team}` : '';

const listed = await fetch(`https://api.vercel.com/v9/projects/${project}/env${suffix}`, { headers: auth });
if (!listed.ok) { console.error(`Could not list variables: ${listed.status}.`); process.exit(1); }
const { envs = [] } = await listed.json();

const pending = envs.filter(entry => Array.isArray(entry.target) && !entry.target.includes('production'));
if (pending.length === 0) { console.log('Every variable already covers Production. Nothing to do.'); process.exit(0); }

console.log(`${pending.length} variable(s) do not cover Production yet:`);
for (const entry of pending) console.log(`  ${entry.key}  [${entry.target.join(', ')}] → [${[...entry.target, 'production'].join(', ')}]`);

if (!apply) { console.log('\nDry run. Re-run with --apply to widen them.'); process.exit(0); }

let failed = 0;
for (const entry of pending) {
  const response = await fetch(`https://api.vercel.com/v9/projects/${project}/env/${entry.id}${suffix}`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ target: [...entry.target, 'production'] }),
  });
  console.log(`${entry.key}: ${response.ok ? 'now covers Production' : `FAILED (${response.status})`}`);
  if (!response.ok) failed++;
}
console.log(failed === 0
  ? '\nDone. Redeploy now — NEXT_PUBLIC_* values are read at build time.'
  : `\n${failed} variable(s) failed; the rest were widened.`);
process.exitCode = failed === 0 ? 0 : 1;
