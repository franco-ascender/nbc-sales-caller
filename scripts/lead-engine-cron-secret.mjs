// Creates CRON_SECRET on the Vercel project (production) if it does not exist yet, so Vercel Cron can call
// /api/lead-engine/registers/cron. Prints only whether it was created; never prints the secret.
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) loadEnvFile('.env.local');
const { VERCEL_TOKEN: token, VERCEL_TEAM_ID: team, VERCEL_PROJECT_ID: project } = process.env;
if (!token || !team || !project) { console.error('Missing Vercel credentials in .env.local'); process.exit(1); }
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const existing = await (await fetch(`https://api.vercel.com/v9/projects/${project}/env?teamId=${team}`, { headers })).json();
if ((existing.envs ?? []).some(env => env.key === 'CRON_SECRET')) { console.log(JSON.stringify({ CRON_SECRET: 'already set' })); process.exit(0); }
const response = await fetch(`https://api.vercel.com/v10/projects/${project}/env?teamId=${team}&upsert=true`, { method: 'POST', headers, body: JSON.stringify({ key: 'CRON_SECRET', value: randomBytes(32).toString('hex'), type: 'encrypted', target: ['production', 'preview'] }) });
console.log(JSON.stringify({ CRON_SECRET: response.ok ? 'created' : `failed ${response.status}`, detail: response.ok ? undefined : (await response.json()).error?.message }));
