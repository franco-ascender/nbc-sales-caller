'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Captions, Check, CheckCircle2, Circle, VideoOff, ImagePlus, ChevronUp, ChevronDown, Trash2, ChevronRight, Download, Eye, FileText, List, NotebookPen, Pencil, Plus, Search, Upload, X } from 'lucide-react';
import { ACADEMY_TEMPLATE, MAX_MANIFEST_BYTES, academyInventory } from '@/lib/academy-manifest';
import { editAcademyDraft, importAcademyDraft, keepAcademyDraft, keepAcademyEditor, setAcademyDraftOwner, openAcademyDraft, readAcademyDraft, readAcademyEditor } from '@/lib/academy-draft';
import { useAcademyLibrary } from '@/lib/academy-use-library';
import { parseAcademySave } from '@/lib/academy-validation';
import { academyClient } from '@/services/academy-client';
import { ACADEMY_CSV_TEMPLATE, parseAcademyTable, upsertAcademyItem } from '@/lib/academy-import';
import type { AcademyItemEdit } from '@/lib/academy-import';
import { ACADEMY_DEMO, ACADEMY_DEMO_DESCRIPTIONS, demoCaptions, demoTranscript, demoWorksheet } from '@/lib/academy-demo';
import type { AcademyManifest, AcademyCourse } from '@/lib/academy-types';
import type { AcademyDraft } from '@/lib/academy-storage-types';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import { academyCourseProgress } from '@/lib/academy-progress';
import { nbcProgramOutline, changeCourseDetails, changeProgramOrder } from '@/lib/academy-program';
import { prepareAcademyCover } from '@/lib/academy-cover';
import { readAcademyCovers, keepAcademyCovers } from '@/lib/academy-cover-draft';
import type { AcademyLocalCover } from '@/lib/academy-cover-draft';
import styles from './Academy.module.css';

function downloadManifest(manifest: AcademyManifest, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AcademyLibraryPanel({ library, blocked, onOpen, onLogout }: {
  library: ReturnType<typeof useAcademyLibrary>; blocked: boolean; onOpen: (id: string) => void; onLogout: () => void;
}): ReactNode {
  const disabled = blocked || library.busy;
  if (!library.token) return null;
  return <section className={styles.panel} aria-label="Saved inventories"><h2>Saved inventories</h2><p>Admin only · versioned curriculum</p>
    <div className={styles.actions}><button disabled={disabled} onClick={() => void library.refresh()}>Refresh saved inventories</button><button disabled={disabled} onClick={onLogout}>Clear local draft</button></div>
    {library.page && <><ul className={styles.savedList}>{library.page.inventories.map(item => <li key={item.id}><div><strong>{item.name}</strong><small>Revision {item.revision} · {new Date(item.updatedAt).toLocaleString()}</small></div><button disabled={disabled} onClick={() => onOpen(item.id)}>Open <span className={styles.srOnly}>{item.name}</span></button></li>)}</ul>{library.page.inventories.length === 0 && <p>No saved inventories yet.</p>}{library.page.nextOffset !== null && <button disabled={disabled} onClick={() => void library.refresh(library.page!.nextOffset!)}>Next inventories</button>}</>}
    {library.busy && <p role="status">Loading inventory library…</p>}{library.error && <p role="alert" className={styles.notice}>{library.error}</p>}
  </section>;
}

function downloadText(text: string, filename: string, type = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CourseProgress({ course, completed }: { course: AcademyCourse; completed: ReadonlySet<string> }): ReactNode {
  const progress = academyCourseProgress(course, completed);
  return <div className={styles.progressBlock}>
    <div className={styles.progressCaption}><span>{progress.done} of {progress.total} lessons completed</span><strong>{progress.percent}%</strong></div>
    <progress aria-label={`${course.title} progress`} max={100} value={progress.percent}>{progress.percent}%</progress>
  </div>;
}

function CourseCover({ course, localUrl }: { course: AcademyCourse; localUrl?: string }): ReactNode {
  const { token } = useWorkspaceAccess();
  const [remote, setRemote] = useState(''); const [failed, setFailed] = useState(false);
  useEffect(() => {
    setRemote(''); setFailed(false);
    if (localUrl || !course.coverId || !token) return;
    const controller = new AbortController(); let url = '';
    void fetch(`/api/academy/covers/${course.coverId}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok || response.headers.get('content-type') !== 'image/jpeg') throw new Error('Cover unavailable');
      const blob = await response.blob(); if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob); setRemote(url);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [course.coverId, localUrl, token]);
  return localUrl || remote ? <img className={styles.coverImage} src={localUrl || remote} alt="" width={1280} height={720} /> : <span className={styles.coursePlaceholder}><ImagePlus size={28} strokeWidth={1.3} /><span>{failed ? 'Cover unavailable' : course.coverId ? 'Loading cover…' : 'Course cover'}</span></span>;
}

function AcademyCatalog({ manifest, demo, completed = new Set<string>(), covers = {}, onOpen, onEdit }: { manifest: AcademyManifest; demo: boolean; completed?: ReadonlySet<string>; covers?: Record<string, AcademyLocalCover>; onOpen: (id: string) => void; onEdit?: (id: string) => void }): ReactNode {
  const [query, setQuery] = useState('');
  const courses = manifest.courses.filter(course => course.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <>
    <div className={styles.catalogToolbar}><span>{manifest.courses.length} courses</span><label className={styles.search}><Search size={18} /><span className={styles.srOnly}>Search courses</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search courses" /></label></div>
    <div className={styles.catalog}>{courses.map((course) => {
      const progress = academyCourseProgress(course, completed);
      return <article key={course.id} className={styles.catalogCard}><button className={styles.courseCard} onClick={() => onOpen(course.id)} aria-label={`${demo ? 'Explore course' : 'Preview course'}: ${course.title}`}>
        <CourseCover course={course} localUrl={covers[course.id]?.url} />
        <span className={styles.cardBody}><strong>{course.title}</strong><span className={styles.cardDescription}>{demo ? ACADEMY_DEMO_DESCRIPTIONS[course.id] : course.description || `${course.modules.length} modules · ${progress.total} lessons`}</span>
          <span className={styles.cardProgress}><span>{demo ? `${progress.percent}% complete` : 'Unpublished curriculum'}</span><progress aria-label={`${course.title} progress`} value={progress.percent} max={100}>{progress.percent}%</progress></span>
        </span>
      </button>{onEdit && <button className={styles.cardEdit} onClick={() => onEdit(course.id)} aria-label={`Edit course ${course.title}`}><Pencil size={14} />Edit course</button>}</article>;
    })}</div>
    {!courses.length && <p className={styles.note}>No courses match your search.</p>}
  </>;
}

function AcademyExperience({ manifest, demo, initialCourse, covers = {}, onExit }: { manifest: AcademyManifest; demo: boolean; initialCourse: string | null; covers?: Record<string, AcademyLocalCover>; onExit: () => void }): ReactNode {
  const [courseId, setCourseId] = useState<string | null>(initialCourse);
  const [lastLessons, setLastLessons] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState('Overview');
  const [captions, setCaptions] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteStatus, setNoteStatus] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const course = manifest.courses.find(item => item.id === courseId);
  const lessons = course?.modules.flatMap(module => module.lessons) ?? [];
  const lesson = lessons.find(item => item.id === lastLessons[courseId ?? '']) ?? lessons.find(item => !completed.has(item.id)) ?? lessons[0];
  const selectedModule = course?.modules.find(module => module.lessons.some(item => item.id === lesson?.id));
  const lessonIndex = lessons.findIndex(item => item.id === lesson?.id);
  function chooseLesson(id: string): void {
    if (!courseId) return;
    setLastLessons(value => ({ ...value, [courseId]: id })); setNoteStatus(''); setCaptions(false);
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }
  function leave(): void {
    if (Object.values(notes).some(Boolean) && !window.confirm('Leave this preview? Demo notes are kept only while it is open. Download any notes you want to keep.')) return;
    onExit();
  }
  return <div className={styles.page}>
    <div className={styles.previewBanner}><span><Eye size={16} /><strong>{demo ? 'Student preview · Demo' : 'Curriculum preview'}</strong><span>{demo ? 'Sample courses. Progress and notes reset when you leave.' : 'Unpublished · lesson content is still pending.'}</span></span><button onClick={leave}><X size={15} />Exit preview</button></div>
    {!course ? <><header className={styles.libraryHeading}><div><h1>Classroom</h1><p>Pick a course and take the next step.</p></div></header><AcademyCatalog manifest={manifest} demo={demo} covers={covers} completed={completed} onOpen={setCourseId} /></> : <>
      <div className={styles.classroomTop}><button className={styles.textButton} onClick={() => setCourseId(null)}><ArrowLeft size={17} />All courses</button><span>{course.title}</span></div>
      <div className={styles.classroom}>
        <aside className={styles.syllabus} aria-label="Course curriculum">
          <h2>{course.title}</h2><CourseProgress course={course} completed={completed} />
          <div className={styles.moduleIndex}>{course.modules.map((module) => <details key={module.id} open>
            <summary><strong>{module.title}</strong><span>{module.lessons.filter(item => completed.has(item.id)).length}/{module.lessons.length}</span><ChevronRight size={16} /></summary>
            <ol>{module.lessons.map(item => <li key={item.id}><button className={item.id === lesson?.id ? styles.activeLesson : ''} aria-current={item.id === lesson?.id ? 'step' : undefined} onClick={() => chooseLesson(item.id)}>
              <span>{item.title}</span>{completed.has(item.id) ? <CheckCircle2 className={styles.completedIcon} size={20} aria-label="Completed" /> : <Circle size={18} className={styles.pendingIcon} aria-hidden="true" />}
            </button></li>)}</ol>
          </details>)}</div>
        </aside>
        <div className={styles.lessonMain}>{lesson ? <>
          <div className={styles.lessonHeading}><div><p>{selectedModule?.title}</p><h1 tabIndex={-1} ref={heading}>{lesson.title}</h1></div>
            {demo && <button className={`${styles.completeButton} ${completed.has(lesson.id) ? styles.isComplete : ''}`} aria-pressed={completed.has(lesson.id)} onClick={() => { setLastLessons(value => ({ ...value, [course.id]: lesson.id })); setCompleted(value => { const next = new Set(value); if (next.has(lesson.id)) next.delete(lesson.id); else next.add(lesson.id); return next; }); }}><CheckCircle2 size={19} />{completed.has(lesson.id) ? 'Completed' : 'Mark complete'}</button>}
          </div>
          <div className={styles.lessonPoster} aria-label={demo ? 'Demo video placeholder. No video connected.' : 'Video content pending.'}>
            <VideoOff size={38} strokeWidth={1.3} /><strong>{demo ? 'Your lesson video goes here' : 'Video coming soon'}</strong><span>{demo ? 'Preview only · no video has been added' : 'Your team has not added this video yet.'}</span>
            {captions && <div className={styles.captionSample}>Sample caption: Begin with one question you want to answer.</div>}
          </div>
          {demo && <div className={styles.playerTools}><span>Sample lesson</span><button aria-pressed={captions} onClick={() => setCaptions(value => !value)}><Captions size={17} />{captions ? 'Hide sample subtitles' : 'Preview subtitles'}</button></div>}
          <div className={styles.lessonTabs} role="tablist" aria-label="Lesson materials">{['Overview', 'Transcript', 'Resources', 'My notes'].map((name, index) => <button key={name} role="tab" id={`academy-tab-${index}`} aria-controls={`academy-panel-${index}`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={event => { const tabs = ['Overview', 'Transcript', 'Resources', 'My notes']; if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4; setTab(tabs[next]); document.getElementById(`academy-tab-${next}`)?.focus(); }}>{name}</button>)}</div>
          <section className={styles.lessonPanel} role="tabpanel" id={`academy-panel-${['Overview', 'Transcript', 'Resources', 'My notes'].indexOf(tab)}`} aria-labelledby={`academy-tab-${['Overview', 'Transcript', 'Resources', 'My notes'].indexOf(tab)}`}>
            {tab === 'Overview' && <><p className={styles.eyebrow}>{demo ? 'About this lesson' : 'Lesson material'}</p><h2>{demo ? 'A place to start' : 'Lesson content coming soon'}</h2><p>{demo ? 'Use this sample lesson to explore the student experience. Read the illustrative transcript, download a practice sheet, and keep a few notes as you go.' : 'The lesson title is in your inventory. Connect the authorized video, transcript and supporting files before publishing it for students.'}</p>{!demo && <p className={styles.reference}>{lesson.videoUrl ? `Video reference registered, not verified: ${lesson.videoUrl}` : 'Video reference still needed.'}</p>}<div className={styles.lessonCallout}><NotebookPen size={21} /><div><strong>A little reflection goes a long way.</strong><p>{demo ? 'Open My notes and write down one idea you want to revisit. Notes in this preview stay in memory only.' : 'Private notes will be available once student access and note storage are connected.'}</p></div></div></>}
            {tab === 'Transcript' && <><div className={styles.row}><div><h2>Lesson transcript</h2><p>{demo ? 'Illustrative text · not a transcript of a real video' : 'No transcript is available for this lesson yet.'}</p></div>{demo && <button onClick={() => downloadText(demoTranscript(lesson.title), `${lesson.id}-demo-transcript.txt`)}><Download size={16} />Download sample transcript</button>}</div>{demo && <><div className={styles.transcript}>{[['00:00', 'Begin with one question you want this practice session to answer. Write it down before the conversation.'], ['00:12', 'Listen for the other person’s priorities. Use your notes to separate what you heard from what you assumed.'], ['00:24', 'At the end, summarize what you learned and choose one thing to practice next.']].map(([time, text]) => <p key={time}><span>{time}</span>{text}</p>)}</div><button className={styles.textButton} onClick={() => downloadText(demoCaptions(), `${lesson.id}-demo-captions.vtt`, 'text/vtt')}><Captions size={16} />Download sample captions (.vtt)</button></>}</>}
            {tab === 'Resources' && <><h2>Lesson resources</h2><p>{demo ? 'An original sample resource for this interface preview.' : 'No resources have been attached to this lesson yet.'}</p>{demo && <div className={styles.resourceCard}><span className={styles.fileIcon}><FileText size={24} /></span><div><strong>Reflection & practice sheet</strong><p>TXT · Demonstration resource</p></div><button aria-label="Download sample practice sheet" onClick={() => downloadText(demoWorksheet(lesson.title), `${lesson.id}-demo-worksheet.txt`)}><Download size={18} /></button></div>}</>}
            {tab === 'My notes' && <><div className={styles.row}><div><h2>My notes</h2><p>{demo ? 'Private to this preview session · not saved to an account' : 'Student notes are not connected yet.'}</p></div><NotebookPen size={23} /></div>{demo ? <><label className={styles.notepad}><span className={styles.srOnly}>Notes for {lesson.title}</span><textarea maxLength={20000} rows={8} placeholder="What stood out? What will you try next?" value={notes[lesson.id] ?? ''} onChange={event => { setNotes(value => ({ ...value, [lesson.id]: event.target.value })); setNoteStatus('Kept in this preview session only. Download before leaving.'); }} /></label><div className={styles.notesFooter}><span role="status">{noteStatus || 'Notes stay separate for each lesson.'}</span><button disabled={!notes[lesson.id]?.trim()} onClick={() => downloadText(`DEMO SESSION NOTES — ${lesson.title}\n\n${notes[lesson.id]}`, `${lesson.id}-notes.txt`)}><Download size={16} />Download my notes</button></div></> : <p>Notes will belong to each signed-in student and each lesson. No personal notes are stored in this inventory preview.</p>}</>}
          </section>
          <div className={styles.lessonNavigation}><button disabled={lessonIndex <= 0} onClick={() => chooseLesson(lessons[lessonIndex - 1].id)}><ArrowLeft size={16} />Previous lesson</button><span>Take it at your own pace.</span><button disabled={lessonIndex >= lessons.length - 1} onClick={() => chooseLesson(lessons[lessonIndex + 1].id)}>Next lesson<ArrowRight size={16} /></button></div>
        </> : <div className={styles.empty}><h2>No lessons in this course yet.</h2><p>Add lessons in Edit program to preview the classroom.</p></div>}</div>
      </div></>}
  </div>;
}

export function AcademyWorkspace(): ReactNode {
  const { user } = useWorkspaceAccess();
  if (user?.role !== 'admin') return <div className={styles.page}><header className={styles.workspaceHeading}><div><h1>Classroom</h1><p>Your courses, one lesson at a time.</p></div></header><section className={styles.studentEmpty}><BookOpen size={36} strokeWidth={1.3} /><h2>Your classroom is getting ready</h2><p>Your courses will appear here when your team publishes them.</p></section></div>;
  return <AcademyAdminWorkspace key={user.id} owner={user.id} />;
}

function AcademyAdminWorkspace({ owner }: { owner: string }): ReactNode {
  const [draft, setDraft] = useState<AcademyDraft | null>(null);
  const [editor, setEditor] = useState('');
  const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const tableInput = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<'library' | 'manage'>('library');
  const [previewMode, setPreviewMode] = useState<'demo' | 'inventory' | null>(null);
  const [initialCourse, setInitialCourse] = useState<string | null>(null);
  const [tableText, setTableText] = useState('');
  const [tableName, setTableName] = useState('Imported program');
  const [tablePreview, setTablePreview] = useState<AcademyManifest | null>(null);
  const [tableError, setTableError] = useState('');
  const [editTarget, setEditTarget] = useState<AcademyItemEdit | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailEdits, setDetailEdits] = useState<Record<string, { title: string; description: string }>>({});
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, AcademyLocalCover>>({});
  const [coverBusy, setCoverBusy] = useState(false);
  const selected = draft?.manifest.courses.find(item => item.id === selectedCourse) ?? draft?.manifest.courses[0];
  const coverInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const library = useAcademyLibrary();
  const inventory = academyInventory(draft?.manifest ?? null);
  const editorChanged = Boolean(draft && editor !== JSON.stringify(draft.manifest, null, 2));
  const unsaved = Boolean(draft?.dirty || editorChanged || Object.keys(detailEdits).length || editTarget);
  const disabled = busy || library.busy || coverBusy;
  useEffect(() => {
    setAcademyDraftOwner(owner);
    const saved = readAcademyDraft(); setDraft(saved); setCovers(saved ? readAcademyCovers(saved.id) : {}); setEditor(saved ? readAcademyEditor() ?? JSON.stringify(saved.manifest, null, 2) : '');
    return () => { generation.current++; };
  }, [owner]);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);
  function replace(next: AcademyDraft): void { if (draft && draft.id !== next.id) keepAcademyCovers(draft.id, {}); setCovers(readAcademyCovers(next.id)); setDraft(next); keepAcademyDraft(next); setEditor(JSON.stringify(next.manifest, null, 2)); keepAcademyEditor(JSON.stringify(next.manifest, null, 2)); }
  function permitReplace(): boolean { return !unsaved || window.confirm('Replace your unsaved draft? Export it first if you need to keep it.'); }
  async function importFile(file: File): Promise<void> {
    const attempt = ++generation.current; setBusy(true); setError(''); setStatus('');
    try {
      if (file.size > MAX_MANIFEST_BYTES) throw new Error('The manifest exceeds 1 MiB. Split it into smaller inventories.');
      const next = importAcademyDraft(await file.text(), crypto.randomUUID(), file.name);
      if (attempt !== generation.current || !permitReplace()) return;
      setDetailEdits({}); setEditTarget(null); replace(next); setStatus('Validated local draft. Not saved to the server.');
    } catch (failure) { if (attempt === generation.current) setError(`${failure instanceof Error ? failure.message : 'Import failed.'} Your previous inventory is still available below.`); }
    finally { if (attempt === generation.current) setBusy(false); }
  }
  function applyEditor(): AcademyDraft | null {
    if (!draft) return null;
    const next = editAcademyDraft(draft, editor, draft.name, draft.origin);
    for (const [id, values] of Object.entries(detailEdits)) {
      const course = next.manifest.courses.find(item => item.id === id);
      if (course) next.manifest = changeCourseDetails(next.manifest, id, { ...values, coverId: course.coverId });
    }
    // Envelope validation also prevents saving arbitrary origin metadata.
    const validated = parseAcademySave({ expectedRevision: next.revision, name: next.name, manifest: next.manifest, origin: next.origin });
    const normalized = { ...next, name: validated.name, manifest: validated.manifest, origin: validated.origin };
    replace(normalized); setDetailEdits({}); return normalized;
  }
  async function save(): Promise<void> {
    const attempt = ++generation.current; setError(''); setStatus('');
    try {
      if (editTarget) throw new Error('Finish adding or editing the open curriculum item before saving. Your text is preserved.');
      let next = applyEditor(); if (!next) return;
      setBusy(true);
      for (const course of next.manifest.courses) {
        const local: AcademyLocalCover | undefined = readAcademyCovers(next.id)[course.id];
        if (!local || course.coverId === local.uploadedId && local.uploadedId) continue;
        let coverId: string | undefined = local.uploadedId;
        if (!coverId) {
          setStatus('Uploading selected cover…');
          const response = await fetch('/api/academy/covers', { method: 'POST', headers: { Authorization: `Bearer ${library.token}`, 'Content-Type': 'image/jpeg' }, body: local.blob, signal: AbortSignal.timeout(20000) });
          const result = await response.json() as { coverId?: string; error?: string };
          if (!response.ok || !result.coverId) throw new Error(result.error ?? 'Cover upload failed. Your image is preserved.');
          coverId = result.coverId;
          if (attempt !== generation.current) return;
          keepAcademyCovers(next.id, { ...readAcademyCovers(next.id), [course.id]: { ...local, uploadedId: coverId } });
        }
        next = { ...next, manifest: changeCourseDetails(next.manifest, course.id, { title: course.title, description: course.description ?? '', coverId }), dirty: true };
        replace(next);
      }
      const saved = await academyClient.save(library.token, next.id, { expectedRevision: next.revision, name: next.name, manifest: next.manifest, origin: next.origin });
      if (attempt !== generation.current) return;
      replace(openAcademyDraft(saved)); setStatus(`Saved revision ${saved.revision} · ${new Date(saved.updatedAt).toLocaleString()}`);
      void library.refresh();
    } catch (failure) { if (attempt === generation.current) setError(failure instanceof Error ? failure.message : 'Save failed. Your draft is preserved.'); }
    finally { if (attempt === generation.current) setBusy(false); }
  }
  async function open(id: string): Promise<void> {
    if (!permitReplace()) return;
    const attempt = ++generation.current; setBusy(true); setError(''); setStatus('');
    try {
      const saved = await academyClient.read(library.token, id);
      if (attempt === generation.current) { setDetailEdits({}); setEditTarget(null); keepAcademyCovers(saved.id, {}); replace(openAcademyDraft(saved)); setStatus(`Opened saved revision ${saved.revision}.`); }
    } catch (failure) { if (attempt === generation.current) setError(failure instanceof Error ? failure.message : 'Could not open inventory. Your draft is preserved.'); }
    finally { if (attempt === generation.current) setBusy(false); }
  }
  function logout(): void {
    if (!permitReplace()) return;
    generation.current++; library.logout(); keepAcademyDraft(null); if (draft) keepAcademyCovers(draft.id, {}); setCovers({}); setDetailEdits({}); setEditTarget(null); setDraft(null); setEditor(''); setError(''); setStatus('Workspace cleared.');
  }
  async function loadTable(file: File): Promise<void> {
    const attempt = ++generation.current; setBusy(true); setTableError(''); setTablePreview(null);
    try {
      if (file.size > MAX_MANIFEST_BYTES) throw new Error('The table exceeds 1 MiB. Split it into smaller programs.');
      const text = await file.text(); if (attempt !== generation.current) return;
      setTableText(text); setTableName(file.name.replace(/\.(csv|tsv|txt)$/i, '').slice(0, 160) || 'Imported program');
      setTablePreview(parseAcademyTable(text));
    } catch (failure) { if (attempt === generation.current) setTableError(failure instanceof Error ? failure.message : 'The table could not be read.'); }
    finally { if (attempt === generation.current) setBusy(false); }
  }
  function commitTable(): void {
    if (!tablePreview || !permitReplace()) return;
    setDetailEdits({}); replace(importAcademyDraft(JSON.stringify(tablePreview), crypto.randomUUID(), tableName));
    setStatus('Program imported into your draft. Review the curriculum, then save it.'); setError(''); setTablePreview(null); setEditTarget(null);
  }
  function startEdit(edit: AcademyItemEdit): void {
    if (editorChanged) { setError('Apply or correct your advanced JSON changes before editing the curriculum. Your text is preserved.'); return; }
    if (!draft) replace(importAcademyDraft('{"version":1,"courses":[]}', crypto.randomUUID(), 'Untitled program'));
    setEditTarget(edit); setError('');
  }
  function commitItem(): void {
    if (!draft || !editTarget) return;
    try {
      const id = crypto.randomUUID();
      const base = draft.manifest.courses.length >= 20 && editTarget.kind === 'course' && !editTarget.id ? { ...draft.manifest, version: 2 as const } : draft.manifest;
      const manifest = upsertAcademyItem(base, editTarget, id);
      if (editTarget.kind === 'course') setSelectedCourse(editTarget.id ?? id);
      replace({ ...draft, manifest, dirty: true }); setEditTarget(null); setError(''); setStatus('Curriculum updated in your draft.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The curriculum could not be updated.'); }
  }
  function useOutline(): void {
    if (!permitReplace()) return;
    const next = importAcademyDraft(JSON.stringify(nbcProgramOutline()), crypto.randomUUID(), 'NBC Elite program');
    setDetailEdits({}); replace({ ...next, origin: { label: 'NBC Skool screenshots provided by Franco · September 15, 2026' } });
    setSelectedCourse(null); setEditTarget(null); setView('manage'); setError(''); setStatus('22 course names added from your screenshots. Covers, modules and lessons still need to be added.');
  }
  function updateDetails(values: { title: string; description: string; coverId?: string }): void {
    if (!draft || !selected) return;
    try { replace({ ...draft, manifest: changeCourseDetails(draft.manifest, selected.id, values), dirty: true }); setDetailEdits(value => { const next = { ...value }; delete next[selected.id]; return next; }); setStatus('Course details updated in your draft.'); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update course.'); }
  }
  function reorder(target: { courseId: string; moduleId?: string; lessonId?: string }, action: 'up' | 'down' | 'remove'): void {
    if (!draft || (action === 'remove' && !window.confirm('Remove this item and everything inside it from your draft? Saved revisions are not deleted.'))) return;
    try { replace({ ...draft, manifest: changeProgramOrder(draft.manifest, target, action), dirty: true }); setEditTarget(null); setStatus('Program updated in your draft.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update program.'); }
  }
  async function chooseCover(file: File): Promise<void> {
    if (!draft || !selected) return;
    const attempt = generation.current; const draftId = draft.id; const courseId = selected.id;
    setCoverBusy(true); setError('');
    try {
      const blob = await prepareAcademyCover(file);
      if (attempt !== generation.current) return;
      const next = { ...readAcademyCovers(draftId), [courseId]: { blob, url: URL.createObjectURL(blob) } };
      keepAcademyCovers(draftId, next); setCovers(next);
      replace({ ...draft, dirty: true }); setStatus('Cover selected · not uploaded yet. Save program uploads it. Download a copy before leaving.');
    } catch (failure) { if (attempt === generation.current) setError(failure instanceof Error ? failure.message : 'Could not read cover.'); }
    finally { if (attempt === generation.current) setCoverBusy(false); }
  }
  function showPreview(mode: 'demo' | 'inventory', course: string | null = null): void { if (mode === 'inventory') { try { applyEditor(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Check your course details.'); return; } } setPreviewMode(mode); setInitialCourse(course); }
  if (previewMode) return <AcademyExperience manifest={previewMode === 'demo' ? ACADEMY_DEMO : draft?.manifest ?? { version: 1, courses: [] }} demo={previewMode === 'demo'} covers={previewMode === 'inventory' ? covers : {}} initialCourse={initialCourse} onExit={() => setPreviewMode(null)} />;
  return <div className={styles.page}>
    <header className={styles.workspaceHeading}><div><h1>Classroom</h1><p>Your program, all in one place.</p></div><div className={styles.headerActions}><span className={styles.adminBadge}>Admin</span><button className={styles.previewButton} onClick={() => showPreview('demo')}><Eye size={17} />Preview student experience</button><button className={view === 'manage' ? styles.activeControl : ''} onClick={() => setView(value => value === 'manage' ? 'library' : 'manage')}><Pencil size={16} />{view === 'manage' ? 'Back to classroom' : 'Edit program'}</button></div></header>
    {view === 'library' ? <>{draft?.manifest.courses.length ? <><div className={styles.libraryNotice}><span><strong>{draft.name}</strong> · Unpublished curriculum</span></div><AcademyCatalog manifest={draft.manifest} demo={false} covers={covers} onOpen={id => showPreview('inventory', id)} onEdit={id => { setSelectedCourse(id); setView('manage'); }} /></> : <section className={styles.studentEmpty}><BookOpen size={36} strokeWidth={1.3} /><h2>Your NBC program starts here</h2><p>Start from the 22 course names in your Skool screenshots, or create your own program.</p><div className={styles.actions}><button className={styles.primaryButton} onClick={() => setView('manage')}><Plus size={17} />Create a program</button><button onClick={useOutline}>Use NBC outline</button></div><small>Only admins can see these tools.</small></section>}</> : <>
      <div className={styles.manageHeading}><div><p className={styles.eyebrow}>PROGRAM STUDIO</p><h2>Edit program</h2><p>Choose a course to edit its cover, modules and lessons.</p></div>{draft && <div className={styles.actions}><button disabled={disabled} onClick={() => { try { let manifest = draft.manifest; for (const [id, values] of Object.entries(detailEdits)) { const course = manifest.courses.find(item => item.id === id); if (course) manifest = changeCourseDetails(manifest, id, { ...values, coverId: course.coverId }); } downloadManifest(manifest, 'nbc-academy-inventory.json'); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Check course details before exporting.'); } }}><Download size={16} />Export inventory</button><button className={styles.primaryButton} disabled={disabled} onClick={() => { if (!library.token) setLibraryOpen(true); else void save(); }}>{library.token ? 'Save program' : 'Sign in to save'}<ArrowRight size={15} /></button></div>}</div>
      {error && <p role="alert" className={styles.notice}>{error}</p>}{status && <p role="status" className={styles.notice}>{status}</p>}
      <section className={styles.programStudio} aria-label="Program editor">
        <aside className={styles.editorIndex} aria-label="Courses in this program">
          <div className={styles.editorIndexHeading}><strong>Courses <span>{draft?.manifest.courses.length ?? 0}</span></strong><button disabled={disabled} aria-label="Add course" onClick={() => startEdit({ kind: 'course', title: '', videoUrl: '' })}><Plus size={18} /></button></div>
          {draft?.manifest.courses.map((course, index) => <button key={course.id} className={selected?.id === course.id ? styles.selectedEditorCourse : ''} aria-current={selected?.id === course.id ? 'true' : undefined} onClick={() => { setSelectedCourse(course.id); setEditTarget(null); }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{course.title}</strong><ChevronRight size={14} /></button>)}
          {!draft?.manifest.courses.length && <p>Add a course or use the NBC outline below.</p>}
          <button className={styles.textButton} disabled={disabled} onClick={useOutline}><List size={15} />Use NBC outline</button>
        </aside>
        <div className={styles.editorCanvas}>
          {editTarget && <form className={styles.itemForm} aria-label="Edit curriculum item" onSubmit={event => { event.preventDefault(); commitItem(); }}><div className={styles.row}><strong>{editTarget.id ? 'Edit' : 'New'} {editTarget.kind}</strong><button type="button" aria-label="Cancel curriculum edit" onClick={() => setEditTarget(null)}><X size={16} /></button></div><div className={styles.form}><label>{editTarget.kind === 'course' ? 'Course title' : editTarget.kind === 'module' ? 'Module title' : 'Lesson title'}<input autoFocus maxLength={160} required disabled={disabled} value={editTarget.title} onChange={event => setEditTarget({ ...editTarget, title: event.target.value })} /></label>{editTarget.kind === 'lesson' && <label>Video URL (optional)<input aria-label="Video URL (optional)" maxLength={2048} disabled={disabled} value={editTarget.videoUrl} placeholder="https://vimeo.com/…" onChange={event => setEditTarget({ ...editTarget, videoUrl: event.target.value })} /><small>Reference only. Adding a link does not download or publish a video.</small></label>}</div><button disabled={disabled} className={styles.primaryButton} type="submit">{editTarget.id ? 'Update' : 'Add'} {editTarget.kind}</button></form>}
          {selected ? <>
            <div className={styles.editorCourseHeading}><div><span className={styles.adminBadge}>Unpublished course</span><h3>{selected.title}</h3></div><div className={styles.actions}><button disabled={disabled || draft?.manifest.courses[0].id === selected.id} aria-label="Move course up" onClick={() => reorder({ courseId: selected.id }, 'up')}><ChevronUp size={16} /></button><button disabled={disabled || draft?.manifest.courses.at(-1)?.id === selected.id} aria-label="Move course down" onClick={() => reorder({ courseId: selected.id }, 'down')}><ChevronDown size={16} /></button><button disabled={disabled} aria-label="Remove course" onClick={() => reorder({ courseId: selected.id }, 'remove')}><Trash2 size={15} /></button></div></div>
            <div className={styles.courseSettings}>
              <div className={styles.coverSettings}><button className={styles.coverPicker} disabled={disabled} aria-label={selected.coverId || covers[selected.id] ? 'Change course cover' : 'Choose course cover'} onClick={() => coverInput.current?.click()}><CourseCover course={selected} localUrl={covers[selected.id]?.url} /><span><Upload size={16} />{selected.coverId || covers[selected.id] ? 'Change cover' : 'Choose a cover'}</span></button><input className={styles.hiddenInput} ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Course cover image" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void chooseCover(file); }} /><small>JPG, PNG or WebP · up to 5 MiB<br />Centered crop · 16:9</small><p role="status">{coverBusy ? 'Preparing cover…' : covers[selected.id] ? covers[selected.id].uploadedId ? !draft?.dirty && selected.coverId === covers[selected.id].uploadedId ? 'Saved cover' : 'Uploaded · program save pending' : 'Selected · upload pending' : selected.coverId ? 'Uploaded cover' : 'Original cover not added yet'}</p>{(covers[selected.id] || selected.coverId) && <div className={styles.actions}>{covers[selected.id] && <button onClick={() => { const link = document.createElement('a'); link.href = covers[selected.id].url; link.download = `${selected.id}-cover.jpg`; link.click(); }}><Download size={14} />Download selected cover</button>}<button disabled={disabled} onClick={() => { if (!draft) return; const next = { ...covers }; delete next[selected.id]; keepAcademyCovers(draft.id, next); setCovers(next); updateDetails({ title: detailEdits[selected.id]?.title ?? selected.title, description: detailEdits[selected.id]?.description ?? selected.description ?? '' }); }}>Remove cover</button></div>}</div>
              <form className={styles.courseDetails} aria-label="Course details" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); updateDetails({ title: String(data.get('title')), description: String(data.get('description')), coverId: selected.coverId }); }}><label>Course name<input name="title" required maxLength={160} value={detailEdits[selected.id]?.title ?? selected.title} onChange={event => setDetailEdits(value => ({ ...value, [selected.id]: { title: event.target.value, description: value[selected.id]?.description ?? selected.description ?? '' } }))} disabled={disabled} /></label><label>Description<textarea name="description" maxLength={500} rows={4} value={detailEdits[selected.id]?.description ?? selected.description ?? ''} onChange={event => setDetailEdits(value => ({ ...value, [selected.id]: { title: value[selected.id]?.title ?? selected.title, description: event.target.value } }))} placeholder="What will students learn in this course?" disabled={disabled} /></label><button className={styles.primaryButton} disabled={disabled} type="submit"><Check size={16} />Update course details</button><small>Updates your draft. Save program to store a revision.</small></form>
            </div>
            <div className={styles.modulesHeading}><div><h3>Modules & lessons</h3><p>{selected.modules.length} modules · {selected.modules.reduce((sum, module) => sum + module.lessons.length, 0)} lessons</p></div><button disabled={disabled} onClick={() => startEdit({ kind: 'module', courseId: selected.id, title: '', videoUrl: '' })}><Plus size={16} />Add module</button></div>
            {!selected.modules.length && <div className={styles.moduleEmpty}><List size={23} /><h4>Add the first module</h4><p>Group related lessons together. You can rename and reorder everything later.</p><button disabled={disabled} className={styles.primaryButton} onClick={() => startEdit({ kind: 'module', courseId: selected.id, title: '', videoUrl: '' })}>Create first module</button></div>}
            {selected.modules.map((module, m) => <section key={module.id} className={styles.studioModule}><div className={styles.moduleEditorHeading}><h4><span>{m + 1}</span>{module.title}</h4><div className={styles.actions}><button disabled={disabled || m === 0} aria-label={`Move module up ${module.title}`} onClick={() => reorder({ courseId: selected.id, moduleId: module.id }, 'up')}><ChevronUp size={14} /></button><button disabled={disabled || m === selected.modules.length - 1} aria-label={`Move module down ${module.title}`} onClick={() => reorder({ courseId: selected.id, moduleId: module.id }, 'down')}><ChevronDown size={14} /></button><button disabled={disabled} aria-label={`Edit module ${module.title}`} onClick={() => startEdit({ kind: 'module', id: module.id, courseId: selected.id, title: module.title, videoUrl: '' })}><Pencil size={14} /></button><button disabled={disabled} aria-label={`Remove module ${module.title}`} onClick={() => reorder({ courseId: selected.id, moduleId: module.id }, 'remove')}><Trash2 size={14} /></button></div></div>
              <ol>{module.lessons.map((lesson, l) => <li key={lesson.id}><span className={styles.lessonNumber}>{l + 1}</span><button className={styles.lessonEditName} disabled={disabled} aria-label={`Edit lesson ${lesson.title}`} onClick={() => startEdit({ kind: 'lesson', id: lesson.id, courseId: selected.id, moduleId: module.id, title: lesson.title, videoUrl: lesson.videoUrl ?? '' })}><strong>{lesson.title}</strong><small>{lesson.videoUrl ? 'Video reference added' : 'Video pending'}</small></button><div className={styles.actions}><button disabled={disabled || l === 0} aria-label={`Move lesson up ${lesson.title}`} onClick={() => reorder({ courseId: selected.id, moduleId: module.id, lessonId: lesson.id }, 'up')}><ChevronUp size={14} /></button><button disabled={disabled || l === module.lessons.length - 1} aria-label={`Move lesson down ${lesson.title}`} onClick={() => reorder({ courseId: selected.id, moduleId: module.id, lessonId: lesson.id }, 'down')}><ChevronDown size={14} /></button><button disabled={disabled} aria-label={`Remove lesson ${lesson.title}`} onClick={() => reorder({ courseId: selected.id, moduleId: module.id, lessonId: lesson.id }, 'remove')}><Trash2 size={14} /></button></div></li>)}</ol>
              <button disabled={disabled} className={styles.textButton} onClick={() => startEdit({ kind: 'lesson', courseId: selected.id, moduleId: module.id, title: '', videoUrl: '' })}><Plus size={15} />Add lesson</button>
            </section>)}
          </> : !editTarget && <div className={styles.moduleEmpty}><BookOpen size={30} /><h3>Build your program</h3><p>Create a course, choose its cover, then add modules and lessons.</p><button disabled={disabled} className={styles.primaryButton} onClick={() => startEdit({ kind: 'course', title: '', videoUrl: '' })}><Plus size={16} />Create first course</button></div>}
        </div>
      </section>
      <details className={styles.utilityDisclosure}><summary>Import from a spreadsheet or JSON<span>Optional bulk import</span></summary><div className={styles.disclosureBody}>
      <section className={styles.importPanel} aria-label="Import program from spreadsheet"><div className={styles.importIntro}><span className={styles.stepIndex}>01</span><div><h2>Start with a spreadsheet</h2><p>Paste rows from Excel or Google Sheets, or upload a CSV. Video links can be added later.</p></div><button className={styles.textButton} onClick={() => downloadText(ACADEMY_CSV_TEMPLATE, 'nbc-academy-import-template.csv', 'text/csv')}><Download size={16} />Download CSV template</button></div>
        <div className={styles.tableExample}><span>Course</span><span>Module</span><span>Lesson</span><span>Video URL <small>optional</small></span></div>
        <label className={styles.tablePaste}><span className={styles.srOnly}>Paste curriculum table</span><textarea rows={5} value={tableText} disabled={disabled} placeholder={'Course\tModule\tLesson\tVideo URL\nYour course\tFirst module\tFirst lesson\t'} onChange={event => { setTableText(event.target.value); setTablePreview(null); setTableError(''); }} /></label>
        <div className={styles.importActions}><span>CSV or pasted spreadsheet · up to 2,000 lessons / 1 MiB</span><div className={styles.actions}><input className={styles.hiddenInput} ref={tableInput} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" aria-label="Course inventory table" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void loadTable(file); }} /><button disabled={disabled} onClick={() => tableInput.current?.click()}><Upload size={15} />Upload CSV</button><button className={styles.primaryButton} disabled={disabled || !tableText.trim()} onClick={() => { try { setTablePreview(parseAcademyTable(tableText)); setTableError(''); } catch (failure) { setTablePreview(null); setTableError(failure instanceof Error ? failure.message : 'Could not read table.'); } }}>Review import<ArrowRight size={15} /></button></div></div>
        {tableError && <p role="alert" className={styles.notice}>{tableError} Your current program has not changed.</p>}
        {tablePreview && <div className={styles.importReview}><Check size={21} /><div><strong>Ready to review: {academyInventory(tablePreview).courses} courses · {academyInventory(tablePreview).modules} modules · {academyInventory(tablePreview).lessons} lessons</strong><p>{academyInventory(tablePreview).videos} video references. No videos will be fetched or uploaded.</p><ul>{tablePreview.courses.slice(0, 4).map(course => <li key={course.id}>{course.title} · {course.modules.length} modules</li>)}</ul>{tablePreview.courses.length > 4 && <p>+ {tablePreview.courses.length - 4} more courses</p>}</div><button className={styles.primaryButton} disabled={disabled} onClick={commitTable}>Use this curriculum</button></div>}
      </section>
      <details className={styles.utilityDisclosure}><summary>Already have a JSON inventory?<span>Advanced import / export</span></summary><div className={styles.disclosureBody}><p>Manifest v1 and v2 files are supported. Images stay separate from JSON. Import validates the entire file before changing your draft.</p><div className={styles.actions}><input ref={input} type="file" accept=".json,application/json" aria-label="Course inventory JSON" className={styles.hiddenInput} disabled={disabled} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file); }} /><button disabled={disabled} onClick={() => input.current?.click()}><Upload size={15} />{draft ? 'Replace inventory' : 'Import JSON'}</button><button onClick={() => downloadManifest(ACADEMY_TEMPLATE, 'nbc-academy-template.json')}><Download size={15} />Download JSON template</button></div></div></details>
      </div></details>
      {draft && <><div className={styles.curriculumFooter}><span>Draft in browser memory. Export the program and download selected covers before closing.</span><div className={styles.actions}><Link href="/ask-anas">Review source preparation →</Link><button disabled={disabled} onClick={() => showPreview('inventory') }><Eye size={16} />Preview this curriculum</button></div></div><details className={styles.utilityDisclosure}><summary>Program details & advanced JSON<span>{unsaved ? 'Unsaved draft' : `Saved · revision ${draft.revision}`}</span></summary><div className={styles.disclosureBody}><div className={styles.form}><label>Inventory name<input maxLength={160} disabled={disabled} value={draft.name} onChange={event => { const next = { ...draft, name: event.target.value, dirty: true }; setDraft(next); keepAcademyDraft(next); setStatus(''); }} /></label><label>Source / provenance label<input maxLength={160} disabled={disabled} value={draft.origin.label} onChange={event => { const next = { ...draft, origin: { ...draft.origin, label: event.target.value }, dirty: true }; setDraft(next); keepAcademyDraft(next); }} /></label><label>Original source HTTPS reference (optional)<input maxLength={2048} disabled={disabled} value={draft.origin.url ?? ''} onChange={event => { const next = { ...draft, origin: { label: draft.origin.label, ...(event.target.value ? { url: event.target.value } : {}) }, dirty: true }; setDraft(next); keepAcademyDraft(next); }} /></label><label>Manifest JSON<textarea spellCheck={false} rows={12} disabled={disabled} value={editor} onChange={event => { setEditor(event.target.value); keepAcademyEditor(event.target.value); const next = { ...draft, dirty: true }; setDraft(next); keepAcademyDraft(next); setStatus(''); }} /></label></div><button disabled={disabled} onClick={() => { setError(''); try { applyEditor(); setStatus('Changes validated. Save to create a revision.'); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Invalid JSON; previous inventory preserved.'); } }}>Apply JSON changes</button><p className={styles.reference}>{editorChanged ? 'Unapplied JSON changes. Preview and export use the last validated curriculum. ' : ''}Inventory: {draft.id} · Expected revision {draft.revision}</p></div></details></>}
      <details className={styles.utilityDisclosure} open={libraryOpen} onToggle={event => setLibraryOpen(event.currentTarget.open)}><summary>Saved inventories<span>Admin only</span></summary><div className={styles.disclosureBody}><AcademyLibraryPanel library={library} blocked={busy} onOpen={id => void open(id)} onLogout={logout} /></div></details>
    </>}
  </div>;
}
