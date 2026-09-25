import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadEngineError } from '../lib/lead-engine-storage';
import { resolveTimeZone } from '../lib/lead-engine-timezone';
import { createBatchDataVerificationProvider } from './lead-engine-batchdata';
import type { LeadVerification } from '../lib/lead-engine-quality';

// Stage 2 of the Lane A pipeline: verify the published numbers found in stage 1 and keep only
// Mobile + !dnc + !tcpa + reachable (build spec §4). Every number costs money to check, so EVERY
// checked number is recorded — kept ones as a delivery, dropped ones as a filtered business with the
// reason. A second pass therefore skips them instead of paying twice for the same answer.
//
// One call verifies at most CHUNK numbers and reports what is left, so the operator watches progress
// instead of staring at a spinner, and a timeout never loses the numbers already paid for.

export interface VerificationProgress {
  processed: number; remaining: number; costCents: number;
  delivered: number; mobile: number; landline: number; dncExcluded: number;
  tcpaExcluded: number; unreachable: number; noTimeZone: number; unmatched: number;
}
interface CandidateRow { phone10: string; name: string; city: string; state: string; source_url: string; business_key: string; place_id: string | null }

// The account rejects multi-number batches (1 works, 5 returns "Insufficient balance" on a funded
// account), so numbers go one per request. Same price per record; only more round trips.
const CHUNK = 10;
const MILLICENTS_PER_NUMBER = 700;

export async function verifyListPhones(db: SupabaseClient, operatorId: string, listId: string, apiKey: string): Promise<VerificationProgress> {
  const list = await db.from('lead_engine_lists').select('id,plan_id,import_status').eq('id', listId).eq('operator_id', operatorId).maybeSingle();
  if (list.error || !list.data) throw new LeadEngineError(404, 'list_not_found', 'That list was not found.');
  if (list.data.import_status !== 'complete') throw new LeadEngineError(409, 'invalid_state', 'Finish collecting the businesses before verifying their phone numbers.');

  const pending = await unverified(db, listId);
  const summary: VerificationProgress = { processed: 0, remaining: pending.length, costCents: 0, delivered: 0, mobile: 0, landline: 0, dncExcluded: 0, tcpaExcluded: 0, unreachable: 0, noTimeZone: 0, unmatched: 0 };
  if (pending.length === 0) return summary;

  const slice = pending.slice(0, CHUNK);
  const provider = createBatchDataVerificationProvider(apiKey);
  const results = [];
  for (const row of slice) results.push((await provider.verifyPhones([row.phone10]))[0]);
  summary.processed = slice.length;
  summary.remaining = pending.length - slice.length;
  summary.costCents = Math.ceil(slice.length * MILLICENTS_PER_NUMBER / 1000);

  for (const [index, result] of results.entries()) {
    const row = slice[index];
    const drop = dropReason(result, summary);
    if (drop) { await record(db, listId, row, 'filtered', drop); continue; }
    const timeZone = resolveTimeZone({ state: row.state, city: row.city, phone10: row.phone10 });
    // No time zone means no legal calling window, so it cannot ship on a dial sheet.
    if (!timeZone) { summary.noTimeZone++; await record(db, listId, row, 'filtered', 'time_zone_unresolved'); continue; }
    if (await record(db, listId, row, 'claimed', null) && await deliver(db, listId, list.data.plan_id, operatorId, row, result, timeZone)) summary.delivered++;
  }
  return summary;
}

// Candidates kept by the free filters that no paid check has answered for yet.
async function unverified(db: SupabaseClient, listId: string): Promise<CandidateRow[]> {
  const candidates = await db.from('lead_engine_candidates')
    .select('phone10,name,city,state,source_url,business_key,place_id')
    .eq('list_id', listId).is('rejection', null).not('phone10', 'is', null).order('position');
  if (candidates.error) throw new LeadEngineError(503, 'storage_pending', 'The saved businesses could not be read. Nothing was charged.');
  const rows = (candidates.data ?? []) as CandidateRow[];
  if (rows.length === 0) return [];
  const known = await db.from('lead_engine_businesses').select('phone10').in('phone10', rows.map(row => row.phone10));
  const answered = new Set((known.data ?? []).map(entry => (entry as { phone10: string }).phone10));
  return rows.filter(row => !answered.has(row.phone10));
}

function dropReason(result: LeadVerification, summary: VerificationProgress): string | null {
  // The provider had no data for this number at all, which is not the same as knowing it is a landline.
  if (result.lineType === null) { summary.unmatched++; return 'no_provider_answer'; }
  if (result.lineType !== 'Mobile') { summary.landline++; return 'not_mobile'; }
  summary.mobile++;
  if (result.dnc !== false) { summary.dncExcluded++; return 'do_not_call'; }
  if (result.tcpa !== false) { summary.tcpaExcluded++; return 'tcpa_litigator'; }
  if (result.reachable !== true) { summary.unreachable++; return 'not_reachable'; }
  return null;
}

// The delivery gate requires a business row for this exact batch; a discovery batch claims none up front.
async function record(db: SupabaseClient, batchId: string, row: CandidateRow, disposition: 'claimed' | 'filtered', reason: string | null): Promise<boolean> {
  const inserted = await db.from('lead_engine_businesses').insert({
    phone10: row.phone10, name_city: row.business_key.replaceAll('|', ' '), place_id: row.place_id,
    source_url: row.source_url, batch_id: batchId, disposition, drop_reason: reason,
  });
  // A duplicate means another batch already owns this business: never deliver the same owner twice.
  return !inserted.error;
}

async function deliver(db: SupabaseClient, batchId: string, planId: string, operatorId: string,
  row: CandidateRow, result: LeadVerification, timeZone: string): Promise<boolean> {
  const delivery = await db.from('lead_engine_deliveries').insert({
    phone10: row.phone10, batch_id: batchId, plan_id: planId, operator_id: operatorId,
    line_type: 'Mobile', dnc: false, tcpa: false, reachable: true,
    verified_at: result.verifiedAt ?? new Date().toISOString(), time_zone: timeZone,
    evidence_ref: `batchdata phone/verification ${result.verifiedAt ?? new Date().toISOString()}`.slice(0, 300),
  });
  return !delivery.error;
}

export interface LeadDetail {
  position: number; name: string; city: string; state: string; phone10: string | null;
  website: string | null; sourceUrl: string | null; placeId: string | null; rejection: string | null;
  timeZone: string | null; status: 'delivered' | 'dropped' | 'unverified' | 'filtered_out';
  lineType: string | null; dnc: boolean | null; tcpa: boolean | null; reachable: boolean | null;
  verifiedAt: string | null; dropReason: string | null;
}

// Operator-only full record. The public list RPC deliberately withholds phone numbers; this is the
// owner of the research looking at their own paid results, which is the point of the product.
export async function readListLeads(db: SupabaseClient, operatorId: string, listId: string): Promise<LeadDetail[]> {
  const list = await db.from('lead_engine_lists').select('id').eq('id', listId).eq('operator_id', operatorId).maybeSingle();
  if (list.error || !list.data) throw new LeadEngineError(404, 'list_not_found', 'That list was not found.');
  const candidates = await db.from('lead_engine_candidates')
    .select('position,name,city,state,website,source_url,phone10,place_id,business_key,rejection')
    .eq('list_id', listId).order('position');
  if (candidates.error) throw new LeadEngineError(503, 'storage_pending', 'The saved businesses could not be read.');
  const rows = (candidates.data ?? []) as Array<CandidateRow & { position: number; website: string | null; rejection: string | null }>;
  const phones = rows.map(row => row.phone10).filter((phone): phone is string => Boolean(phone));
  const [delivered, dropped] = phones.length === 0 ? [{ data: [] }, { data: [] }] : await Promise.all([
    db.from('lead_engine_deliveries').select('phone10,line_type,dnc,tcpa,reachable,verified_at,time_zone').in('phone10', phones),
    db.from('lead_engine_businesses').select('phone10,disposition,drop_reason').in('phone10', phones),
  ]);
  const byPhone = new Map((delivered.data ?? []).map(entry => [(entry as { phone10: string }).phone10, entry as Record<string, unknown>]));
  const reasons = new Map((dropped.data ?? []).map(entry => [(entry as { phone10: string }).phone10, entry as Record<string, unknown>]));

  return rows.map(row => {
    const hit = row.phone10 ? byPhone.get(row.phone10) : undefined;
    const record = row.phone10 ? reasons.get(row.phone10) : undefined;
    const status: LeadDetail['status'] = row.rejection ? 'filtered_out' : hit ? 'delivered' : record ? 'dropped' : 'unverified';
    return {
      position: row.position, name: row.name, city: row.city, state: row.state, phone10: row.phone10,
      website: row.website, sourceUrl: row.source_url, placeId: row.place_id, rejection: row.rejection,
      timeZone: (hit?.time_zone as string | undefined) ?? resolveTimeZone({ state: row.state, city: row.city, phone10: row.phone10 }),
      status, lineType: (hit?.line_type as string | undefined) ?? null,
      dnc: (hit?.dnc as boolean | undefined) ?? null, tcpa: (hit?.tcpa as boolean | undefined) ?? null,
      reachable: (hit?.reachable as boolean | undefined) ?? null,
      verifiedAt: (hit?.verified_at as string | undefined) ?? null,
      dropReason: (record?.drop_reason as string | undefined) ?? null,
    };
  });
}
