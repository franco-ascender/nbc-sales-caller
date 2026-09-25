import test from 'node:test';
import assert from 'node:assert/strict';
import { academyCourseProgress } from '../src/lib/academy-progress.ts';
import { ACADEMY_DEMO } from '../src/lib/academy-demo.ts';
import { keepAcademyDraft, setAcademyDraftOwner, readAcademyDraft, keepAcademyEditor, readAcademyEditor, importAcademyDraft } from '../src/lib/academy-draft.ts';
test('progress derives only from completed lessons in that course, including undo and empty modules', () => {
  const course=ACADEMY_DEMO.courses[0];const completed=new Set<string>();assert.deepEqual(academyCourseProgress(course,completed),{done:0,total:6,percent:0,nextLessonId:course.modules[0].lessons[0].id});
  completed.add(course.modules[0].lessons[0].id);completed.add('not-a-lesson');completed.add(ACADEMY_DEMO.courses[1].modules[0].lessons[0].id);assert.equal(academyCourseProgress(course,completed).percent,17);
  for(const lesson of course.modules.flatMap(m=>m.lessons))completed.add(lesson.id);assert.equal(academyCourseProgress(course,completed).percent,100);
  completed.delete(course.modules[0].lessons[0].id);assert.equal(academyCourseProgress(course,completed).done,5);assert.equal(academyCourseProgress({...course,modules:[]},completed).percent,0);
});
test('a different administrator cannot inherit another account’s in-memory draft or unapplied JSON', () => {
  setAcademyDraftOwner('admin-a');keepAcademyDraft(importAcademyDraft(JSON.stringify(ACADEMY_DEMO),'demo','DEMO'));keepAcademyEditor('draft edits');setAcademyDraftOwner('admin-a');assert.equal(readAcademyDraft()?.name,'DEMO');assert.equal(readAcademyEditor(),'draft edits');setAcademyDraftOwner('admin-b');assert.equal(readAcademyDraft(),null);assert.equal(readAcademyEditor(),null);setAcademyDraftOwner(null);
});
