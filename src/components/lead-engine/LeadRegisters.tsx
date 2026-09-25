'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, Loader2, Play, RefreshCw } from 'lucide-react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import { LeadEngineError } from '@/lib/lead-engine-storage';
import styles from './LeadJobs.module.css';

// Phase 2: the free registers (the identity layer). Each source ingests in bounded chunks; the browser
// loops one chunk at a time so a serverless timeout never loses a page. Nothing here costs money.

interface RegisterRun { id: string; status: string; rowsSeen: number; rowsNamed: number; rowsSkipped: number; attentionReason: string | null; updatedAt: string | null }
interface RegisterSummary {
  source: string; label: string; state: string | null; recipe: string; cadence: string; names: number; withPhone: number; dialable: number;
  lastSnapshotDate: string | null; snapshotRows: number; run: RegisterRun | null;
}
interface ChunkResult { done: boolean; frozen: boolean; rowsSeen: number; rowsNamed: number; rowsSkipped?: number }

async function call<T>(token: string, path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/lead-engine${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(65000),
  });
  const data = await response.json() as T & { error?: string; code?: string };
  if (!response.ok) throw new LeadEngineError(response.status, data.code ?? 'request_failed', data.error ?? 'That step could not be completed.');
  return data;
}

export function LeadRegisters() {
  const { token, user } = useWorkspaceAccess();
  if (!token || !user) return null;
  return <Registers key={user.id} token={token} />;
}

function Registers({ token }: { token: string }) {
  const [rows, setRows] = useState<RegisterSummary[] | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [log, setLog] = useState<Record<string, string>>({});
  const stop = useRef(false);

  const load = useCallback(async () => {
    setError('');
    try { setRows((await call<{ sources: RegisterSummary[] }>(token, '/registers')).sources); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The registers could not be loaded.'); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function ingest(source: string, resume = false): Promise<void> {
    if (running) return;
    setRunning(source); stop.current = false; setError('');
    try {
      if (resume) await call(token, `/registers/${source}/resume`, {});
      for (let guard = 0; guard < 2000 && !stop.current; guard++) {
        const chunk = await call<ChunkResult>(token, `/registers/${source}/ingest`, {});
        setLog(previous => ({ ...previous, [source]: `${chunk.rowsSeen.toLocaleString('en-US')} rows read, ${chunk.rowsNamed.toLocaleString('en-US')} owners named${chunk.rowsSkipped ? `, ${chunk.rowsSkipped} skipped` : ''}${chunk.done ? '. Done.' : '…'}` }));
        if (chunk.done || chunk.frozen) break;
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The ingest stopped. The cursor is saved; press Resume.'); }
    finally { setRunning(null); await load(); }
  }

  return <section className={styles.panel}>
    <div className={styles.topline}>
      <div><h3>Registers (free identity layer)</h3><p>State and federal files that name the human owner, ingested in chunks into <code>lead_engine_names</code> with a snapshot per day. Recipe C sells these phones after one verify; recipe D contrasts them with Google Maps. No vendor spend here.</p></div>
      <button type="button" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!rows ? <p className={styles.log}>Loading…</p> : <table className={styles.jobs}>
      <thead><tr><th>Register</th><th>State</th><th>Recipe</th><th>Owners named</th><th>With phone</th><th>Last snapshot</th><th>Run</th><th /></tr></thead>
      <tbody>{rows.map(row => <tr key={row.source}>
        <td><Database size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />{row.label} <small style={{ color: 'var(--muted)' }}>{row.source}</small></td>
        <td>{row.state ?? 'US'}</td><td>{row.recipe}</td>
        <td>{row.names.toLocaleString('en-US')}</td><td>{row.withPhone.toLocaleString('en-US')}</td>
        <td>{row.lastSnapshotDate ?? 'never'}</td>
        <td>{row.run ? <span className={styles.status} data-status={row.run.status === 'done' ? 'delivered' : row.run.status}>{row.run.status}</span> : ''}{log[row.source] && <small style={{ display: 'block', color: 'var(--muted)' }}>{log[row.source]}</small>}{row.run?.attentionReason && <small style={{ display: 'block', color: '#c0392b' }}>{row.run.attentionReason}</small>}</td>
        <td>{running === row.source
          ? <button type="button" onClick={() => { stop.current = true; }}><Loader2 size={14} className={styles.spin} /> Running… click to pause</button>
          : row.run && row.run.status !== 'done'
            ? <button type="button" className={styles.primary} disabled={Boolean(running)} onClick={() => void ingest(row.source, row.run?.status === 'needs_attention')}><Play size={14} /> Resume</button>
            : <button type="button" className={styles.primary} disabled={Boolean(running)} onClick={() => void ingest(row.source)}><Play size={14} /> Ingest</button>}
        </td>
      </tr>)}</tbody>
    </table>}
    <p className={styles.log} style={{ marginTop: 12 }}>Legal gates from the brain apply per state: South Carolina and Utah licensee lists are never ingested; Washington is defensible but restricted (ledger evidence kept); California CSLB terms are pending a read. New York childcare rows with the omission flag are honored as opt outs.</p>
  </section>;
}
