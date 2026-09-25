import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadEngineError, leadRecord, leadStorageError } from '../lib/lead-engine-storage.ts';
import { assertDiscoveryIdentity, assertDiscoveryJob, discoveryError } from '../lib/lead-engine-discovery.ts';
import type { DiscoveryJob, DiscoveryStore } from '../lib/lead-engine-discovery.ts';

function present(value: unknown, operator: string, batch: string): DiscoveryJob {
  if (!leadRecord(value)) throw discoveryError();
  const job = { batchId: value.batch_id, planId: value.plan_id, operatorId: value.operator_id, actorId: value.actor_id,
    build: value.build_tag, searchTerm: value.search_term, location: value.location, maxResults: value.max_results,
    maxCostCents: value.max_cost_cents, status: value.status, runId: value.run_id, datasetId: value.dataset_id } as DiscoveryJob;
  assertDiscoveryJob(job, operator, batch); return job;
}
export function createDiscoveryStore(db: SupabaseClient): DiscoveryStore {
  async function rpc(name: string, operator: string, batch: string, args: Record<string, unknown> = {}): Promise<unknown> {
    assertDiscoveryIdentity(operator, batch);
    const { data, error } = await db.rpc(name, { p_operator: operator, p_batch: batch, ...args });
    if (error) throw leadStorageError(error);
    return data;
  }
  return {
    async get(operator, batch) {
      assertDiscoveryIdentity(operator, batch);
      const { data, error } = await db.from('lead_engine_discovery_jobs')
        .select('batch_id,plan_id,operator_id,actor_id,build_tag,search_term,location,max_results,max_cost_cents,status,run_id,dataset_id')
        .eq('operator_id', operator).eq('batch_id', batch).maybeSingle();
      if (error) throw leadStorageError(error);
      if (!data) throw new LeadEngineError(404, 'not_found', 'That research job was not found.');
      return present(data, operator, batch);
    },
    async claim(operator, batch) {
      const result = await rpc('lead_engine_claim_discovery', operator, batch);
      if (!leadRecord(result) || typeof result.acquired !== 'boolean') throw discoveryError();
      return { job: present(result.job, operator, batch), acquired: result.acquired };
    },
    async observe(operator, batch, result) {
      return present(await rpc('lead_engine_observe_discovery', operator, batch, {
        p_run: result.runId, p_dataset: result.datasetId, p_actor: result.actorId, p_build: result.build, p_status: result.status,
      }), operator, batch);
    },
    async uncertain(operator, batch) { return present(await rpc('lead_engine_uncertain_discovery', operator, batch), operator, batch); },
  };
}
