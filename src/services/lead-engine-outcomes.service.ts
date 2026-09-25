import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadEngineError } from '../lib/lead-engine-storage';
import { readWorkbook, sheetRecords } from '../lib/lead-engine-xlsx';
import { parseOutcomeRecords } from '../lib/lead-engine-jobs';
import type { Outcome } from '../lib/lead-engine-jobs';

// Phase 0 task 7: outcome capture. One outcome at a time from the UI, or a whole dial sheet back from
// the caller. Every write goes through lead_engine_record_dial_outcome, which freezes the row's features,
// checks the dial window and suppresses opt-outs in the same transaction.

export interface RecordedOutcome {
  id: string; ledgerId: string; outcome: Outcome; dialedAtUtc: string; dialedAtLocal: string; localHour: number; withinDialWindow: boolean; suppressed: boolean;
}

function storageError(error: { code?: string; message?: string }): LeadEngineError {
  const message = error.message ?? '';
  if (/ledger_not_found/.test(message)) return new LeadEngineError(404, 'ledger_not_found', 'That delivered row was not found in your ledger.');
  if (/invalid_outcome/.test(message)) return new LeadEngineError(400, 'invalid_outcome', 'That outcome is not one of the seven allowed values.');
  if (/invalid_dial_time/.test(message)) return new LeadEngineError(400, 'invalid_dial_time', 'The call time must be within the last 31 days and not in the future.');
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) return new LeadEngineError(503, 'storage_pending', 'The outcome tables are not applied to this database yet.');
  return new LeadEngineError(503, 'storage_pending', 'The outcome could not be saved. Nothing else changed.');
}

export async function recordOutcome(db: SupabaseClient, operator: string, input: { ledgerId: string; outcome: Outcome; dialedAt: string | null; notes: string | null }): Promise<RecordedOutcome> {
  const { data, error } = await db.rpc('lead_engine_record_dial_outcome', {
    p_operator: operator, p_ledger: input.ledgerId, p_outcome: input.outcome, p_dialed_at: input.dialedAt ?? new Date().toISOString(), p_notes: input.notes,
  });
  if (error) throw storageError(error);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id), ledgerId: String(row.ledger_id), outcome: row.outcome as Outcome, dialedAtUtc: String(row.dialed_at_utc), dialedAtLocal: String(row.dialed_at_local),
    localHour: Number(row.local_hour), withinDialWindow: Boolean(row.within_dial_window), suppressed: input.outcome === 'opt_out' || input.outcome === 'wrong_number',
  };
}

export interface ImportSummary { recorded: number; skipped: number; suppressed: number; errors: string[]; sheet: string }

// The dial sheet comes back as it went out: List sheet, Ledger Id column. Rows without an Outcome are
// not called yet. The import stops reporting, never guessing: a bad row is listed with its number.
export async function importOutcomes(db: SupabaseClient, operator: string, bytes: Uint8Array): Promise<ImportSummary> {
  if (bytes.length > 8 * 1024 * 1024) throw new LeadEngineError(413, 'file_too_large', 'The sheet must be under 8 MB.');
  let sheets;
  try { sheets = readWorkbook(bytes); } catch { throw new LeadEngineError(400, 'invalid_file', 'That file is not a readable .xlsx workbook.'); }
  const sheet = sheets.find(item => item.name === 'List') ?? sheets[0];
  if (!sheet) throw new LeadEngineError(400, 'invalid_file', 'The workbook has no sheets.');
  const parsed = parseOutcomeRecords(sheetRecords(sheet));
  if (parsed.rows.length === 0 && parsed.errors.length === 0) return { recorded: 0, skipped: parsed.skipped, suppressed: 0, errors: ['No row has an Outcome filled in yet.'], sheet: sheet.name };
  let recorded = 0, suppressed = 0;
  const errors = [...parsed.errors];
  for (const row of parsed.rows) {
    try {
      const saved = await recordOutcome(db, operator, { ledgerId: row.ledgerId, outcome: row.outcome, dialedAt: null, notes: row.notes });
      recorded++; if (saved.suppressed) suppressed++;
    } catch (error) { errors.push(`Row ${row.row}: ${error instanceof Error ? error.message : 'could not be saved'}`); }
  }
  return { recorded, skipped: parsed.skipped, suppressed, errors, sheet: sheet.name };
}
