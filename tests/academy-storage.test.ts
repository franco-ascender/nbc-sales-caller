import assert from 'node:assert/strict';
import test from 'node:test';
import { ACADEMY_TEMPLATE, MAX_MANIFEST_BYTES } from '../src/lib/academy-manifest.ts';
import { AcademyError, parseAcademySave, readAcademyJson, academyDatabaseError } from '../src/lib/academy-validation.ts';
import { importAcademyDraft, editAcademyDraft, keepAcademyDraft, readAcademyDraft } from '../src/lib/academy-draft.ts';
import { academyClient } from '../src/services/academy-client.ts';
const valid = () => ({ expectedRevision: 0, name: 'K01 DEMO', manifest: structuredClone(ACADEMY_TEMPLATE), origin: { label: 'K01 fixture' } });
test('strict save envelope: client ownership, File/base64, state and bad versions rejected', () => {
  assert.equal(parseAcademySave(valid()).manifest.version, 1);
  for (const extra of [{ owner_id: 'other' }, { owner: 'other' }, { sources: [] }, { file: new File(['test'], 'x') }, { base64: 'YWJj' }]) assert.throws(() => parseAcademySave({ ...valid(), ...extra }), AcademyError);
  for (const expectedRevision of [undefined, -1, 0.1, '1', 2147483647]) assert.throws(() => parseAcademySave({ ...valid(), expectedRevision }));
  for (const origin of [{ label: 'x', url: 'javascript:alert(1)' }, { label: 'x', url: 'https://u:p@example.test' }, { label: 'x', transcript: new File([], 'a') }, { label: '' }]) assert.throws(() => parseAcademySave({ ...valid(), origin }));
});
test('invalid import and invalid editor preserve validated draft without mutation', () => {
  const draft = importAcademyDraft(JSON.stringify(ACADEMY_TEMPLATE), 'fixture', 'K01 DEMO'); keepAcademyDraft(draft);
  assert.throws(() => keepAcademyDraft(importAcademyDraft('{bad', 'next', 'invalid')));
  assert.equal(readAcademyDraft(), draft);
  assert.throws(() => keepAcademyDraft(editAcademyDraft(draft, '{"version":2}', draft.name, draft.origin)));
  assert.equal(readAcademyDraft(), draft);
  keepAcademyDraft(null);
});
test('body streaming limits, malformed JSON and exact media type', async () => {
  const req = (body: string, type = 'application/json') => new Request('http://local.test', { method: 'PUT', headers: { 'Content-Type': type }, body });
  assert.deepEqual(await readAcademyJson(req(JSON.stringify(valid()), 'application/json; charset=utf-8')), valid());
  await assert.rejects(readAcademyJson(req('{}', 'text/application/json')), { status: 415 });
  await assert.rejects(readAcademyJson(req('{')), { status: 400 });
  await assert.rejects(readAcademyJson(req(' '.repeat(MAX_MANIFEST_BYTES + 16385))), { status: 413 });
});
test('safe missing-schema and conflict errors; no raw SQL returned', () => {
  assert.equal(academyDatabaseError({ code: '42P01' }).code, 'storage_pending');
  assert.equal(academyDatabaseError({ code: 'PT409' }).status, 409);
  assert.equal(academyDatabaseError({ code: 'PT404' }).status, 404);
  assert.equal(academyDatabaseError({ code: 'XX000' }).code, 'storage_unavailable');
});
test('client does not retry ambiguous saves or mutate the draft on backend failure/conflict', async () => {
  const previous = globalThis.fetch; let calls = 0;
  const draft = importAcademyDraft(JSON.stringify(ACADEMY_TEMPLATE), 'fixture', 'K01 DEMO'); keepAcademyDraft(draft);
  try {
    for (const status of [409, 503]) {
      calls = 0; globalThis.fetch = async () => { calls++; return Response.json({ code: status === 409 ? 'revision_conflict' : 'storage_pending', error: 'Fixture failure' }, { status }); };
      await assert.rejects(academyClient.save('fixture-token', 'fixture', valid()), { status });
      assert.equal(calls, 1); assert.equal(readAcademyDraft(), draft);
    }
    globalThis.fetch = async () => { throw new Error('private network details'); };
    await assert.rejects(academyClient.save('fixture-token', 'fixture', valid()), { code: 'network_error' });
    assert.equal(readAcademyDraft(), draft);
  } finally { globalThis.fetch = previous; keepAcademyDraft(null); }
});
