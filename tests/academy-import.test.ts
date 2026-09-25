import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAcademyTable, upsertAcademyItem, ACADEMY_CSV_TEMPLATE } from '../src/lib/academy-import.ts';
import { academyInventory, MAX_MANIFEST_BYTES } from '../src/lib/academy-manifest.ts';
import { ACADEMY_DEMO, demoCaptions, demoTranscript, demoWorksheet } from '../src/lib/academy-demo.ts';

test('spreadsheet import groups courses/modules in order with stable IDs, optional videos and Spanish headers', () => {
  const text = 'Curso\tMódulo\tLección\tURL del video\nCurso A\tModule A\tLesson A\t\nCurso A\tModule A\tLesson B\thttps://vimeo.com/12345\nCurso B\tModule A\tLesson A\t\n';
  const parsed = parseAcademyTable(text);
  assert.deepEqual(academyInventory(parsed), { courses: 2, modules: 2, lessons: 3, videos: 1 });
  assert.notEqual(parsed.courses[0].modules[0].id, parsed.courses[1].modules[0].id);
  assert.notEqual(parsed.courses[0].modules[0].lessons[0].id, parsed.courses[1].modules[0].lessons[0].id);
  assert.deepEqual(parsed, parseAcademyTable(text));
  const addedEarlier = parseAcademyTable(text.replace('Curso A\tModule A\tLesson A', 'New course\tNew module\tNew lesson\t\nCurso A\tModule A\tLesson A'));
  assert.equal(parsed.courses[0].id, addedEarlier.courses[1].id);
  assert.equal(parseAcademyTable('Course,Module,Lesson\nC,M,L').courses[0].modules[0].lessons[0].videoUrl, undefined);
});
test('CSV supports BOM, CRLF, escaped quotes and commas inside quoted titles', () => {
  const parsed = parseAcademyTable('\uFEFFCourse,Module,Lesson,Video URL\r\n"Course, one",Module,"A ""better"" question",\r\n');
  assert.equal(parsed.courses[0].title, 'Course, one'); assert.equal(parsed.courses[0].modules[0].lessons[0].title, 'A "better" question');
  assert.equal(academyInventory(parseAcademyTable(ACADEMY_CSV_TEMPLATE)).lessons, 3);
});
test('malformed and unsafe tables fail with row information before replacing a manifest', () => {
  for (const text of ['Course,Module,Lesson\nC,M,L\nC,M,L', 'Course,Module,Lesson\nC,,L', 'Course,Module,Lesson\nC,M', 'Course,Module,Lesson\n"C,M,L', 'Course,Module,Lesson,Video URL\nC,M,L,javascript:alert(1)', 'Course,Module,Lesson,Video URL\nC,M,L,https://user:pass@vimeo.com/123', 'Course,Module,Lesson\n"C"oops,M,L']) assert.throws(() => parseAcademyTable(text), /Row/);
  assert.throws(() => parseAcademyTable('Course,Module,Lesson,owner_id\nC,M,L,other'), /template columns/);
  assert.throws(() => parseAcademyTable('Course,Module,Lesson\n'), /at least one lesson/);
  assert.throws(() => parseAcademyTable('x'.repeat(MAX_MANIFEST_BYTES + 1)), /1 MiB/);
  assert.throws(() => parseAcademyTable('Course,Module,Lesson\n' + Array.from({ length: 2001 }, (_, i) => `C,M,L${i}`).join('\n')), /2000/);
  assert.throws(() => parseAcademyTable('Course,Module,Lesson\n' + Array.from({ length: 101 }, (_, i) => `C${i},M,L`).join('\n')), /100/);
});
test('visual edits retain identities, validate hierarchy and URLs and never mutate previous draft', () => {
  const original = parseAcademyTable('Course,Module,Lesson\nC,M,L'); const before = structuredClone(original);
  const c = original.courses[0], m = c.modules[0], l = m.lessons[0];
  const edited = upsertAcademyItem(original, { kind: 'lesson', courseId: c.id, moduleId: m.id, id: l.id, title: 'Updated lesson', videoUrl: 'https://vimeo.com/123456' }, 'unused');
  assert.equal(edited.courses[0].modules[0].lessons[0].id, l.id);
  assert.equal(edited.courses[0].modules[0].lessons[0].videoUrl, 'https://vimeo.com/123456');
  assert.deepEqual(original, before);
  assert.throws(() => upsertAcademyItem(original, { kind: 'lesson', courseId: c.id, moduleId: m.id, id: l.id, title: 'L', videoUrl: 'data:text/html,hi' }, 'unused'));
  assert.throws(() => upsertAcademyItem(original, { kind: 'course', id: c.id, title: '', videoUrl: '' }, 'unused'));
  const added = upsertAcademyItem(original, { kind: 'module', courseId: c.id, title: 'New module', videoUrl: '' }, 'new-module');
  assert.equal(added.courses[0].modules.length, 2);
});
test('demo curriculum and downloads are explicitly illustrative, have no remote video references', () => {
  assert.deepEqual(academyInventory(ACADEMY_DEMO), { courses: 4, modules: 8, lessons: 24, videos: 0 });
  assert.match(demoTranscript('Lesson'), /not a transcript of a real video/);
  assert.match(demoCaptions(), /^WEBVTT/); assert.match(demoCaptions(), /Demonstration/);
  assert.match(demoWorksheet('Lesson'), /Not Anas/);
});
test('a 2000-lesson program imports without raising the existing hierarchy limits', () => {
  const rows = Array.from({ length: 2000 }, (_, i) => `Large program,Module ${Math.floor(i / 200) + 1},Lesson ${i + 1},`);
  const manifest = parseAcademyTable('Course,Module,Lesson,Video URL\n' + rows.join('\n'));
  assert.deepEqual(academyInventory(manifest), { courses: 1, modules: 10, lessons: 2000, videos: 0 });
});
