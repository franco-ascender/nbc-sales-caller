import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadEngineError } from '../lib/lead-engine-storage.ts';
import { extractOwnerFromText, pickOwnerName, stripHtml, reviewCorpus, reviewBucketOf, MAX_REVIEWS_PER_LISTING } from '../lib/lead-engine-reviews.ts';
import type { OwnerCandidate, OwnerPick, ReviewText, ReviewBucket } from '../lib/lead-engine-reviews.ts';

// Phase 4 task 5, the paid half. Three name sources in cost order:
//   1. website copy (home, /about, /team): free fetch, deterministic extractor;
//   2. Google Maps reviews through Apify compass/google-maps-reviews-scraper (actor id Xb8osYTtOjlsgI6k9,
//      verified live 2026-09-21: PAY_PER_EVENT review-scraped $0.0006 on the free tier = 0.06 cents per
//      review, actor start $0.00005), 25 newest reviews per listing, no reviewer personal data;
//   3. one small-model pass (Anthropic Messages API, Haiku) over the 25 reviews, ONLY when the deterministic
//      pass found nothing, JSON in and out, a few hundred tokens.
// Every paid call asks lead_engine_meter first (vendor apify step reviews; vendor anthropic step reviews,
// both enabled by migration 202609210270). Nothing here runs on a schedule.
//
// Runner hook for the jobs service owner (not wired here): after the verify phase, on recipe A rows that
// are Mobile and have no owner_name, call
//   extractOwnersForRows(db, { id: job.id, operator_id: job.operator_id }, rows, reviewVendorsFromEnv())
// and, when the result carries apifyRun.status === 'running', store apifyRun and call again with
// { runId, datasetId } on the next advance. Recipe B uses the same call when no register names the owner.

// Same shape as VendorError in lead-engine-apify-runs.ts (vendor + sanitized message) so the jobs service
// can freeze a job on it the same way; declared here so the module loads under Node's strip-only TypeScript.
export class ReviewsVendorError extends Error { readonly vendor: string; constructor(vendor: string, message: string) { super(message); this.name = 'VendorError'; this.vendor = vendor; } }
const VendorError = ReviewsVendorError;

export const APIFY_REVIEWS_ACTOR_ID = process.env.APIFY_REVIEWS_ACTOR_ID ?? 'Xb8osYTtOjlsgI6k9';
export const REVIEW_CENTS_PER_REVIEW = 0.06;     // free tier price, verified live; Bronze and up are cheaper
export const REVIEWS_RUN_START_CENTS = 0.005;
export const REVIEWS_RUN_MINIMUM_CENTS = 50;      // the Apify maxTotalChargeUsd floor the places actor enforces; kept for the cap
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_REVIEWS_MODEL ?? 'claude-haiku-4-5';
export const ANTHROPIC_MAX_OUTPUT_TOKENS = 200;
// Haiku 4.5 list price: $1 per million input tokens, $5 per million output. Four characters per token.
export const anthropicCents = (inputChars: number): number => Math.max(1, Math.ceil(((inputChars / 4) * 0.0001 + ANTHROPIC_MAX_OUTPUT_TOKENS * 0.0005)));
export const reviewsCents = (listings: number, perListing = MAX_REVIEWS_PER_LISTING): number => Math.ceil(listings * perListing * REVIEW_CENTS_PER_REVIEW + REVIEWS_RUN_START_CENTS);

const ID = /^[a-zA-Z0-9]{15,30}$/;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

export interface ReviewsRun { runId: string; datasetId: string; status: 'running' | 'succeeded' | 'failed' }
export interface ReviewsScraper {
  start(placeIds: string[], maxChargeCents: number): Promise<ReviewsRun>;
  poll(runId: string): Promise<ReviewsRun>;
  reviews(datasetId: string): Promise<Map<string, ReviewText[]>>;   // placeId -> reviews
}

async function readBody(response: Response, limit: number): Promise<unknown> {
  const text = await response.text();
  if (text.length > limit) throw new VendorError('apify', 'response too large');
  try { return JSON.parse(text); } catch { throw new VendorError('apify', `HTTP ${response.status} with a non-JSON body`); }
}

export function createReviewsScraper(token: string, request: typeof fetch = fetch): ReviewsScraper {
  if (!token.trim() || /[\r\n]/.test(token)) throw new LeadEngineError(503, 'provider_access_pending', 'The scraper account is not configured.');
  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await request(`https://api.apify.com/v2/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000), cache: 'no-store', redirect: 'error' });
    } catch (error) { throw new VendorError('apify', `network: ${error instanceof Error ? error.name : 'unknown'}`); }
  }
  function observation(payload: unknown): ReviewsRun {
    const data = record(payload) && record(payload.data) ? payload.data : null;
    if (!data || !ID.test(String(data.id)) || !ID.test(String(data.defaultDatasetId)) || typeof data.status !== 'string') throw new VendorError('apify', 'unexpected run payload');
    const failed = ['FAILED', 'TIMED-OUT', 'ABORTED'].includes(data.status);
    return { runId: String(data.id), datasetId: String(data.defaultDatasetId), status: data.status === 'SUCCEEDED' ? 'succeeded' : failed ? 'failed' : 'running' };
  }
  return {
    async start(placeIds, maxChargeCents) {
      if (placeIds.length === 0 || placeIds.length > 200) throw new VendorError('apify', 'between 1 and 200 place ids per run');
      const query = new URLSearchParams({ maxTotalChargeUsd: (Math.max(maxChargeCents, REVIEWS_RUN_MINIMUM_CENTS) / 100).toFixed(2), restartOnError: 'false', waitForFinish: '0' });
      const response = await call(`acts/${APIFY_REVIEWS_ACTOR_ID}/runs?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        placeIds, maxReviews: MAX_REVIEWS_PER_LISTING, reviewsSort: 'newest', language: 'en', personalData: false, reviewsOrigin: 'all',
      }) });
      const body = await readBody(response, 262144);
      if (!response.ok) throw new VendorError('apify', `HTTP ${response.status} starting the reviews run: ${record(body) && record(body.error) ? String(body.error.message ?? '').slice(0, 200) : 'no detail'}`);
      return observation(body);
    },
    async poll(runId) {
      if (!ID.test(runId)) throw new VendorError('apify', 'invalid run id');
      const response = await call(`actor-runs/${runId}`);
      const body = await readBody(response, 262144);
      if (!response.ok) throw new VendorError('apify', `HTTP ${response.status} polling the reviews run`);
      return observation(body);
    },
    async reviews(datasetId) {
      if (!ID.test(datasetId)) throw new VendorError('apify', 'invalid dataset id');
      const out = new Map<string, ReviewText[]>();
      for (let offset = 0; offset < 5000; offset += 1000) {
        const response = await call(`datasets/${datasetId}/items?format=json&offset=${offset}&limit=1000&clean=true&fields=placeId,text,textTranslated,responseFromOwnerText,originalLanguage`);
        const body = await readBody(response, 8 * 1024 * 1024);
        if (!response.ok || !Array.isArray(body)) throw new VendorError('apify', `HTTP ${response.status} reading the reviews dataset`);
        for (const item of body) {
          if (!record(item)) continue;
          const placeId = str(item.placeId); if (!placeId) continue;
          const list = out.get(placeId) ?? [];
          if (list.length < MAX_REVIEWS_PER_LISTING) list.push({ text: str(item.text) ?? str(item.textTranslated), ownerReply: str(item.responseFromOwnerText), language: str(item.originalLanguage) });
          out.set(placeId, list);
        }
        if (body.length < 1000) break;
      }
      return out;
    },
  };
}

// The model pass. Raw Messages API call with an injectable fetch (tests never reach the network; the
// repo carries no Anthropic SDK dependency and every other vendor here is called the same way).
export interface OwnerModel { extract(corpus: string): Promise<OwnerCandidate | null>; estimateCents(corpus: string): number }
const SYSTEM = 'You read customer reviews of one small business and answer with JSON only. Find the business OWNER\'s name if the reviews or the owner\'s replies state it. Never guess, never return staff, technicians, receptionists or managers unless the text calls them the owner. Answer exactly {"first":string|null,"last":string|null,"evidence":string|null,"language":"en"|"es"|null}. evidence is the shortest quote that names the owner. If no owner is named, answer {"first":null,"last":null,"evidence":null,"language":null}.';

export function createAnthropicOwnerModel(apiKey: string, request: typeof fetch = fetch): OwnerModel {
  if (!apiKey.trim() || /[\r\n]/.test(apiKey)) throw new LeadEngineError(503, 'provider_access_pending', 'The model account is not configured.');
  return {
    estimateCents: corpus => anthropicCents(corpus.length + SYSTEM.length),
    async extract(corpus) {
      if (!corpus.trim()) return null;
      let response: Response;
      try {
        response = await request('https://api.anthropic.com/v1/messages', {
          method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: ANTHROPIC_MAX_OUTPUT_TOKENS, system: SYSTEM, messages: [{ role: 'user', content: corpus.slice(0, 20000) }] }),
        });
      } catch (error) { throw new VendorError('anthropic', `network: ${error instanceof Error ? error.name : 'unknown'}`); }
      const text = await response.text();
      if (text.length > 65536) throw new VendorError('anthropic', 'response too large');
      let body: unknown;
      try { body = JSON.parse(text); } catch { throw new VendorError('anthropic', `HTTP ${response.status} with a non-JSON body`); }
      if (!response.ok) throw new VendorError('anthropic', `HTTP ${response.status}: ${record(body) && record(body.error) ? String(body.error.type ?? '').slice(0, 80) : 'no detail'}`);
      if (!record(body) || !Array.isArray(body.content)) throw new VendorError('anthropic', 'unexpected message payload');
      if (body.stop_reason === 'refusal') return null;
      const block = body.content.find((item): item is Record<string, unknown> => record(item) && item.type === 'text');
      const answer = typeof block?.text === 'string' ? block.text : '';
      const json = answer.match(/\{[\s\S]*\}/)?.[0];
      if (!json) return null;
      let parsed: unknown;
      try { parsed = JSON.parse(json); } catch { return null; }
      if (!record(parsed)) return null;
      const first = str(parsed.first); if (!first || first.length > 40 || !/^[A-Za-zÁÉÍÓÚÑÜáéíóúñü'\- ]+$/.test(first)) return null;
      const last = str(parsed.last); const evidence = str(parsed.evidence) ?? '';
      // The model must quote the name from the corpus: a name that does not appear in the text is a guess.
      if (!corpus.toLowerCase().includes(first.toLowerCase())) return null;
      return { first, last: last && /^[A-Za-zÁÉÍÓÚÑÜáéíóúñü'\- ]{2,40}$/.test(last) ? last : null, evidence: evidence.slice(0, 200), language: parsed.language === 'es' ? 'es' : 'en', confidence: 0.7, pattern: 'model' };
    },
  };
}

// Website copy is free: the homepage and the usual team pages, same origin, bounded, no cookies.
export const ABOUT_PATHS = ['/', '/about', '/about-us', '/team', '/our-team', '/meet-the-team'];
export async function fetchAboutPages(website: string, request: typeof fetch = fetch, paths: readonly string[] = ABOUT_PATHS): Promise<string> {
  let origin: URL;
  try { origin = new URL(website.startsWith('http') ? website : `https://${website}`); } catch { return ''; }
  if (!/^https?:$/.test(origin.protocol) || !origin.hostname.includes('.')) return '';
  const chunks: string[] = [];
  for (const path of paths) {
    try {
      const response = await request(new URL(path, origin.origin).toString(), { method: 'GET', cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html', 'User-Agent': 'NBC-Sales-LeadEngine/1.0 (owner name extractor)' } });
      if (!response.ok || !(response.headers.get('content-type') ?? '').includes('text/html')) continue;
      const html = await response.text();
      chunks.push(stripHtml(html.slice(0, 512 * 1024)));
    } catch { continue; }
  }
  return chunks.join(' . ').slice(0, 200000);
}

export interface WebsiteOwnerResult { owner: OwnerPick | null; candidates: OwnerCandidate[]; chars: number }
export async function extractOwnerFromWebsite(website: string, request: typeof fetch = fetch): Promise<WebsiteOwnerResult> {
  const text = await fetchAboutPages(website, request);
  const candidates = extractOwnerFromText(text);
  return { owner: pickOwnerName(candidates), candidates, chars: text.length };
}

// The runner hook.
export interface ReviewVendors { apify: ReviewsScraper | null; anthropic: OwnerModel | null }
export function reviewVendorsFromEnv(): ReviewVendors {
  return {
    apify: process.env.APIFY_API_TOKEN ? createReviewsScraper(process.env.APIFY_API_TOKEN) : null,
    anthropic: process.env.ANTHROPIC_API_KEY ? createAnthropicOwnerModel(process.env.ANTHROPIC_API_KEY) : null,
  };
}
export interface ReviewJob { id: string; operator_id: string }
export interface ReviewRow { id: string; name: string; place_id: string | null; website: string | null; owner_name: string | null; line_type?: string | null }
export type OwnerMethod = 'about_page' | 'reviews' | 'model' | 'none';
export interface RowOwnerResult { rowId: string; owner: OwnerPick | null; method: OwnerMethod; reviewBucket: ReviewBucket; reviewsRead: number; evidence: string[] }
export interface ExtractOwnersResult { results: RowOwnerResult[]; apifyRun: ReviewsRun | null; spentCents: number; stopped: string | null }

interface MeterDecision { allowed: boolean; reason: string; remaining_cents?: number }
async function meter(db: SupabaseClient, job: ReviewJob, vendor: 'apify' | 'anthropic', units: number, cents: number): Promise<MeterDecision> {
  const { data, error } = await db.rpc('lead_engine_meter', { p_operator: job.operator_id, p_job: job.id, p_vendor: vendor, p_step: 'reviews', p_units: units, p_cents: cents });
  if (error) {
    if (/unknown_vendor/.test(error.message ?? '')) throw new LeadEngineError(503, 'storage_pending', `The meter does not know vendor ${vendor} yet: apply migration 202609210270.`);
    throw new LeadEngineError(503, 'storage_pending', 'The meter could not be reached. Nothing was charged.');
  }
  return data as MeterDecision;
}

async function saveOwner(db: SupabaseClient, row: ReviewRow, result: RowOwnerResult): Promise<void> {
  if (!result.owner) return;
  const ownerName = [result.owner.first, result.owner.last].filter(Boolean).join(' ');
  const current = await db.from('lead_engine_job_rows').select('verification').eq('id', row.id).maybeSingle();
  const verification = current.data && record(current.data) && record(current.data.verification) ? current.data.verification : {};
  const saved = await db.from('lead_engine_job_rows').update({
    owner_name: ownerName.slice(0, 200),
    verification: { ...verification, owner_source: result.method, owner_confidence: result.owner.confidence, owner_votes: result.owner.votes, review_bucket: result.reviewBucket, owner_evidence: result.evidence.slice(0, 3) },
    updated_at: new Date().toISOString(),
  }).eq('id', row.id).is('owner_name', null);
  if (saved.error) throw new LeadEngineError(503, 'storage_pending', 'The owner name could not be saved to the job row.');
}

export async function extractOwnersForRows(db: SupabaseClient, job: ReviewJob, rows: readonly ReviewRow[], vendors: ReviewVendors, options: { runId?: string; datasetId?: string; request?: typeof fetch } = {}): Promise<ExtractOwnersResult> {
  const request = options.request ?? fetch;
  const pending = rows.filter(row => !row.owner_name && row.line_type === 'Mobile');
  const results = new Map<string, RowOwnerResult>();
  let spentCents = 0, stopped: string | null = null;

  // 1. Free: website copy.
  for (const row of pending) {
    if (!row.website) continue;
    const found = await extractOwnerFromWebsite(row.website, request);
    if (found.owner) results.set(row.id, { rowId: row.id, owner: found.owner, method: 'about_page', reviewBucket: 'none', reviewsRead: 0, evidence: found.owner.evidence });
  }

  // 2. Paid: reviews for rows with a place id, one run for the batch, behind the meter.
  const needReviews = pending.filter(row => !results.has(row.id) && row.place_id);
  let apifyRun: ReviewsRun | null = null;
  let reviewsByPlace = new Map<string, ReviewText[]>();
  if (needReviews.length > 0 && vendors.apify) {
    if (options.runId && options.datasetId) {
      apifyRun = await vendors.apify.poll(options.runId);
    } else {
      const cents = reviewsCents(needReviews.length);
      const decision = await meter(db, job, 'apify', needReviews.length * MAX_REVIEWS_PER_LISTING, cents);
      if (!decision.allowed) stopped = `reviews skipped: meter said ${decision.reason}`;
      else { spentCents += cents; apifyRun = await vendors.apify.start(needReviews.map(row => row.place_id as string), cents); }
    }
    if (apifyRun?.status === 'succeeded') reviewsByPlace = await vendors.apify.reviews(apifyRun.datasetId);
    if (apifyRun?.status === 'failed') stopped = 'reviews run failed at the provider; no retry';
  }
  for (const row of needReviews) {
    const reviews = reviewsByPlace.get(row.place_id as string) ?? [];
    if (reviews.length === 0) continue;
    const candidates = extractOwnerFromText(reviewCorpus(reviews));
    const owner = pickOwnerName(candidates);
    results.set(row.id, { rowId: row.id, owner, method: owner ? 'reviews' : 'none', reviewBucket: reviewBucketOf(candidates, reviews), reviewsRead: reviews.length, evidence: owner?.evidence ?? [] });
  }

  // 3. Paid, exceptional: the model, only where reviews exist and the deterministic pass found nothing.
  if (vendors.anthropic && apifyRun?.status === 'succeeded') {
    for (const row of needReviews) {
      const current = results.get(row.id);
      if (!current || current.owner || current.reviewsRead === 0) continue;
      const corpus = reviewCorpus(reviewsByPlace.get(row.place_id as string) ?? []);
      const cents = vendors.anthropic.estimateCents(corpus);
      const decision = await meter(db, job, 'anthropic', 1, cents);
      if (!decision.allowed) { stopped = `model pass skipped: meter said ${decision.reason}`; break; }
      spentCents += cents;
      const candidate = await vendors.anthropic.extract(corpus);
      if (candidate) results.set(row.id, { ...current, owner: { first: candidate.first, last: candidate.last, votes: 1, confidence: candidate.confidence, languages: { en: candidate.language === 'en' ? 1 : 0, es: candidate.language === 'es' ? 1 : 0 }, evidence: [candidate.evidence] }, method: 'model', reviewBucket: 'owner_named', evidence: [candidate.evidence] });
    }
  }

  const list = pending.map(row => results.get(row.id) ?? { rowId: row.id, owner: null, method: 'none' as const, reviewBucket: 'none' as const, reviewsRead: 0, evidence: [] });
  for (const row of pending) { const result = results.get(row.id); if (result?.owner) await saveOwner(db, row, result); }
  return { results: list, apifyRun: apifyRun?.status === 'running' ? apifyRun : null, spentCents, stopped };
}
