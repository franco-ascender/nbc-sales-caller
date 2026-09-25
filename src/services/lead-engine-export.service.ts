import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadEngineError } from '../lib/lead-engine-storage.ts';
import { readWorkbook } from '../lib/lead-engine-xlsx.ts';
import type { CellValue } from '../lib/lead-engine-xlsx.ts';

// Anas §8: refuse an export older than 31 days without an explicit override, and §3: xlsx plus CSV.
// The CSV is the List sheet of the same workbook, so both files always carry identical rows.

export interface Freshness { oldestVerifiedAt: string | null; staleRows: number; rows: number }

export async function jobFreshness(db: SupabaseClient, operator: string, jobId: string): Promise<Freshness> {
  const { data, error } = await db.rpc('lead_engine_job_freshness', { p_operator: operator, p_job: jobId });
  if (error) {
    if (['42883', 'PGRST202'].includes(error.code ?? '')) return { oldestVerifiedAt: null, staleRows: 0, rows: 0 };
    throw new LeadEngineError(503, 'storage_pending', 'The list freshness could not be checked.');
  }
  const row = (data ?? {}) as { oldest_verified_at?: string | null; stale_rows?: number; rows?: number };
  return { oldestVerifiedAt: row.oldest_verified_at ?? null, staleRows: Number(row.stale_rows ?? 0), rows: Number(row.rows ?? 0) };
}

export function assertFresh(freshness: Freshness, override: boolean): void {
  if (freshness.staleRows > 0 && !override) {
    throw new LeadEngineError(409, 'export_stale', `${freshness.staleRows} of ${freshness.rows} rows were verified more than 31 days ago. Re-verify (refresh) before dialing, or download with ?override=1 for email use only.`);
  }
}

const csvCell = (value: CellValue): string => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

// List sheet to CSV (UTF-8 with BOM so Excel opens it with the right encoding).
export function workbookListToCsv(bytes: Uint8Array): string {
  const sheets = readWorkbook(bytes);
  const list = sheets.find(sheet => sheet.name === 'List') ?? sheets[0];
  if (!list) throw new LeadEngineError(500, 'export_failed', 'The workbook has no List sheet.');
  // Trailing empty cells are not stored in the sheet XML; pad every row to the header width.
  const width = list.rows[0]?.length ?? 0;
  return '\ufeff' + list.rows.map(row => Array.from({ length: Math.max(width, row.length) }, (_, i) => csvCell(row[i] ?? null)).join(',')).join('\r\n') + '\r\n';
}
