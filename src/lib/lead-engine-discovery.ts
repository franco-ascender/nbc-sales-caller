import { LeadEngineError, leadRecord, leadUuid } from './lead-engine-storage.ts';

export type DiscoveryStatus = 'prepared' | 'dispatching' | 'running' | 'succeeded' | 'failed' | 'uncertain';
export interface DiscoveryJob {
  batchId: string; planId: string; operatorId: string;
  actorId: string; build: string; searchTerm: string; location: string;
  maxResults: number; maxCostCents: number; status: DiscoveryStatus;
  runId: string | null; datasetId: string | null;
}
export interface DiscoveryObservation { runId: string; datasetId: string; actorId: string; build: string; status: 'running' | 'succeeded' | 'failed' }
export interface DiscoveryStore {
  get(operator: string, batch: string): Promise<DiscoveryJob>;
  claim(operator: string, batch: string): Promise<{ job: DiscoveryJob; acquired: boolean }>;
  observe(operator: string, batch: string, observation: DiscoveryObservation): Promise<DiscoveryJob>;
  uncertain(operator: string, batch: string): Promise<DiscoveryJob>;
}
export interface DiscoveryProvider {
  start(job: DiscoveryJob): Promise<DiscoveryObservation>;
  poll(job: DiscoveryJob): Promise<DiscoveryObservation>;
}
export function discoveryError(): LeadEngineError { return new LeadEngineError(503, 'discovery_unavailable', 'Research status could not be verified. Keep the existing job for reconciliation; do not start it again.'); }
export function apifyId(value: unknown): value is string { return typeof value === 'string' && /^[a-zA-Z0-9]{15,30}$/.test(value); }
export function assertDiscoveryIdentity(operator: string, batch: string): void {
  if (!leadUuid(operator) || !leadUuid(batch)) throw new LeadEngineError(400, 'invalid_input', 'Valid operator and batch identities are required.');
}
export function assertDiscoveryJob(job: DiscoveryJob, operator: string, batch: string): void {
  assertDiscoveryIdentity(operator, batch);
  if (job.operatorId !== operator || job.batchId !== batch || !leadUuid(job.planId)
    || !apifyId(job.actorId) || !/^\d{1,8}\.\d{1,8}\.\d{1,8}$/.test(job.build)
    || [job.searchTerm, job.location].some(value => typeof value !== 'string' || !value.trim() || value.length > 150 || /[\u0000-\u001f\u007f]/.test(value))
    || !Number.isSafeInteger(job.maxResults) || job.maxResults < 1 || job.maxResults > 300
    || !Number.isSafeInteger(job.maxCostCents) || job.maxCostCents < 1 || job.maxCostCents > 1000
    || !['prepared','dispatching','running','succeeded','failed','uncertain'].includes(job.status)
    || (job.runId !== null && !apifyId(job.runId)) || (job.datasetId !== null && !apifyId(job.datasetId))
    || ((job.runId === null) !== (job.datasetId === null))
    || (['prepared','dispatching'].includes(job.status) && job.runId !== null)
    || (['running','succeeded','failed'].includes(job.status) && job.runId === null)) throw discoveryError();
}
export function parseDiscoveryObservation(payload: unknown, expected: DiscoveryJob): DiscoveryObservation {
  const row = leadRecord(payload) && leadRecord(payload.data) ? payload.data : null;
  if (!row || !apifyId(row.id) || !apifyId(row.defaultDatasetId) || row.actId !== expected.actorId || row.buildNumber !== expected.build
    || (expected.runId !== null && row.id !== expected.runId) || (expected.datasetId !== null && row.defaultDatasetId !== expected.datasetId)
    || typeof row.status !== 'string') throw discoveryError();
  const running = ['READY', 'RUNNING', 'TIMING-OUT', 'ABORTING'];
  const failed = ['FAILED', 'TIMED-OUT', 'ABORTED'];
  if (![...running, ...failed, 'SUCCEEDED'].includes(row.status)) throw discoveryError();
  return { runId: row.id, datasetId: row.defaultDatasetId, actorId: expected.actorId, build: expected.build,
    status: row.status === 'SUCCEEDED' ? 'succeeded' : failed.includes(row.status) ? 'failed' : 'running' };
}
