import { buildLeadPlan, routeIndustry } from './lead-engine-plan.ts';
import type { LeadPlanInput, LeadPlan } from './lead-engine-plan.ts';

export class LeadEngineError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export interface SavedLeadPlan { id: string; status: 'draft' | 'paused' | 'archived'; createdAt: string; input: LeadPlanInput; plan: LeadPlan }
export interface LeadDryRun {
  version: 1; batchId: string; planId: string; status: 'dry_run'; executionEnabled: false;
  maxBusinesses: number; maxCostCents: number; reservedCents: 0; consumedCents: 0; claimsCreated: 0; blockers: string[]; checkedAt: string;
}
export interface LeadPlanPage { plans: SavedLeadPlan[]; nextOffset: number | null }
export const LEAD_PAGE_SIZE = 20;
// JSONB may reorder object keys. Snapshot identity depends on field values only.
export function leadPlanFingerprint(input: LeadPlanInput): string {
  return JSON.stringify([input.industry, input.metro, input.target, input.hardBudgetCents, input.exclusions, input.operation ?? null]);
}
export function leadRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function leadUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function invalid(message: string): never { throw new LeadEngineError(400, 'invalid_input', message); }
function exact(value: Record<string, unknown>, keys: string[]): void { if (Object.keys(value).some(key => !keys.includes(key))) invalid('Unexpected fields are not accepted.'); }
export function parseLeadPlanCreate(body: unknown): { planId: string; input: LeadPlanInput; plan: LeadPlan } {
  if (!leadRecord(body)) invalid('A plan object is required.');
  exact(body, ['version', 'planId', 'input']);
  if (body.version !== 1 || !leadUuid(body.planId) || !leadRecord(body.input)) invalid('Use version 1 and a valid plan ID.');
  const input = body.input;
  exact(input, ['industry', 'metro', 'target', 'hardBudgetCents', 'exclusions', 'operation']);
  if (typeof input.industry !== 'string' || typeof input.metro !== 'string' || typeof input.target !== 'number' || typeof input.hardBudgetCents !== 'number'
    || !Array.isArray(input.exclusions) || input.exclusions.some(value => typeof value !== 'string')
    || (input.operation !== undefined && !['A', 'B', 'C'].includes(String(input.operation)))) invalid('Plan fields have invalid types.');
  if (input.operation !== undefined && typeof input.operation !== 'string') invalid('Invalid operation.');
  const parsed: LeadPlanInput = {
    industry: input.industry.trim(), metro: input.metro.trim(), target: input.target, hardBudgetCents: input.hardBudgetCents,
    exclusions: input.exclusions.map((value: string) => value.trim()),
    ...(input.operation ? { operation: input.operation as LeadPlanInput['operation'] } : {}),
  };
  if ([parsed.industry, parsed.metro, ...parsed.exclusions].some(value => /[\u0000-\u001f\u007f]/.test(value))) invalid('Control characters are not accepted.');
  const routed = routeIndustry(parsed.industry);
  if (routed.lane && parsed.operation && parsed.operation !== routed.lane) invalid('The operation conflicts with the recognized industry workflow.');
  const plan = buildLeadPlan(parsed);
  if (plan.errors.length || !plan.lane) invalid(plan.errors[0] ?? 'Choose how this business operates before saving.');
  return { planId: body.planId.toLowerCase(), input: parsed, plan };
}
export function parseLeadDryRun(body: unknown): string {
  if (!leadRecord(body)) invalid('A dry-run request is required.');
  exact(body, ['version', 'batchId']);
  if (body.version !== 1 || !leadUuid(body.batchId)) invalid('Use version 1 and a valid batch ID.');
  return body.batchId.toLowerCase();
}
export function parseLeadOffset(url: string): number {
  const params = new URL(url).searchParams;
  if ([...params.keys()].some(key => key !== 'offset') || params.getAll('offset').length > 1) invalid('Only one offset is accepted.');
  const value = params.get('offset') ?? '0';
  if (!/^(0|[1-9][0-9]{0,5})$/.test(value)) invalid('Offset must be a whole number from 0 to 999999.');
  return Number(value);
}
export function leadStorageError(error: { code?: string; message?: string }): LeadEngineError {
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) return new LeadEngineError(503, 'storage_pending', 'Plan storage is pending integration. Your draft is still available to export.');
  if (error.code === 'P0001') {
    if (['plan_not_found', 'batch_not_found'].includes(error.message ?? '')) return new LeadEngineError(404, 'not_found', 'That plan was not found.');
    if (error.message === 'idempotency_conflict') return new LeadEngineError(409, 'idempotency_conflict', 'This request ID belongs to a different snapshot. Save the edited draft as a new plan.');
    if (error.message === 'invalid_state') return new LeadEngineError(409, 'invalid_state', 'This saved plan cannot prepare a new dry-run in its current state.');
  }
  return new LeadEngineError(503, 'storage_unavailable', 'Plan storage could not be reached. Keep your draft and retry the same request.');
}
