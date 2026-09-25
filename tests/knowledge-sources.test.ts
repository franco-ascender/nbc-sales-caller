import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAcademyManifest } from '../src/lib/academy-manifest.ts';
import { knowledgeSources } from '../src/lib/knowledge-sources.ts';
test('source states derive from lesson metadata; references never cause network requests', () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Forbidden external access'); };
  try {
    const manifest = parseAcademyManifest(JSON.stringify({ version: 1, courses: [{ id: 'c', title: '<script>fixture</script>', modules: [{ id: 'm', title: 'Module', lessons: [{ id: 'l', title: 'DEMO lesson', videoUrl: 'https://video.example.test/<img>' }, { id: 'l2', title: 'DEMO pending' }] }] }] }));
    const sources = knowledgeSources(manifest, { label: 'Explicit test fixture' });
    assert.equal(calls, 0); assert.equal(sources.length, 2);
    assert.deepEqual(sources.map(s => s.contentStatus), ['pending', 'pending']);
    assert.deepEqual(sources.map(s => s.transcriptUrl), [null, null]);
    assert.match(sources[0].videoReason, /not downloaded or verified/);
    assert.match(sources[1].videoReason, /none was provided/);
    assert.equal(sources[0].courseId, 'c'); assert.equal(sources[0].moduleId, 'm'); assert.equal(sources[0].lessonId, 'l');
    assert.equal(sources[0].origin.label, 'Explicit test fixture');
    assert.deepEqual(knowledgeSources({ version: 1, courses: [] }, { label: 'Empty' }), []);
  } finally { globalThis.fetch = original; }
});
