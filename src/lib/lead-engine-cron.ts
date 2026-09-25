// Nightly ingest scheduling (Phase 2 task 1 "nightly", 01 §5 cadences). Pure: which registers are due
// today, in what order, so the cron route can spend its bounded time on the ones that matter.

export interface CronCandidate { source: string; cadence: string; lastSnapshotDate: string | null; runStatus: string | null; attentionReason: string | null }

const CADENCE_DAYS: Record<string, number> = { daily: 1, 'three times daily': 1, weekly: 7, monthly: 30, quarterly: 90, 'twice yearly': 182, biannual: 182 };

export function cadenceDays(cadence: string): number {
  const key = cadence.trim().toLowerCase();
  return CADENCE_DAYS[key] ?? 7;
}

// Due when never ingested, when the last snapshot is older than the cadence, or when a run is parked
// (needs_attention is retried once a day: the portal may be back). A run still marked running is
// continued, not restarted. Oldest snapshot first so a stuck source cannot starve the others.
export function dueSources(candidates: CronCandidate[], today: Date): CronCandidate[] {
  const dayMs = 86400000;
  const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const age = (date: string | null) => date ? Math.floor((midnight - Date.parse(`${date}T00:00:00Z`)) / dayMs) : Infinity;
  return candidates
    .filter(item => item.runStatus === 'running' || item.runStatus === 'draft' || item.runStatus === 'needs_attention' || age(item.lastSnapshotDate) >= cadenceDays(item.cadence))
    .sort((a, b) => {
      const running = (item: CronCandidate) => item.runStatus === 'running' || item.runStatus === 'draft' ? 0 : 1;
      return running(a) - running(b) || age(b.lastSnapshotDate) - age(a.lastSnapshotDate) || a.source.localeCompare(b.source);
    });
}
