// Apply one SQL migration file to the NBC Supabase project through the Management API (the same path
// every earlier migration used; see docs/DB_SCHEMA.md). Writes an evidence file with the SHA-256 of what
// was sent and the tables/functions seen afterwards. Never prints secrets.
//
//   node scripts/lead-engine-apply-migration.mjs supabase/migrations/202609210230_lead_engine_memory.sql
//   node scripts/lead-engine-apply-migration.mjs supabase/migrations/202609210240_lead_engine_jobs.sql
import { loadEnvFile } from 'node:process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

if (existsSync('.env.local')) loadEnvFile('.env.local');
const path = process.argv[2];
if (!path || !/^supabase\/migrations\/\d{12}_[a-z0-9_]+\.sql$/.test(path)) { console.error('Usage: node scripts/lead-engine-apply-migration.mjs supabase/migrations/<file>.sql'); process.exit(1); }
const ref = process.env.SUPABASE_PROJECT_REF, token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) { console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN in .env.local.'); process.exit(1); }

const sql = readFileSync(path, 'utf8');
async function query(text) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text }),
  });
  return { status: response.status, ok: response.ok, body: await response.json().catch(() => null) };
}
const before = await query("select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name like 'lead_engine_%'");
const result = await query(sql);
const after = await query("select table_name from information_schema.tables where table_schema = 'public' and table_name like 'lead_engine_%' order by 1");
const functions = await query("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname like 'lead_engine_%' order by 1");
const evidence = {
  at: new Date().toISOString(), file: path, sha256: createHash('sha256').update(sql).digest('hex'), status: result.status, applied: result.ok,
  result: result.ok ? 'ok' : result.body, tablesBefore: before.body?.[0]?.n ?? null, tables: after.body?.map(row => row.table_name) ?? null, functions: functions.body?.map(row => row.proname) ?? null,
};
mkdirSync('artifacts/lanes/L03', { recursive: true });
const out = `artifacts/lanes/L03/migration-${basename(path, '.sql')}-applied.json`;
writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ file: path, status: result.status, applied: result.ok, tables: evidence.tables?.length ?? null, functions: evidence.functions?.length ?? null, evidence: out, error: result.ok ? undefined : result.body }, null, 2));
if (!result.ok) process.exitCode = 1;
