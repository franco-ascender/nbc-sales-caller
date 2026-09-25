import { assertDiscoveryIdentity, assertDiscoveryJob, discoveryError } from '../lib/lead-engine-discovery.ts';
import type { DiscoveryJob, DiscoveryProvider, DiscoveryStore } from '../lib/lead-engine-discovery.ts';

// Only a trusted server entrypoint may supply the authenticated operator. No browser/public execution route exists.
export function createDiscoveryWorker(store: DiscoveryStore, provider: DiscoveryProvider) {
  return {
    async start(operator: string, batch: string): Promise<DiscoveryJob> {
      assertDiscoveryIdentity(operator, batch);
      // A lost commit response must throw before HTTP. Repeating claim can never re-acquire dispatching.
      const claim = await store.claim(operator, batch);
      assertDiscoveryJob(claim.job, operator, batch);
      if (claim.acquired !== true) return claim.job;
      if (claim.job.status !== 'dispatching') throw discoveryError();
      try { return await store.observe(operator, batch, await provider.start(claim.job)); }
      catch {
        // This can fail too: the persisted dispatching marker still prevents any second POST.
        try { await store.uncertain(operator, batch); } catch { /* Requires reconciliation after DB recovery. */ }
        throw discoveryError();
      }
    },
    async sync(operator: string, batch: string): Promise<DiscoveryJob> {
      assertDiscoveryIdentity(operator, batch);
      const job = await store.get(operator, batch); assertDiscoveryJob(job, operator, batch);
      if (job.status !== 'running') return job;
      // GET failures are retryable; do not launch a new run or release its reservation.
      return store.observe(operator, batch, await provider.poll(job));
    },
  };
}
