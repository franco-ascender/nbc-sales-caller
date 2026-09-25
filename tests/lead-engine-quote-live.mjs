// Live, free: signs in and asks production for a quote (no job created, no credits touched).
// node tests/lead-engine-quote-live.mjs contractors OR 100
import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');
const [industry = 'contractors', state = 'OR', cells = '100'] = process.argv.slice(2);
const base = process.env.L03_LIVE_BASE_URL || 'https://nbc-sales-nbc-sales.vercel.app';
const auth = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.NBC_OPERATOR_EMAIL, password: process.env.NBC_OPERATOR_INITIAL_PASSWORD }) });
const token = (await auth.json()).access_token;
const r = await fetch(`${base}/api/lead-engine/jobs/quote`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ industry, state, targetCells: Number(cells), dncMode: 'strict', useFallback: false }) });
const q = (await r.json()).quote;
console.log(r.status, JSON.stringify({ recipe: q?.recipe, source: q?.registerSource, legal: q?.legalStatus, credits: q?.credits, capCents: q?.capCents, vendorCents: q?.estimatedVendorCents, blockers: q?.blockers }));
