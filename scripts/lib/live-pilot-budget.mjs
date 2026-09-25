import { DatabaseSync } from 'node:sqlite';
import { chmodSync } from 'node:fs';

// One approved round, not a replenishing wallet or the production billing ledger.
export const ROUND = '2026-09-25-first-live-tests';
export const ALLOCATIONS = Object.freeze({
  'caller-1': 250, 'caller-2': 250,
  'roofing-miami': 200, 'roofing-charlotte': 200,
  'chiropractor-miami': 200, 'chiropractor-charlotte': 200,
  'medspa-miami': 600, 'medspa-charlotte': 600,
});
const PROVIDERS = new Set(['apify', 'batchdata', 'elevenlabs-twilio']);
const cents = value => Number.isSafeInteger(value) && value > 0;
export function openPilotBudget(path, { initialize = false } = {}) {
  const db = new DatabaseSync(path, { open: true });
  chmodSync(path, 0o600);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  try {
    if (initialize) transaction(() => {
      db.exec(`CREATE TABLE IF NOT EXISTS round (id TEXT PRIMARY KEY, cap_cents INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS allocation (id TEXT PRIMARY KEY, cap_cents INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS operation (
          id TEXT PRIMARY KEY, allocation TEXT NOT NULL REFERENCES allocation(id), provider TEXT NOT NULL,
          reserved_cents INTEGER NOT NULL CHECK(reserved_cents > 0), state TEXT NOT NULL,
          created_at TEXT NOT NULL, receipt TEXT, actual_usd REAL);`);
      db.prepare('INSERT OR IGNORE INTO round VALUES (?, 2500)').run(ROUND);
      for (const [id, cap] of Object.entries(ALLOCATIONS)) db.prepare('INSERT OR IGNORE INTO allocation VALUES (?, ?)').run(id, cap);
    });
    const round = db.prepare('SELECT * FROM round').all();
    const allocations = db.prepare('SELECT * FROM allocation').all();
    if (round.length !== 1 || round[0].id !== ROUND || round[0].cap_cents !== 2500
      || allocations.length !== Object.keys(ALLOCATIONS).length
      || allocations.some(row => ALLOCATIONS[row.id] !== row.cap_cents)) throw Error('Pilot approval ledger mismatch. Execution blocked.');
  } catch (error) { db.close(); throw error; }
  return {
    reserve(id, allocation, provider, capCents) {
      if (!/^[a-z0-9:-]{1,100}$/.test(id) || !Object.hasOwn(ALLOCATIONS, allocation)
        || !PROVIDERS.has(provider) || !cents(capCents)
        || (allocation.startsWith('caller-') !== (provider === 'elevenlabs-twilio'))) throw Error('Invalid pilot reservation.');
      return transaction(() => {
        if (db.prepare('SELECT id FROM operation WHERE id=?').get(id)) throw Error('This operation already has a reservation. Reconcile it; do not dispatch again.');
        const total = db.prepare('SELECT COALESCE(SUM(reserved_cents),0) AS n FROM operation').get().n;
        const allocated = db.prepare('SELECT COALESCE(SUM(reserved_cents),0) AS n FROM operation WHERE allocation=?').get(allocation).n;
        if (total + capCents > 2500 || allocated + capCents > ALLOCATIONS[allocation]) throw Error('Approved pilot budget exceeded. Execution blocked.');
        db.prepare('INSERT INTO operation(id,allocation,provider,reserved_cents,state,created_at) VALUES(?,?,?,?,?,?)')
          .run(id, allocation, provider, capCents, 'dispatching', new Date().toISOString());
        return { id, reservedCents: capCents };
      });
    },
    observe(id, state, receipt, actualUsd = null) {
      if (!['running', 'uncertain', 'completed', 'failed'].includes(state)
        || (actualUsd !== null && (!Number.isFinite(actualUsd) || actualUsd < 0))) throw Error('Invalid pilot receipt.');
      const body = JSON.stringify(receipt);
      if (body.length > 100000) throw Error('Receipt too large.');
      return transaction(() => {
        const old = db.prepare('SELECT * FROM operation WHERE id=?').get(id);
        if (!old) throw Error('No reservation for receipt.');
        if (['completed', 'failed'].includes(old.state) && old.state !== state) throw Error('Terminal receipt cannot regress.');
        if (actualUsd !== null && actualUsd * 100 > old.reserved_cents + 0.000001) throw Error('Provider cost exceeds reservation. Stop and investigate.');
        db.prepare('UPDATE operation SET state=?,receipt=?,actual_usd=COALESCE(?,actual_usd) WHERE id=?').run(state, body, actualUsd, id);
      });
    },
    get(id) { const row = db.prepare('SELECT * FROM operation WHERE id=?').get(id); return row ? { ...row, receipt: row.receipt ? JSON.parse(row.receipt) : null } : null; },
    summary() {
      const rows = db.prepare('SELECT id,allocation,provider,reserved_cents,state,actual_usd FROM operation ORDER BY created_at').all();
      return { round: ROUND, limitUsd: 25, reservedUsd: rows.reduce((n, row) => n + row.reserved_cents, 0) / 100,
        reportedUsageUsd: rows.reduce((n, row) => n + (row.actual_usd ?? 0), 0), pendingReceipts: rows.filter(row => row.actual_usd === null).length, operations: rows };
    },
    close() { db.close(); },
  };
}
