import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { database } from './integration.service';
import { ingestChunk, registerSummary, resumeRun } from './lead-engine-registers.service';
import { dueSources } from '../lib/lead-engine-cron';

// Nightly register ingest (Phase 2 task 1). Vercel Cron calls GET /api/lead-engine/registers/cron once a
// day with `Authorization: Bearer ${CRON_SECRET}`. The run is bounded (50 s) and resumable: each chunk
// saves its cursor, so tomorrow's run continues where today's stopped. Free endpoints only; nothing
// here touches a paid vendor, so no meter and no operator consent are involved.

export interface CronReport { operator: string | null; started: string; due: string[]; worked: Array<{ source: string; rowsSeen: number; rowsNamed: number; done: boolean; frozen: boolean; note: string | null }>; skipped: string; elapsedMs: number }

const BUDGET_MS = 50000;

export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// The ingest RPCs record who opened the run. The cron acts as the first active administrator.
async function systemOperator(db: SupabaseClient): Promise<string | null> {
  const configured = process.env.LEAD_ENGINE_CRON_OPERATOR_ID;
  if (configured && /^[0-9a-f-]{36}$/i.test(configured)) return configured.toLowerCase();
  const { data } = await db.from('nbc_members').select('id').eq('role', 'admin').eq('status', 'active').order('created_at').limit(1).maybeSingle();
  return data ? String((data as { id: string }).id) : null;
}

export async function runNightlyIngest(now: () => number = Date.now): Promise<CronReport> {
  const started = now();
  const db = database();
  const operator = await systemOperator(db);
  const report: CronReport = { operator, started: new Date(started).toISOString(), due: [], worked: [], skipped: '', elapsedMs: 0 };
  if (!operator) { report.skipped = 'No active administrator found to own the runs.'; report.elapsedMs = now() - started; return report; }
  const summary = await registerSummary(db);
  const due = dueSources(summary.sources.map(row => ({ source: row.source, cadence: row.cadence, lastSnapshotDate: row.lastSnapshotDate, runStatus: row.run?.status ?? null, attentionReason: row.run?.attentionReason ?? null })), new Date(started));
  report.due = due.map(item => item.source);
  for (const item of due) {
    if (now() - started > BUDGET_MS - 22000) { report.skipped = `Budget reached before ${item.source}; continues tomorrow.`; break; }
    try {
      if (item.runStatus === 'needs_attention') await resumeRun(db, operator, item.source);
      const chunk = await ingestChunk(db, operator, item.source, { budgetMs: 18000 });
      report.worked.push({ source: item.source, rowsSeen: chunk.rowsSeen, rowsNamed: chunk.rowsNamed, done: chunk.done, frozen: chunk.frozen, note: chunk.notes[0] ?? null });
    } catch (error) {
      report.worked.push({ source: item.source, rowsSeen: 0, rowsNamed: 0, done: false, frozen: true, note: error instanceof Error ? error.message.slice(0, 200) : 'failed' });
    }
  }
  report.elapsedMs = now() - started;
  return report;
}
