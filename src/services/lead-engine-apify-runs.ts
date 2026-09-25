import { LeadEngineError } from '../lib/lead-engine-storage.ts';

// Apify runs for jobs: start one city, poll it, page its dataset. Same actor and build the quote flow
// verified live (compass/crawler-google-places, free tier, $0.004 per place, refuses caps under $0.50).
// Provider payloads never reach the browser; failures carry a short sanitized reason for the job freeze.

export const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID ?? 'nwua9Gu5YrADL7ZDj';
export const APIFY_ACTOR_BUILD = process.env.APIFY_ACTOR_BUILD ?? '0.14.757';
const ID = /^[a-zA-Z0-9]{15,30}$/;

export class VendorError extends Error { constructor(readonly vendor: string, message: string) { super(message); this.name = 'VendorError'; } }

export interface RunStart { runId: string; datasetId: string; status: 'running' | 'succeeded' | 'failed' }
export interface DatasetPage { offset: number; total: number; rows: unknown[] }
export interface ApifyRuns {
  start(input: { searchTerm: string; location: string; maxPlaces: number; maxChargeCents: number }): Promise<RunStart>;
  poll(runId: string): Promise<RunStart>;
  page(datasetId: string, offset: number, limit: number): Promise<DatasetPage>;
}

async function readBody(response: Response, limit: number): Promise<unknown> {
  const text = await response.text();
  if (text.length > limit) throw new VendorError('apify', 'response too large');
  try { return JSON.parse(text); } catch { throw new VendorError('apify', `HTTP ${response.status} with a non-JSON body`); }
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function createApifyRuns(token: string, request: typeof fetch = fetch): ApifyRuns {
  if (!token.trim() || /[\r\n]/.test(token)) throw new LeadEngineError(503, 'provider_access_pending', 'The scraper account is not configured.');
  const headers = { Authorization: `Bearer ${token}` };
  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await request(`https://api.apify.com/v2/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000), cache: 'no-store', redirect: 'error' });
    } catch (error) { throw new VendorError('apify', `network: ${error instanceof Error ? error.name : 'unknown'}`); }
  }
  function observation(payload: unknown): RunStart {
    const data = record(payload) && record(payload.data) ? payload.data : null;
    if (!data || !ID.test(String(data.id)) || !ID.test(String(data.defaultDatasetId)) || typeof data.status !== 'string') throw new VendorError('apify', 'unexpected run payload');
    const failed = ['FAILED', 'TIMED-OUT', 'ABORTED'].includes(data.status);
    return { runId: String(data.id), datasetId: String(data.defaultDatasetId), status: data.status === 'SUCCEEDED' ? 'succeeded' : failed ? 'failed' : 'running' };
  }
  return {
    async start(input) {
      if (input.maxChargeCents < 50) throw new VendorError('apify', 'cap under the provider minimum of $0.50');
      const query = new URLSearchParams({ build: APIFY_ACTOR_BUILD, maxTotalChargeUsd: (input.maxChargeCents / 100).toFixed(2), restartOnError: 'false', waitForFinish: '0' });
      const response = await call(`acts/${APIFY_ACTOR_ID}/runs?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        searchStringsArray: [input.searchTerm], locationQuery: input.location, maxCrawledPlacesPerSearch: input.maxPlaces,
        language: 'en', scrapeContacts: false, maxReviews: 0, scrapeReviewsPersonalData: false, maxImages: 0,
      }) });
      const body = await readBody(response, 262144);
      if (!response.ok) throw new VendorError('apify', `HTTP ${response.status} starting the run: ${record(body) && record(body.error) ? String(body.error.message ?? '').slice(0, 200) : 'no detail'}`);
      return observation(body);
    },
    async poll(runId) {
      if (!ID.test(runId)) throw new VendorError('apify', 'invalid run id');
      const response = await call(`actor-runs/${runId}`);
      const body = await readBody(response, 262144);
      if (!response.ok) throw new VendorError('apify', `HTTP ${response.status} polling the run`);
      return observation(body);
    },
    async page(datasetId, offset, limit) {
      if (!ID.test(datasetId) || offset < 0 || limit < 1 || limit > 200) throw new VendorError('apify', 'invalid dataset request');
      const response = await call(`datasets/${datasetId}/items?format=json&offset=${offset}&limit=${limit}&desc=false&clean=false`);
      const body = await readBody(response, 4 * 1024 * 1024);
      if (!response.ok || !Array.isArray(body)) throw new VendorError('apify', `HTTP ${response.status} reading the dataset`);
      const total = Number(response.headers.get('x-apify-pagination-total') ?? NaN);
      if (!Number.isSafeInteger(total) || total < 0) throw new VendorError('apify', 'dataset total missing');
      return { offset, total, rows: body };
    },
  };
}
