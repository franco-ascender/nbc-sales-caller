// Live, free: signs in with the operator account and calls one register ingest chunk directly, printing the API answer.
// node tests/lead-engine-registers-api-live.mjs or_ccb
import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');
const source = process.argv[2] ?? 'or_ccb';
const base = process.env.L03_LIVE_BASE_URL || 'https://nbc-sales-nbc-sales.vercel.app';
const auth = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.NBC_OPERATOR_EMAIL, password: process.env.NBC_OPERATOR_INITIAL_PASSWORD }),
});
const session = await auth.json();
if (!session.access_token) { console.log('login failed', auth.status); process.exit(1); }
const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
const started = Date.now();
const chunk = await fetch(`${base}/api/lead-engine/registers/${source}/ingest`, { method: 'POST', headers, body: '{}' });
const body = await chunk.text();
console.log('ingest', chunk.status, `${Date.now() - started}ms`, body.slice(0, 1500));
const summary = await fetch(`${base}/api/lead-engine/registers`, { headers });
const rows = (await summary.json()).sources?.filter(row => row.source === source);
console.log('summary', summary.status, JSON.stringify(rows));
