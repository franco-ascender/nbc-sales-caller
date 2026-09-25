import type { LeadConnectionCheck } from '../lib/lead-engine-research.ts';
import { leadRecord } from '../lib/lead-engine-storage.ts';
import { createOutscraperDiscoveryProvider } from './lead-engine-outscraper.ts';
// Only GET account metadata; no Actor, phone verification or balance-changing request.
export async function checkLeadConnections(config: { apifyToken?: string; outscraperKey?: string; phoneVerifierKey?: string }, request: typeof fetch = fetch): Promise<LeadConnectionCheck> {
  const result: LeadConnectionCheck = { checkedAt: new Date().toISOString(), apify: 'missing', outscraper: 'missing',
    phoneVerifier: config.phoneVerifierKey ? 'configured_unverified' : 'missing', executionEnabled: false };
  if (config.apifyToken) {
    try {
      const response = await request('https://api.apify.com/v2/users/me', { method: 'GET', headers: { Authorization: `Bearer ${config.apifyToken}` },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
      if ([401, 403].includes(response.status)) result.apify = 'rejected';
      else if (!response.ok) result.apify = 'unavailable';
      else {
        const data: unknown = await response.json();
        result.apify = leadRecord(data) && leadRecord(data.data) && typeof data.data.id === 'string' && data.data.id.length > 0 ? 'access_verified' : 'unavailable';
      }
    } catch { result.apify = 'unavailable'; }
  }
  if (config.outscraperKey) {
    try { result.outscraper = await createOutscraperDiscoveryProvider(config.outscraperKey, request).checkBalance(); }
    catch { result.outscraper = 'unavailable'; }
  }
  return result;
}
