import 'server-only';
import { parcelSourceFor, PARCEL_TIMEOUT_MS } from '../lib/lead-engine-parcel';
import type { ParcelHit } from '../lib/lead-engine-parcel';
import { USER_AGENT } from '../lib/lead-engine-registers';

// Phase 4 task 2, the impure half: one HTTP GET per name against the state's parcel layer, 25 second
// timeout, no retry. Every failure (network, HTTP status, non-JSON, layer error) is `null`; the runner
// counts nulls and freezes the job at three (engine.py: "failed/timed out 3 times, stopping, no retry loop").
// Free: no meter call belongs here.

export interface ParcelLookup { lookup(first: string, last: string, state: string): Promise<ParcelHit[] | null> }

export function createParcelLookup(request: typeof fetch = fetch, timeoutMs: number = PARCEL_TIMEOUT_MS): ParcelLookup {
  return {
    async lookup(first, last, state) {
      const source = parcelSourceFor(state);
      if (!source) return null;
      let response: Response;
      try {
        response = await request(source.url(first, last), { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': USER_AGENT }, cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
      } catch { return null; }
      if (!response.ok) return null;
      let body: unknown;
      try { body = await response.json(); } catch { return null; }
      return source.parse(body);
    },
  };
}
