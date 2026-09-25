import { assertDiscoveryJob, discoveryError, parseDiscoveryObservation } from '../lib/lead-engine-discovery.ts';
import type { DiscoveryJob, DiscoveryObservation, DiscoveryProvider } from '../lib/lead-engine-discovery.ts';
import { belowProviderMinimum } from '../lib/lead-engine-cost.ts';

// Internal transport only: no route, scheduler or environment auto-wiring activates this adapter.
// A trusted integration must confirm the Actor/build/input contract and price cap before seeding a job.
export function createApifyDiscoveryProvider(token: string, request: typeof fetch = fetch): DiscoveryProvider {
  if (!token.trim() || /[\r\n]/.test(token)) throw discoveryError();
  async function call(path: string, job: DiscoveryJob, input?: Record<string, unknown>): Promise<DiscoveryObservation> {
    try {
      const response = await request(`https://api.apify.com/v2/${path}`, {
        method: input ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(input ? { 'Content-Type': 'application/json' } : {}) },
        ...(input ? { body: JSON.stringify(input) } : {}), signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'error',
      });
      if (!response.ok || !response.body) { await response.body?.cancel(); throw discoveryError(); }
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try {
        for (;;) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > 262144) { await reader.cancel(); throw discoveryError(); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return parseDiscoveryObservation(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), job);
    } catch { throw discoveryError(); } // Never surface provider payloads, tokens or request URLs.
  }
  return {
    async start(job) {
      assertDiscoveryJob(job, job.operatorId, job.batchId);
      if (job.status !== 'dispatching' || job.runId !== null) throw discoveryError();
      // The Actor refuses a cap below its minimum, and the approved quote is the only cap we may send.
      if (belowProviderMinimum(job.maxCostCents)) throw discoveryError();
      const query = new URLSearchParams({ build: job.build, maxTotalChargeUsd: (job.maxCostCents / 100).toFixed(2), restartOnError: 'false', waitForFinish: '0' });
      return call(`acts/${job.actorId}/runs?${query}`, job, {
        searchStringsArray: [job.searchTerm], locationQuery: job.location, maxCrawledPlacesPerSearch: job.maxResults,
        language: 'en', scrapeContacts: false, maxReviews: 0, scrapeReviewsPersonalData: false, maxImages: 0,
      });
    },
    async poll(job) {
      assertDiscoveryJob(job, job.operatorId, job.batchId);
      if (job.runId === null) throw discoveryError();
      return call(`actor-runs/${job.runId}`, job);
    },
  };
}
