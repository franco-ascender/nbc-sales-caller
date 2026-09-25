import { MAX_MANIFEST_BYTES, parseAcademyManifest } from './academy-manifest.ts';
import type { AcademyManifest, AcademyCourse, AcademyModule } from './academy-types.ts';

export const ACADEMY_CSV_TEMPLATE = 'Course,Module,Lesson,Video URL\nYour course,First module,First lesson,\nYour course,First module,Second lesson,\nYour course,Second module,Third lesson,\n';
interface TableRow { cells: string[]; line: number }
function tableRows(text: string): TableRow[] {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const separator = firstLine.includes('\t') ? '\t' : ',';
  const rows: TableRow[] = []; let cells: string[] = []; let cell = ''; let quoted = false; let closed = false; let line = 1; let startLine = 1;
  function endCell(): void { cells.push(cell.trim()); cell = ''; closed = false; }
  function endRow(): void { endCell(); if (cells.some(Boolean)) rows.push({ cells, line: startLine }); cells = []; startLine = line + 1; }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else { cell += char; if (char === '\n') line++; }
    } else if (char === separator) endCell();
    else if (char === '\n' || char === '\r') { endRow(); if (char === '\r' && text[i + 1] === '\n') i++; line++; }
    else if (char === '"' && !cell.trim() && !closed) { cell = ''; quoted = true; }
    else if (char === '"' || closed && char.trim()) throw new Error(`Row ${line}: unexpected text after a quoted cell.`);
    else if (!closed) cell += char;
  }
  if (quoted) throw new Error(`Row ${startLine}: a quoted cell is not closed.`);
  if (cell || cells.length) endRow();
  return rows;
}
function stableId(kind: string, path: string[]): string {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(JSON.stringify(path))) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 1099511628211n);
  return `${kind}-${hash.toString(16)}`;
}
export function parseAcademyTable(input: string): AcademyManifest {
  if (new TextEncoder().encode(input).length > MAX_MANIFEST_BYTES) throw new Error('The table exceeds 1 MiB. Split it into smaller programs.');
  const rows = tableRows(input.replace(/^\uFEFF/, ''));
  const header = rows.shift();
  if (!header) throw new Error('Paste a table with Course, Module, Lesson and optional Video URL columns.');
  const aliases: Record<string, string> = { course: 'course', curso: 'course', module: 'module', módulo: 'module', modulo: 'module', lesson: 'lesson', lección: 'lesson', leccion: 'lesson', 'video url': 'video', 'video_url': 'video', 'url del video': 'video' };
  const columns = header.cells.map(cell => aliases[cell.toLowerCase()]);
  if (columns.some(column => !column) || new Set(columns).size !== columns.length || !['course', 'module', 'lesson'].every(column => columns.includes(column))) throw new Error('Use the template columns: Course, Module, Lesson, Video URL (optional).');
  if (!rows.length) throw new Error('Add at least one lesson below the column headings.');
  if (rows.length > 2000) throw new Error('A program can contain at most 2000 lessons.');
  const manifest: AcademyManifest = { version: 1, courses: [] };
  const courses = new Map<string, AcademyCourse>(); const modules = new Map<string, AcademyModule>(); const lessons = new Set<string>();
  for (const row of rows) {
    if (row.cells.length !== columns.length) throw new Error(`Row ${row.line}: expected ${columns.length} columns. Leave an empty Video URL cell when a video is pending.`);
    const value = (key: string): string => row.cells[columns.indexOf(key)]?.normalize('NFC') ?? '';
    const courseTitle = value('course'); const moduleTitle = value('module'); const lessonTitle = value('lesson'); const videoUrl = value('video');
    if (![courseTitle, moduleTitle, lessonTitle].every(title => title && title.length <= 160)) throw new Error(`Row ${row.line}: Course, Module and Lesson must each have a title of 1–160 characters.`);
    const path = [courseTitle, moduleTitle, lessonTitle]; const lessonKey = JSON.stringify(path);
    if (lessons.has(lessonKey)) throw new Error(`Row ${row.line}: this lesson is repeated in the same module. Remove the duplicate or give it a distinct title.`);
    lessons.add(lessonKey);
    let course = courses.get(courseTitle);
    if (!course) { course = { id: stableId('course', [courseTitle]), title: courseTitle, modules: [] }; courses.set(courseTitle, course); manifest.courses.push(course); }
    const moduleKey = JSON.stringify(path.slice(0, 2)); let module = modules.get(moduleKey);
    if (!module) { module = { id: stableId('module', path.slice(0, 2)), title: moduleTitle, lessons: [] }; modules.set(moduleKey, module); course.modules.push(module); }
    try {
      // Validate each row before reporting a usable preview, with the source row in any error.
      const single = parseAcademyManifest(JSON.stringify({ version: 1, courses: [{ id: course.id, title: courseTitle, modules: [{ id: module.id, title: moduleTitle, lessons: [{ id: stableId('lesson', path), title: lessonTitle, ...(videoUrl ? { videoUrl } : {}) }] }] }] }));
      module.lessons.push(single.courses[0].modules[0].lessons[0]);
    } catch (error) { throw new Error(`Row ${row.line}: ${error instanceof Error ? error.message : 'Invalid lesson.'}`); }
  }
  if (manifest.courses.length > 20) manifest.version = 2;
  return parseAcademyManifest(JSON.stringify(manifest));
}

export interface AcademyItemEdit { kind: 'course' | 'module' | 'lesson'; id?: string; courseId?: string; moduleId?: string; title: string; videoUrl: string }
export function upsertAcademyItem(manifest: AcademyManifest, edit: AcademyItemEdit, newId: string): AcademyManifest {
  const next = structuredClone(manifest); const id = edit.id ?? newId;
  if (edit.kind === 'course') {
    if (edit.id) { const course = next.courses.find(c => c.id === id); if (!course) throw new Error('Course no longer exists.'); course.title = edit.title; }
    else next.courses.push({ id, title: edit.title, modules: [] });
  } else {
    const course = next.courses.find(c => c.id === edit.courseId); if (!course) throw new Error('Choose a course first.');
    if (edit.kind === 'module') {
      if (edit.id) { const module = course.modules.find(m => m.id === id); if (!module) throw new Error('Module no longer exists.'); module.title = edit.title; }
      else course.modules.push({ id, title: edit.title, lessons: [] });
    } else {
      const module = course.modules.find(m => m.id === edit.moduleId); if (!module) throw new Error('Choose a module first.');
      const lesson = { id, title: edit.title, ...(edit.videoUrl.trim() ? { videoUrl: edit.videoUrl.trim() } : {}) };
      if (edit.id) { const index = module.lessons.findIndex(l => l.id === id); if (index === -1) throw new Error('Lesson no longer exists.'); module.lessons[index] = lesson; }
      else module.lessons.push(lesson);
    }
  }
  return parseAcademyManifest(JSON.stringify(next));
}
