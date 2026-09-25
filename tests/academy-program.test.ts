import test from 'node:test';
import assert from 'node:assert/strict';
import { nbcProgramOutline, changeCourseDetails, changeProgramOrder } from '../src/lib/academy-program.ts';
import { ACADEMY_TEMPLATE, parseAcademyManifest } from '../src/lib/academy-manifest.ts';
import { upsertAcademyItem, parseAcademyTable } from '../src/lib/academy-import.ts';
import { validateAcademyCover, readAcademyCoverBody, MAX_COVER_BYTES } from '../src/lib/academy-cover.ts';

test('NBC screenshot outline has22 names and no invented lessons, covers, progress or private access', () => {
  const outline = parseAcademyManifest(JSON.stringify(nbcProgramOutline()));
  assert.equal(outline.courses.length,22);assert.equal(outline.courses[0].title,'Start Here!');assert.equal(outline.courses.at(-1)?.title,'What is Inner Circle?');
  for(const course of outline.courses){assert.deepEqual(course.modules,[]);assert.equal(course.coverId,undefined);assert.equal('progress' in course,false);}
});
test('v1 remains strict; v2 roundtrips visual metadata and limits without binary/URL fields', () => {
  const v1 = structuredClone(ACADEMY_TEMPLATE); const cid = v1.courses[0].id;
  assert.deepEqual(parseAcademyManifest(JSON.stringify(v1)), v1);
  const v2 = changeCourseDetails(v1,cid,{title:'Renamed',description:'Description',coverId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
  assert.equal(v2.version,2);assert.equal(v2.courses[0].modules[0].id,v1.courses[0].modules[0].id);assert.deepEqual(parseAcademyManifest(JSON.stringify(v2)),v2);
  assert.throws(()=>parseAcademyManifest(JSON.stringify({...v2,version:1})),/unsupported field/);
  for(const coverId of ['data:image/png;base64,AAAA','https://example.com/image.jpg',{name:'file'},'<svg/>']) assert.throws(()=>parseAcademyManifest(JSON.stringify({...v2,courses:[{...v2.courses[0],coverId}]})),/coverId/);
  assert.throws(()=>parseAcademyManifest(JSON.stringify({version:2,courses:Array(101).fill({})})),/at most 100/);
  assert.throws(()=>changeCourseDetails(v1,cid,{title:'Title',description:'x'.repeat(501)}),/500/);
  const csv='Course,Module,Lesson\n'+Array.from({length:22},(_,i)=>`Course${i},Module,Lesson`).join('\n');assert.equal(parseAcademyTable(csv).version,2);
});
test('program operations preserve IDs, reorder within parent, remove descendants and reject stale targets', () => {
  const initial = nbcProgramOutline();const cid=initial.courses[0].id;
  let next=upsertAcademyItem(initial,{kind:'module',courseId:cid,title:'First module',videoUrl:''},'module1');
  next=upsertAcademyItem(next,{kind:'lesson',courseId:cid,moduleId:'module1',title:'Lesson one',videoUrl:''},'lesson1');
  next=upsertAcademyItem(next,{kind:'lesson',courseId:cid,moduleId:'module1',title:'Lesson two',videoUrl:''},'lesson2');
  next=changeProgramOrder(next,{courseId:cid,moduleId:'module1',lessonId:'lesson2'},'up');assert.equal(next.courses[0].modules[0].lessons[0].id,'lesson2');
  assert.equal(changeProgramOrder(next,{courseId:cid,moduleId:'module1'},'remove').courses[0].modules.length,0);
  assert.equal(next.courses[0].modules[0].lessons.length,2);assert.deepEqual(initial.courses[0].modules,[]);
  assert.throws(()=>changeProgramOrder(next,{courseId:cid,moduleId:'missing'},'remove'));
});
test('cover boundary rejects executable formats, wrong signatures, dimensions and streaming size', async () => {
  for(const text of ['<svg xmlns="http://www.w3.org/2000/svg"/>','<html>bad</html>','data:image/jpeg;base64,AAAA']) assert.throws(()=>validateAcademyCover(new TextEncoder().encode(text),'image/jpeg'));
  const jpeg=new Uint8Array([255,216,255,192,0,17,8,2,208,5,0,3,1,17,0,2,17,0,3,17,0,255,217]);
  validateAcademyCover(jpeg,'image/jpeg');assert.throws(()=>validateAcademyCover(jpeg,'image/svg+xml'));
  const huge=jpeg.slice();huge[9]=20;assert.throws(()=>validateAcademyCover(huge,'image/jpeg'),/2560/);
  await assert.rejects(readAcademyCoverBody(new Request('https://local/covers',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:new Uint8Array(MAX_COVER_BYTES+1)})),/2 MiB/);
});
