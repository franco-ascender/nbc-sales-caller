import type { SupabaseClient } from '@supabase/supabase-js';
import { buildLeadPlan } from '../lib/lead-engine-plan.ts';
import type { LeadPlanInput } from '../lib/lead-engine-plan.ts';
import { LEAD_PAGE_SIZE, LeadEngineError, leadStorageError, parseLeadPlanCreate } from '../lib/lead-engine-storage.ts';
import type { LeadDryRun, LeadPlanPage, SavedLeadPlan } from '../lib/lead-engine-storage.ts';

interface PlanRow { id: string; input: LeadPlanInput; status: SavedLeadPlan['status']; created_at: string }
const columns = 'id,input,status,created_at';
function present(row: PlanRow): SavedLeadPlan { return { id: row.id, input: row.input, status: row.status, createdAt: row.created_at, plan: buildLeadPlan(row.input) }; }
export interface LeadEngineStore {
  create(operator: string, body: unknown): Promise<SavedLeadPlan>;
  list(operator: string, offset: number): Promise<LeadPlanPage>;
  get(operator: string, id: string): Promise<SavedLeadPlan>;
  dryRun(operator: string, id: string, batchId: string): Promise<LeadDryRun>;
}
// Dependency injection allows HTTP-contract tests with Supabase's actual query builder and a local fetch stub.
// Instantiated only by the server-only service; no browser imports or global ledger reads.
export function createLeadEngineStore(db: SupabaseClient): LeadEngineStore {
  return {
    async create(operator, body) {
      const { planId, input, plan } = parseLeadPlanCreate(body);
      const { data, error } = await db.rpc('lead_engine_save_plan', {
        p_operator: operator, p_id: planId, p_input: input, p_lane: plan.lane,
        p_benchmark: plan.benchmarkVersion, p_forecast: plan.estimate!.maxCents, p_budget: input.hardBudgetCents,
      }).single();
      if (error) throw leadStorageError(error);
      if (!data) throw leadStorageError({});
      return present(data as PlanRow);
    },
    async list(operator, offset) {
      const { data, error } = await db.from('lead_engine_plans').select(columns).eq('operator_id', operator)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + LEAD_PAGE_SIZE);
      if (error) throw leadStorageError(error);
      const rows = (data ?? []) as PlanRow[];
      return { plans: rows.slice(0, LEAD_PAGE_SIZE).map(present), nextOffset: rows.length > LEAD_PAGE_SIZE ? offset + LEAD_PAGE_SIZE : null };
    },
    async get(operator, id) {
      const { data, error } = await db.from('lead_engine_plans').select(columns).eq('operator_id', operator).eq('id', id).maybeSingle();
      if (error) throw leadStorageError(error);
      if (!data) throw new LeadEngineError(404, 'not_found', 'That plan was not found.');
      return present(data as PlanRow);
    },
    async dryRun(operator, id, batchId) {
      const { data, error } = await db.rpc('lead_engine_dry_run', { p_operator: operator, p_plan: id, p_batch: batchId });
      if (error) throw leadStorageError(error);
      if (!data) throw leadStorageError({});
      return data as LeadDryRun;
    },
  };
}
