import { LeadEngineError, leadRecord } from '../lib/lead-engine-storage.ts';
import { normalizeBusinessPhone, parseLeadVerification } from '../lib/lead-engine-quality.ts';
import type { LeadVerification } from '../lib/lead-engine-quality.ts';

// Internal transport only: no route, worker or environment auto-wiring calls this adapter.
// Phone verification is a paid, per-record call. Nothing here runs automatically, and callers must
// pass an already-approved batch — this module does not decide budget, dedupe or gating.
// Contract source: docs/sources/owner-cell-build-spec.md (BatchData section). One call returns line
// type + DNC + TCPA + reachability together; /phone/dnc and /phone/litigator must never be called
// separately for numbers already covered here.

const MAX_BATCH = 100;
const MAX_BODY_BYTES = 262144;
// Skip trace (Phase 4, recipe B): 50 persons per call at $0.07 each (engine.py cmd_trace). A person answer
// carries several phones and emails, so the body ceiling is wider than the verification one.
export const TRACE_BATCH = 50;
export const TRACE_CENTS_PER_PERSON = 7;
const TRACE_MAX_BODY_BYTES = 2097152;
const TRACE_URL = 'https://api.batchdata.com/api/v1/property/skip-trace';

function verificationError(): LeadEngineError {
  return new LeadEngineError(503, 'verification_unavailable', 'Phone verification status could not be confirmed. Do not treat unverified numbers as cleared.');
}

async function readBoundedJson(response: Response, limit: number = MAX_BODY_BYTES): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) { await reader.cancel(); throw verificationError(); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw verificationError(); }
}

export interface BatchDataVerificationProvider {
  verifyPhones(phone10s: readonly string[]): Promise<LeadVerification[]>;
  skipTrace(requests: readonly SkipTraceRequest[]): Promise<SkipTraceResult[]>;
}

// ---------- skip trace (recipe B) ----------

export interface SkipTraceRequest { first: string; last: string; street: string; city: string; state: string; zip: string }
export interface SkipTraceResult {
  status: 'matched' | 'unmatched';
  // The best phone: highest score Mobile with dnc=false and tcpa=false, else the highest score Mobile (delivered as dropped), else null.
  phone10: string | null; lineType: string | null; dnc: boolean | null; tcpa: boolean | null; score: number | null;
  email: string | null; phonesSeen: number;
}

const normKey = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
// One identity key per request: normalised first + last + street + ZIP5. Duplicate keys inside a batch are
// left unmatched on purpose (the answer could belong to either row).
export function traceRequestKey(first: unknown, last: unknown, street: unknown, zip: unknown): string {
  return [normKey(first), normKey(last), normKey(street), normKey(zip).slice(0, 5)].join('|');
}
export function traceRequestBody(request: SkipTraceRequest): Record<string, unknown> {
  return { propertyAddress: { street: request.street, city: request.city, state: request.state, zip: request.zip }, name: { first: request.first, last: request.last } };
}

// The places BatchData may echo the input, most trustworthy first; the returned record itself last.
function traceResponseKeys(person: Record<string, unknown>): string[] {
  const candidates: Record<string, unknown>[] = [];
  for (const path of [['meta', 'input'], ['meta', 'request'], ['input'], ['request']]) {
    let node: unknown = person;
    for (const key of path) node = leadRecord(node) ? node[key] : undefined;
    if (leadRecord(node)) candidates.push(node);
  }
  candidates.push(person);
  const keys: string[] = [];
  for (const candidate of candidates) {
    const address = leadRecord(candidate.propertyAddress) ? candidate.propertyAddress : leadRecord(candidate.address) ? candidate.address : null;
    const name = leadRecord(candidate.name) ? candidate.name : null;
    if (!address || !name) continue;
    const key = traceRequestKey(name.first, name.last, address.street, address.zip);
    if (key !== '|||' && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

// Request index -> person answer. Each answer is used once; an answer whose key fits two free requests is skipped.
export function matchTraceResults(requests: readonly SkipTraceRequest[], persons: readonly unknown[]): Map<number, Record<string, unknown>> {
  const index = new Map<string, number[]>();
  requests.forEach((request, position) => {
    const key = traceRequestKey(request.first, request.last, request.street, request.zip);
    index.set(key, [...(index.get(key) ?? []), position]);
  });
  const matched = new Map<number, Record<string, unknown>>();
  for (const person of persons) {
    if (!leadRecord(person)) continue;
    for (const key of traceResponseKeys(person)) {
      const free = (index.get(key) ?? []).filter(position => !matched.has(position));
      if (free.length === 1) { matched.set(free[0], person); break; }
    }
  }
  return matched;
}

// engine.py cmd_trace: phones sorted by score, Mobile only, the first clean one wins; the email is kept.
export function pickTracePhone(person: Record<string, unknown>): Omit<SkipTraceResult, 'status'> {
  const phones = (Array.isArray(person.phoneNumbers) ? person.phoneNumbers : []).filter(leadRecord)
    .map(row => ({ number: normalizeBusinessPhone(row.number), type: typeof row.type === 'string' ? row.type : null, dnc: typeof row.dnc === 'boolean' ? row.dnc : null, tcpa: typeof row.tcpa === 'boolean' ? row.tcpa : null, score: typeof row.score === 'number' ? row.score : 0 }))
    .sort((a, b) => b.score - a.score);
  const mobiles = phones.filter(row => row.number && (row.type ?? '').toLowerCase() === 'mobile');
  const best = mobiles.find(row => row.dnc === false && row.tcpa === false) ?? mobiles[0] ?? null;
  const emails = Array.isArray(person.emails) ? person.emails : [];
  const firstEmail = emails[0];
  const email = leadRecord(firstEmail) && typeof firstEmail.email === 'string' ? firstEmail.email : typeof firstEmail === 'string' ? firstEmail : null;
  return {
    phone10: best?.number ?? null, lineType: best ? 'Mobile' : phones[0]?.type ?? null, dnc: best ? best.dnc : null, tcpa: best ? best.tcpa : null, score: best ? best.score : null,
    email: email && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) ? email.toLowerCase().slice(0, 254) : null, phonesSeen: phones.length,
  };
}
const UNMATCHED: SkipTraceResult = { status: 'unmatched', phone10: null, lineType: null, dnc: null, tcpa: null, score: null, email: null, phonesSeen: 0 };

export function createBatchDataVerificationProvider(apiKey: string, request: typeof fetch = fetch): BatchDataVerificationProvider {
  if (!apiKey.trim() || /[\r\n]/.test(apiKey)) throw verificationError();
  return {
    async verifyPhones(phone10s) {
      if (!Array.isArray(phone10s) || phone10s.length < 1 || phone10s.length > MAX_BATCH
        || phone10s.some(phone => normalizeBusinessPhone(phone) !== phone)) throw verificationError();
      let response: Response;
      try {
        response = await request('https://api.batchdata.com/api/v1/phone/verification', {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: phone10s }), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
        });
      } catch { throw verificationError(); }
      const data = await readBoundedJson(response);
      // BatchData reports a dry account as 403 with the reason only in the body. Reading the status
      // alone hides it behind a generic outage, which is exactly the misread the build spec warns about.
      if (!response.ok) {
        const reason = leadRecord(data) && leadRecord(data.status) && typeof data.status.message === 'string' ? data.status.message : '';
        if (/insufficient balance/i.test(reason)) {
          throw new LeadEngineError(402, 'provider_balance_exhausted', 'BatchData has no balance left, so no number was verified and nothing was charged. Top up the account and run this again.');
        }
        throw verificationError();
      }
      if (!leadRecord(data) || !leadRecord(data.results) || !Array.isArray(data.results.phoneNumbers)) throw verificationError();
      const verifiedAt = new Date().toISOString();
      // The provider answers in its own order and may not answer at all for an unroutable number, so
      // results are matched by number. Position matching threw away every paid answer in the batch.
      const answers = new Map<string, LeadVerification>();
      for (const row of data.results.phoneNumbers) {
        const parsed = parseLeadVerification(row);
        if (parsed.phone10) answers.set(parsed.phone10, parsed);
      }
      return phone10s.map(phone => answers.get(phone)
        ? { ...answers.get(phone)!, verifiedAt }
        // No answer stays unknown; it is never quietly treated as a cleared number.
        : { phone10: phone, lineType: null, dnc: null, tcpa: null, reachable: null, verifiedAt });
    },
    async skipTrace(requests) {
      if (!Array.isArray(requests) || requests.length < 1 || requests.length > TRACE_BATCH
        || requests.some(row => !row.first || !row.last || !row.street || !row.state)) throw verificationError();
      let response: Response;
      try {
        response = await request(TRACE_URL, {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: requests.map(traceRequestBody) }), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000),
        });
      } catch { throw verificationError(); }
      const data = await readBoundedJson(response, TRACE_MAX_BODY_BYTES);
      if (!response.ok) {
        const reason = leadRecord(data) && leadRecord(data.status) && typeof data.status.message === 'string' ? data.status.message : '';
        if (/insufficient balance/i.test(reason)) {
          throw new LeadEngineError(402, 'provider_balance_exhausted', 'BatchData has no balance left, so no person was traced and nothing was charged. Top up the account and resume.');
        }
        throw verificationError();
      }
      if (!leadRecord(data) || !leadRecord(data.results) || !Array.isArray(data.results.persons)) throw verificationError();
      // engine.py zipped requests with results by position; BatchData answers in its own order and may omit
      // misses, so each answer is matched to its request by identity (echoed input, else returned address + name).
      const matched = matchTraceResults(requests, data.results.persons);
      return requests.map((_row, position) => {
        const person = matched.get(position);
        return person ? { status: 'matched' as const, ...pickTracePhone(person) } : UNMATCHED;
      });
    },
  };
}
