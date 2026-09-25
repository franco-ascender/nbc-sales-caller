export const WORKSPACE_SESSION_KEY = 'nbc-workspace-session-v1';
export const WORKSPACE_SESSION_MS = 12 * 60 * 60 * 1000;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface SavedSession { expiresAt: number; value: string | null }

/** Only an explicit password login may start the fixed restoration window. */
export class WorkspaceSessionStorage {
  private readonly storage: () => Store;
  private readonly now: () => number;
  constructor(storage: () => Store, now: () => number = Date.now) { this.storage = storage; this.now = now; }
  private read(): SavedSession | null {
    try {
      const raw = this.storage().getItem(WORKSPACE_SESSION_KEY);
      if (!raw) return null;
      const entry: unknown = JSON.parse(raw);
      if (typeof entry !== 'object' || entry === null || !('expiresAt' in entry) || !('value' in entry)) return null;
      const { expiresAt, value } = entry;
      if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= this.now() || expiresAt > this.now() + WORKSPACE_SESSION_MS || (value !== null && typeof value !== 'string')) return null;
      return { expiresAt, value };
    } catch { return null; }
  }
  begin(): void {
    this.storage().setItem(WORKSPACE_SESSION_KEY, JSON.stringify({ expiresAt: this.now() + WORKSPACE_SESSION_MS, value: null }));
  }
  remaining(): number { const entry = this.read(); return entry ? Math.max(0, entry.expiresAt - this.now()) : 0; }
  getItem(key: string): string | null { return key === WORKSPACE_SESSION_KEY ? this.read()?.value ?? null : null; }
  setItem(key: string, value: string): void {
    if (key !== WORKSPACE_SESSION_KEY) return;
    const entry = this.read();
    // A late refresh must never recreate a session cleared by logout or expiry.
    if (entry) this.storage().setItem(key, JSON.stringify({ ...entry, value }));
  }
  removeItem(key: string): void { if (key === WORKSPACE_SESSION_KEY) this.clear(); }
  clear(): void { try { this.storage().removeItem(WORKSPACE_SESSION_KEY); } catch { /* Browser storage can be disabled. Access still closes in memory. */ } }
  matches(token: string): boolean {
    try { const value = this.getItem(WORKSPACE_SESSION_KEY); return Boolean(value && JSON.parse(value).access_token === token); } catch { return false; }
  }
}
