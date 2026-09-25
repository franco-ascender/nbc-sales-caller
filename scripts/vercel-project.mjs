import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { spawnSync } from 'node:child_process';

if (existsSync('.env.local')) loadEnvFile('.env.local');

const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID;
const projectId = process.env.VERCEL_PROJECT_ID;

if (!token || !teamId || !projectId) {
  console.error('Missing VERCEL_TOKEN, VERCEL_TEAM_ID, or VERCEL_PROJECT_ID in .env.local.');
  process.exit(1);
}

const [mode, deploymentId] = process.argv.slice(2);
if (mode !== '--check' && mode !== '--deploy') {
  console.error('Usage: node scripts/vercel-project.mjs --check [deployment-id] | --deploy');
  process.exit(1);
}
if (mode === '--deploy' && deploymentId) {
  console.error('--deploy does not accept additional arguments.');
  process.exit(1);
}

// The CLI reads VERCEL_TOKEN from its environment. Keeping it out of argv and
// setting both project-link variables keeps the local project link complete.
const env = { ...process.env, VERCEL_TOKEN: token, VERCEL_ORG_ID: teamId, VERCEL_PROJECT_ID: projectId };
const cliArgs = mode === '--check'
  ? deploymentId
    ? ['--no-install', 'vercel', 'inspect', deploymentId, '--scope', teamId]
    : ['--no-install', 'vercel', 'ls', '--scope', teamId]
  : ['--no-install', 'vercel', 'deploy', '--prod', '--yes', '--scope', teamId];

const result = spawnSync('npx', cliArgs, { cwd: process.cwd(), env, stdio: 'inherit' });
if (result.error) {
  console.error(`Vercel CLI could not start (${result.error.name}).`);
  process.exit(1);
}
process.exit(result.status ?? 1);
