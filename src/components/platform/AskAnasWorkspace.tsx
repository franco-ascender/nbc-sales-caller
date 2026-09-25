'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BookOpen, Compass, FileText } from 'lucide-react';
import { AcademyLibraryPanel } from './AcademyWorkspace';
import { useAcademyLibrary } from '@/lib/academy-use-library';
import { keepAcademyDraft, readAcademyDraft, setAcademyDraftOwner } from '@/lib/academy-draft';
import { knowledgeSources } from '@/lib/knowledge-sources';
import { academyClient } from '@/services/academy-client';
import type { AcademyDocument, AcademyDraft, AcademyRevisionPage } from '@/lib/academy-storage-types';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import styles from './AskAnas.module.css';

export function AskAnasWorkspace(): ReactNode {
  const { user } = useWorkspaceAccess();
  if (user?.role !== 'admin') return <div className={styles.page}><header><h1>Ask Anas</h1><p>Your learning companion is being prepared. It will be available here when it is ready.</p></header></div>;
  return <AskAnasAdminWorkspace key={user.id} owner={user.id} />;
}
function AskAnasAdminWorkspace({ owner }: { owner: string }): ReactNode {
  const library = useAcademyLibrary();
  const [document, setDocument] = useState<AcademyDocument | AcademyDraft | null>(null);
  const [local, setLocal] = useState(false);
  const [history, setHistory] = useState<AcademyRevisionPage | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [visible, setVisible] = useState(20);
  const generation = useRef(0);
  useEffect(() => { setAcademyDraftOwner(owner); const draft = readAcademyDraft(); if (draft) { setDocument(draft); setLocal(true); } return () => { generation.current++; }; }, [owner]);
  async function open(id: string, revision?: number): Promise<void> {
    const attempt = ++generation.current; setBusy(true); setError('');
    try {
      const next = await academyClient.read(library.token, id, revision);
      if (attempt !== generation.current) return;
      setDocument(next); setLocal(false); setVisible(20); setHistory(null);
      const revisions = await academyClient.revisions(library.token, id);
      if (attempt === generation.current) setHistory(revisions);
    } catch (failure) { if (attempt === generation.current) setError(failure instanceof Error ? failure.message : 'Sources could not be loaded.'); }
    finally { if (attempt === generation.current) setBusy(false); }
  }
  async function moreHistory(): Promise<void> {
    if (!document || history?.nextOffset == null) return;
    const attempt = ++generation.current; setBusy(true); setError('');
    try { const next = await academyClient.revisions(library.token, document.id, history.nextOffset); if (attempt === generation.current) setHistory(next); }
    catch (failure) { if (attempt === generation.current) setError(failure instanceof Error ? failure.message : 'Revision list could not be loaded.'); }
    finally { if (attempt === generation.current) setBusy(false); }
  }
  const sources = document ? knowledgeSources(document.manifest, document.origin) : [];
  return <div className={styles.page}>
    <header><p className={styles.eyebrow}>ASK ANAS</p><h1>The methodology, within reach.</h1><p>Review the curriculum and the material still needed for a source-backed guide.</p></header>
    <section className={styles.hero}><Compass size={44} aria-hidden="true" /><div><h2>Source preparation</h2><p>Ask Anas is being prepared. Questions are not available yet. No lesson content or transcripts have been ingested, and no answers have been generated.</p></div></section>
    <AcademyLibraryPanel library={library} blocked={busy} onOpen={id => void open(id)} onLogout={() => { if (readAcademyDraft()?.dirty && !window.confirm('Clear the unsaved Academy draft? Export it in Academy first if you need to keep it.')) return; generation.current++; library.logout(); keepAcademyDraft(null); setDocument(null); setHistory(null); setError(''); }} />
    {busy && <p role="status">Loading sources…</p>}{error && <p role="alert" className={styles.notice}>{error}</p>}
    <section className={styles.panel}><div className={styles.heading}><div><p className={styles.eyebrow}>TRACEABLE INVENTORY</p><h2>{document?.name ?? 'No inventory selected'}</h2></div><Link href="/academy">Open Academy →</Link></div>
      {document ? <><p className={styles.notice}>{local ? 'Local browser draft · not verified against current storage' : `Saved inventory · revision ${document.revision}`}<br />{sources.length} lesson records · metadata only</p><p className={styles.reference}>Inventory: {document.id} · {document.revision ? `Base revision: ${document.revision}` : 'No saved revision'}<br />Origin: {document.origin.label}{document.origin.url && <><br />{document.origin.url}</>}</p>
        {history && <div className={styles.history}><span>Recorded revisions</span>{history.revisions.map(item => <button key={item.revision} disabled={busy || item.revision === document.revision} onClick={() => void open(document.id, item.revision)}>Revision {item.revision}</button>)}{history.nextOffset !== null && <button disabled={busy} onClick={() => void moreHistory()}>Older revisions</button>}</div>}
        {sources.length === 0 && <p>This inventory has no lessons. Add lesson metadata in Academy before preparing sources.</p>}
        <div className={styles.sources}>{sources.slice(0, visible).map(source => <article key={source.lessonId}><div className={styles.sourceTitle}><BookOpen size={20} aria-hidden="true" /><h3>{source.path}</h3></div><p className={styles.reference}>Course {source.courseId} · Module {source.moduleId} · Lesson {source.lessonId}</p><dl><div><dt>Metadata registered</dt><dd>Course hierarchy and lesson title are recorded{local ? ' in this local draft' : ` in revision ${document.revision}`}.</dd></div><div><dt>Video reference</dt><dd>{source.videoReason}{source.videoUrl && <span className={styles.reference}>{source.videoUrl}</span>}</dd></div><div><dt>Content pending</dt><dd>{source.contentReason}</dd></div><div><dt>Transcript not yet available</dt><dd>{source.transcriptReason}</dd></div></dl></article>)}</div>{visible < sources.length && <button onClick={() => setVisible(value => value + 20)}>Show more lesson sources</button>}
      </> : <div className={styles.empty}><FileText size={32} aria-hidden="true" /><h3>Start with a course inventory.</h3><p>Import a manifest in Academy or sign in above and open a saved inventory. No source records are assumed.</p></div>}
    </section>
    <section className={styles.panel}><h2>What is still needed</h2><ul className={styles.needs}><li>A real Skool inventory and authorized files or access.</li><li>Source videos and transcripts, with provenance and permission to use them.</li><li>Agreed video storage and student access rules.</li><li>Anas’s review, reference questions and approved answers for evaluation.</li></ul><p>Registering metadata does not migrate videos or enable student access. External references are displayed as text; this page does not fetch them.</p></section>
  </div>;
}
