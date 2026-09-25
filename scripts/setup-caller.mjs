import { readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');
const e = process.env;

async function call(origin, path, headers, body) {
  const response = await fetch(new URL(path, origin), { method: body ? 'POST' : 'GET', headers: { ...headers, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Provider request rejected: HTTP ${response.status}`);
  return response.json();
}

try {
  const ref = e.SUPABASE_PROJECT_REF;
  if (!ref || new URL(e.NEXT_PUBLIC_SUPABASE_URL).hostname !== `${ref}.supabase.co`) throw new Error('Supabase URL and project reference must match.');
  const query = (query, read_only = true) => call('https://api.supabase.com', `/v1/projects/${ref}/database/query`, { Authorization: `Bearer ${e.SUPABASE_ACCESS_TOKEN}` }, { query, read_only });
  const table = await query("select to_regclass('public.call_sessions') is not null as present");
  if (!table[0].present) {
    await query('begin;\n' + readFileSync('supabase/migrations/202609140001_call_sessions.sql', 'utf8') + '\ncommit;', false);
    console.log('Caller session migration applied.');
  } else console.log('Caller session table already exists; migration preserved.');
  if (e.ELEVENLABS_AGENT_ID) {
    console.log('An agent ID is already configured; agent creation skipped.');
  } else {
    const config = JSON.parse(readFileSync('config/nbc-test-agent.json', 'utf8'));
    const headers = { 'xi-api-key': e.ELEVENLABS_API_KEY };
    const existing = await call('https://api.elevenlabs.io', '/v1/convai/agents?page_size=100', headers);
    if (existing.has_more || existing.agents.some(agent => agent.name === config.name)) throw new Error('Review existing agents before creating another test agent.');
    const created = await call('https://api.elevenlabs.io', '/v1/convai/agents/create', headers, config);
    if (typeof created.agent_id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(created.agent_id)) throw new Error('Agent creation response could not be verified.');
    const before = readFileSync('.env.local', 'utf8');
    const current = before.match(/^ELEVENLABS_AGENT_ID=(.*)$/m)?.[1]?.trim();
    if (current) throw new Error('Agent ID changed locally during creation; review ElevenLabs before continuing.');
    const after = /^ELEVENLABS_AGENT_ID=/m.test(before) ? before.replace(/^ELEVENLABS_AGENT_ID=.*$/m, `ELEVENLABS_AGENT_ID=${created.agent_id}`) : `${before}\nELEVENLABS_AGENT_ID=${created.agent_id}\n`;
    if (readFileSync('.env.local', 'utf8') !== before) throw new Error('Concurrent local edit; review the newly created agent.');
    writeFileSync('.env.local', after, { mode: 0o600 });
    console.log('Private ElevenLabs test agent created; ID saved locally.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Caller setup failed.');
  process.exitCode = 1;
}
