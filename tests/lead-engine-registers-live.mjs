// Read-only live probe of every register adapter: the first request of each source with a tiny limit,
// parsed with the real adapter. Prints status, row count, names, skips and any trap note. Writes nothing.
// Run: node --experimental-strip-types tests/lead-engine-registers-live.mjs
import { REGISTER_ADAPTERS, USER_AGENT } from '../src/lib/lead-engine-registers.ts';

const TINY_LIMIT = 5;
const timeoutMs = Number(process.env.REGISTERS_LIVE_TIMEOUT_MS || 30000);

function shrink(request) {
  // Socrata pages and NPPES slices are asked for a handful of rows; CSV ranges for their first 64 KB.
  const url = request.url.replace(/\$limit=\d+/, `$limit=${TINY_LIMIT}`).replace(/([?&])limit=\d+/, `$1limit=${TINY_LIMIT}`);
  const headers = { ...request.headers };
  if (headers.Range) headers.Range = 'bytes=0-65535';
  return { ...request, url, headers };
}

async function probe(adapter) {
  const started = Date.now();
  const request = adapter.request(adapter.initialCursor());
  if (!request) return { source: adapter.source, status: 'no_request' };
  const shrunk = shrink(request);
  const headers = { 'User-Agent': USER_AGENT, ...shrunk.headers };
  if (shrunk.kind === 'socrata' && process.env.SOCRATA_APP_TOKEN) headers['X-App-Token'] = process.env.SOCRATA_APP_TOKEN;
  try {
    const response = await fetch(shrunk.url, { method: shrunk.method, headers, body: shrunk.body ?? undefined, signal: AbortSignal.timeout(timeoutMs) });
    const text = await response.text();
    const out = { source: adapter.source, http: response.status, bytes: text.length, ms: Date.now() - started, host: new URL(shrunk.url).host };
    if (response.status >= 400) return { ...out, status: `http_${response.status}` };
    try {
      const chunk = adapter.parse({ status: response.status, text, contentRange: response.headers.get('content-range'), contentType: response.headers.get('content-type') }, adapter.initialCursor());
      const named = chunk.rows.filter(row => row.name).length;
      const withPhone = chunk.rows.filter(row => row.name?.phone10).length;
      const skips = {};
      for (const row of chunk.rows) if (row.skipReason) skips[row.skipReason] = (skips[row.skipReason] ?? 0) + 1;
      const traps = [];
      if (adapter.source === 'tx_tdlr_salons') traps.push(`owner_telephone mirrors business_telephone on ${chunk.rows.filter(row => row.payload.ownerTelephoneMirrorsBusiness === true).length}/${chunk.rows.length}`);
      if (adapter.source === 'ny_childcare' && skips.phone_omitted_opt_out) traps.push(`phone_number_omitted=Y skipped: ${skips.phone_omitted_opt_out}`);
      if (adapter.source === 'fl_dbpr_construction') traps.push('extract carries no phone column (recipe B names)');
      return { ...out, status: 'ok', rows: chunk.rows.length, named, withPhone, skips, note: chunk.note, nextStep: adapter.source === 'cslb' ? chunk.next.step : undefined, traps };
    } catch (error) {
      return { ...out, status: error?.code ?? 'parse_error', detail: String(error?.message ?? error).slice(0, 160) };
    }
  } catch (error) {
    return { source: adapter.source, status: 'network_error', detail: error?.name ?? String(error), ms: Date.now() - started };
  }
}

// CSLB needs the postback to say anything useful: try step 0 then step 1 and report which one the portal refuses.
async function probeCslb(adapter) {
  const cursor0 = adapter.initialCursor();
  const first = await probe(adapter);
  if (first.status !== 'ok') return { ...first, step: 0 };
  const request0 = adapter.request(cursor0);
  const r0 = await fetch(request0.url, { headers: { 'User-Agent': USER_AGENT, ...request0.headers }, signal: AbortSignal.timeout(timeoutMs) });
  const cookie = (r0.headers.getSetCookie?.() ?? []).map(part => part.split(';')[0]).join('; ');
  const step1 = adapter.parse({ status: r0.status, text: await r0.text(), contentRange: null, contentType: r0.headers.get('content-type') }, cursor0);
  const request1 = adapter.request(step1.next);
  const r1 = await fetch(request1.url, { method: 'POST', headers: { 'User-Agent': USER_AGENT, ...request1.headers, Cookie: cookie }, body: request1.body, signal: AbortSignal.timeout(timeoutMs) });
  const text1 = await r1.text();
  try {
    const parsed = adapter.parse({ status: r1.status, text: text1, contentRange: null, contentType: r1.headers.get('content-type') }, step1.next);
    return { source: 'cslb', status: 'ok', step0: r0.status, step1: r1.status, masterLink: parsed.next.links?.master ?? null };
  } catch (error) {
    return { source: 'cslb', status: error?.code ?? 'parse_error', step0: r0.status, step1: r1.status, detail: String(error?.message ?? error).slice(0, 160), needsAttention: 'portal_unavailable' };
  }
}

const results = [];
for (const adapter of REGISTER_ADAPTERS) {
  const result = adapter.source === 'cslb' ? await probeCslb(adapter) : await probe(adapter);
  results.push(result);
  console.log(JSON.stringify(result));
}
const ok = results.filter(r => r.status === 'ok').length;
console.log(JSON.stringify({ probed: results.length, ok, notOk: results.filter(r => r.status !== 'ok').map(r => `${r.source}:${r.status}`) }));
