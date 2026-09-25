'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FolderOpen, FolderPlus, Loader2 } from 'lucide-react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import { LeadEngineError } from '@/lib/lead-engine-storage';
import type { LeadFolder, LeadList } from '@/lib/lead-engine-scrape';
import { LeadTable } from './LeadTable';
import styles from './LeadTable.module.css';

// The lists tab opens straight into the leads themselves. Folders group the searches: one folder per
// industry, one list per city, which is how a scrape is already shaped.
async function call<T>(token: string, path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/lead-engine${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(25000),
  });
  const data = await response.json() as T & { error?: string; code?: string };
  if (!response.ok) throw new LeadEngineError(response.status, data.code ?? 'request_failed', data.error ?? 'That could not be loaded.');
  return data;
}

export function LeadLibrary() {
  const { token, user } = useWorkspaceAccess();
  if (!token || !user) return null;
  return <Library key={user.id} token={token} />;
}

function Library({ token }: { token: string }) {
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [lists, setLists] = useState<LeadList[] | null>(null);
  const [open, setOpen] = useState<LeadList | null>(null);
  const [folderName, setFolderName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [folderData, collected] = await Promise.all([
        call<{ folders: LeadFolder[] }>(token, '/folders'),
        (async () => {
          const all: LeadList[] = [];
          for (let offset = 0, guard = 0; guard < 20; guard++) {
            const page = await call<{ lists: LeadList[]; nextOffset: number | null }>(token, `/lists?offset=${offset}`);
            all.push(...page.lists);
            if (page.nextOffset === null) break;
            offset = page.nextOffset;
          }
          return all;
        })(),
      ]);
      setFolders(folderData.folders); setLists(collected);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Your lists could not be loaded.'); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function createFolder(): Promise<void> {
    const name = folderName.trim();
    if (!name) return;
    setBusy('folder'); setError('');
    try { await call(token, '/folders', { id: crypto.randomUUID(), name }); setFolderName(''); await load(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'That folder could not be created.'); }
    finally { setBusy(''); }
  }

  async function move(list: LeadList, folderId: string): Promise<void> {
    setBusy(list.id); setError('');
    try { await call(token, `/lists/${list.id}/move`, { folderId: folderId || null }); await load(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'That list could not be moved.'); }
    finally { setBusy(''); }
  }

  if (open) return <div>
    <button type="button" className={styles.backLink} onClick={() => setOpen(null)}><ArrowLeft size={15} />All lists</button>
    <LeadTable key={open.id} token={token} listId={open.id} listName={open.name} />
  </div>;

  if (!lists) return <p className={styles.loading}><Loader2 size={15} className={styles.spin} />Loading your lists…</p>;

  const groups: Array<{ id: string | null; name: string; lists: LeadList[] }> = [
    ...folders.map(folder => ({ id: folder.id, name: folder.name, lists: lists.filter(list => list.folderId === folder.id) })),
    { id: null, name: 'Unfiled', lists: lists.filter(list => !list.folderId) },
  ];

  return <div className={styles.panel}>
    <div className={styles.head}>
      <div><h3>Your lists</h3><p>One folder per industry, one list per city. Open any list to see its phone numbers.</p></div>
      <div className={styles.folderForm}>
        <input value={folderName} maxLength={80} placeholder="New folder, e.g. Roofing" onChange={event => setFolderName(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') void createFolder(); }} />
        <button type="button" className={styles.primary} disabled={!folderName.trim() || busy === 'folder'} onClick={() => void createFolder()}>
          {busy === 'folder' ? <Loader2 size={15} className={styles.spin} /> : <FolderPlus size={15} />}Create folder
        </button>
      </div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {lists.length === 0 && <p>No searches yet. Build one in the search tab and its leads appear here.</p>}

    {groups.filter(group => group.lists.length > 0 || group.id !== null).map(group => <section key={group.id ?? 'unfiled'} className={styles.group}>
      <h4>{group.name} <span>{group.lists.length} {group.lists.length === 1 ? 'list' : 'lists'}</span></h4>
      {group.lists.length === 0
        ? <p className={styles.emptyGroup}>Empty. Move a list here with its folder menu.</p>
        : <table className={styles.table}>
          <thead><tr><th>List</th><th>Businesses</th><th>Status</th><th>Folder</th><th /></tr></thead>
          <tbody>{group.lists.map(list => <tr key={list.id}>
            <td>{list.name}</td>
            <td>{list.processed} of {list.maxResults}</td>
            <td>{list.importStatus === 'complete' ? 'Collected' : list.importStatus === 'importing' ? 'Collecting…' : 'Waiting'}</td>
            <td><select aria-label={`Folder for ${list.name}`} value={list.folderId ?? ''} disabled={busy === list.id}
              onChange={event => void move(list, event.target.value)}>
              <option value="">Unfiled</option>
              {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select></td>
            <td><button type="button" className={styles.primary} onClick={() => setOpen(list)}><FolderOpen size={15} />Open leads</button></td>
          </tr>)}</tbody>
        </table>}
    </section>)}
  </div>;
}
