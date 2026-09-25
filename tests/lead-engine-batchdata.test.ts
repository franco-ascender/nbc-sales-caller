import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBatchDataVerificationProvider } from '../src/services/lead-engine-batchdata.ts';

const phones = ['7045551234', '7045555678'];
const wireRow = (overrides: Record<string, unknown> = {}) => ({ number: '7045551234', type: 'Mobile', dnc: false, tcpa: false, reachable: true, carrier: 'Verizon', ...overrides });

test('verifyPhones posts one call per batch and never calls /phone/dnc or /phone/litigator separately', async () => {
  const calls: Array<{ url: URL; options: RequestInit }> = [];
  const provider = createBatchDataVerificationProvider('synthetic-private-key', async (input, options) => {
    calls.push({ url: new URL(String(input)), options: options! });
    return Response.json({ results: { phoneNumbers: [wireRow(), wireRow({ number: '7045555678', type: 'Land Line', reachable: false })] } });
  });
  const results = await provider.verifyPhones(phones);
  assert.equal(calls.length, 1);
  const { url, options } = calls[0];
  assert.equal(url.href, 'https://api.batchdata.com/api/v1/phone/verification');
  assert.equal(options.method, 'POST');
  assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer synthetic-private-key');
  assert.deepEqual(JSON.parse(String(options.body)), { requests: phones });
  assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store'); assert.ok(options.signal);
  assert.equal(results.length, 2);
  assert.equal(results[0].phone10, '7045551234'); assert.equal(results[0].lineType, 'Mobile'); assert.equal(results[0].dnc, false);
  assert.equal(results[1].phone10, '7045555678'); assert.equal(results[1].lineType, 'Land Line'); assert.equal(results[1].reachable, false);
  assert.ok(typeof results[0].verifiedAt === 'string' && !Number.isNaN(Date.parse(results[0].verifiedAt!)));
  assert.equal(JSON.stringify(results).includes('Verizon'), false);
});

test('rejects an empty batch, more than 100 numbers or any phone that fails 10-digit normalization', async () => {
  const provider = createBatchDataVerificationProvider('synthetic', async () => Response.json({ results: { phoneNumbers: [] } }));
  await assert.rejects(provider.verifyPhones([]));
  await assert.rejects(provider.verifyPhones(Array(101).fill('7045551234')));
  await assert.rejects(provider.verifyPhones(['not-a-phone']));
  await assert.rejects(provider.verifyPhones(['+17045551234']));
});

test('provider answers are matched by number, because BatchData returns them in its own order', async () => {
  const provider = createBatchDataVerificationProvider('synthetic', async () => Response.json({
    results: { phoneNumbers: [wireRow({ number: '7045555678', type: 'Land Line' }), wireRow()] },
  }));
  const [first, second] = await provider.verifyPhones(phones);
  assert.equal(first.phone10, '7045551234'); assert.equal(first.lineType, 'Mobile');
  assert.equal(second.phone10, '7045555678'); assert.equal(second.lineType, 'Land Line');
});

test('a number the provider never answers for stays unknown instead of voiding the whole paid batch', async () => {
  const provider = createBatchDataVerificationProvider('synthetic', async () => Response.json({ results: { phoneNumbers: [wireRow()] } }));
  const [first, second] = await provider.verifyPhones(phones);
  assert.equal(first.lineType, 'Mobile');
  assert.equal(second.phone10, '7045555678');
  assert.equal(second.lineType, null); assert.equal(second.dnc, null); assert.equal(second.reachable, null);
});

test('403 insufficient-balance, 401 and malformed/oversized bodies fail closed with a sanitized message', async () => {
  const bad = [new Response(JSON.stringify({ message: 'Insufficient balance' }), { status: 403 }), new Response('private', { status: 401 }),
    new Response('{'), new Response('x'.repeat(262145)), Response.json({ results: {} })];
  for (const response of bad) {
    let count = 0;
    const provider = createBatchDataVerificationProvider('synthetic', async () => { count++; return response; });
    await assert.rejects(provider.verifyPhones(phones), error => error instanceof Error && !error.message.includes('private'));
    assert.equal(count, 1);
  }
});

test('unknown/missing provider flags stay unknown, never become a false clearance', async () => {
  const provider = createBatchDataVerificationProvider('synthetic', async () => Response.json({
    results: { phoneNumbers: [wireRow({ dnc: undefined, tcpa: undefined, reachable: undefined, type: undefined }), wireRow({ number: '7045555678' })] },
  }));
  const [first] = await provider.verifyPhones(phones);
  assert.equal(first.dnc, null); assert.equal(first.tcpa, null); assert.equal(first.reachable, null); assert.equal(first.lineType, null);
});

test('a dry account is reported as such, because the reason lives in the body and not the status code', async () => {
  const provider = createBatchDataVerificationProvider('synthetic', async () =>
    new Response(JSON.stringify({ status: { code: 403, text: 'Forbidden', message: 'Insufficient balance.' } }), { status: 403 }));
  await assert.rejects(provider.verifyPhones(phones), (error: unknown) =>
    error instanceof Error && 'code' in error && error.code === 'provider_balance_exhausted' && /balance/i.test(error.message));
});

// ---------- Phase 4 recipe B: skip trace ----------
import { matchTraceResults, pickTracePhone, traceRequestKey, TRACE_BATCH, TRACE_CENTS_PER_PERSON } from '../src/services/lead-engine-batchdata.ts';
import type { SkipTraceRequest } from '../src/services/lead-engine-batchdata.ts';
import { LeadEngineError } from '../src/lib/lead-engine-storage.ts';

const tracePeople: SkipTraceRequest[] = [
  { first: 'Victoria', last: 'Aaron', street: '7104 JEFFERSON ST', city: 'Navarre', state: 'FL', zip: '32566' },
  { first: 'Arnold', last: 'Feldman', street: '19101 MYSTIC POINT DR', city: 'Miami', state: 'FL', zip: '33180' },
  { first: 'Jan', last: 'Grossman', street: '5096 NW 89TH WAY', city: 'Coral Springs', state: 'FL', zip: '33067' },
];
// BatchData echoes the input under meta.input on some plans, or only returns the record's own propertyAddress + name.
const personFor = (request: SkipTraceRequest, phones: Array<Record<string, unknown>>, emails: unknown[] = [], echo: 'meta' | 'record' = 'meta') => ({
  ...(echo === 'meta' ? { meta: { input: { propertyAddress: { street: request.street, city: request.city, state: request.state, zip: request.zip }, name: { first: request.first, last: request.last } } } } : {}),
  ...(echo === 'record' ? { propertyAddress: { street: request.street.toLowerCase(), city: request.city, state: request.state, zip: `${request.zip}-1234` }, name: { first: request.first.toUpperCase(), last: request.last.toUpperCase() } } : {}),
  phoneNumbers: phones, emails,
});

test('skipTrace posts propertyAddress + name for up to 50 persons and matches answers by identity, not position (shuffled, one missing)', async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const provider = createBatchDataVerificationProvider('synthetic', async (input, options) => {
    calls.push({ url: String(input), body: JSON.parse(String(options!.body)) });
    // Answers come back for the third and the first person only, in that order; the second is never answered.
    return Response.json({ results: { persons: [
      personFor(tracePeople[2], [{ number: '9545550002', type: 'Land Line', dnc: false, tcpa: false, score: 99 }], [], 'record'),
      personFor(tracePeople[0], [{ number: '8505550001', type: 'Mobile', dnc: true, tcpa: false, score: 90 }, { number: '8505550009', type: 'Mobile', dnc: false, tcpa: false, score: 80 }, { number: '8505550003', type: 'Land Line', dnc: false, tcpa: false, score: 95 }], [{ email: 'Victoria@Example.com' }]),
    ] } });
  });
  const results = await provider.skipTrace(tracePeople);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://api.batchdata.com/api/v1/property/skip-trace');
  assert.deepEqual((calls[0].body as { requests: unknown[] }).requests[0], { propertyAddress: { street: '7104 JEFFERSON ST', city: 'Navarre', state: 'FL', zip: '32566' }, name: { first: 'Victoria', last: 'Aaron' } });
  assert.equal(results.length, 3);
  // Victoria: the highest score Mobile with dnc=false and tcpa=false wins over a higher-score DNC mobile and a land line; email kept.
  assert.equal(results[0].status, 'matched'); assert.equal(results[0].phone10, '8505550009'); assert.equal(results[0].score, 80); assert.equal(results[0].dnc, false); assert.equal(results[0].email, 'victoria@example.com'); assert.equal(results[0].phonesSeen, 3);
  // Arnold: no answer stays unknown instead of inheriting the next person's phone.
  assert.equal(results[1].status, 'unmatched'); assert.equal(results[1].phone10, null);
  // Jan: matched on the record's own address + name (case and ZIP+4 ignored), but no Mobile: phone stays null, line type reported.
  assert.equal(results[2].status, 'matched'); assert.equal(results[2].phone10, null); assert.equal(results[2].lineType, 'Land Line');
  assert.equal(TRACE_BATCH, 50); assert.equal(TRACE_CENTS_PER_PERSON, 7);
});

test('skip trace matching: duplicate identities inside a batch are never guessed, keys ignore punctuation and ZIP+4, an answer is used once', () => {
  const twins = [tracePeople[0], { ...tracePeople[0] }, tracePeople[1]];
  const matched = matchTraceResults(twins, [personFor(tracePeople[0], []), personFor(tracePeople[1], [], [], 'record')]);
  assert.deepEqual([...matched.keys()], [2], 'two identical requests: the one answer fits both, so neither is matched');
  assert.equal(traceRequestKey('Victoria', 'Aaron', '7104 Jefferson St.', '32566-1234'), traceRequestKey('VICTORIA', 'AARON', '7104 JEFFERSON ST', '32566'));
  const once = matchTraceResults([tracePeople[0], tracePeople[1]], [personFor(tracePeople[0], []), personFor(tracePeople[0], [])]);
  assert.deepEqual([...once.keys()], [0]);
  const picked = pickTracePhone({ phoneNumbers: [{ number: '(305) 555-0100', type: 'mobile', dnc: false, tcpa: true, score: 99 }, { number: '3055550101', type: 'Mobile', dnc: false, tcpa: false, score: 10 }], emails: ['a@b.co'] });
  assert.equal(picked.phone10, '3055550101', 'a litigator mobile is skipped for a clean one'); assert.equal(picked.email, 'a@b.co');
  const onlyDirty = pickTracePhone({ phoneNumbers: [{ number: '3055550100', type: 'Mobile', dnc: true, tcpa: false, score: 50 }] });
  assert.equal(onlyDirty.phone10, '3055550100'); assert.equal(onlyDirty.dnc, true, 'the only mobile is returned with its flags so the runner drops it as DNC, not as no mobile');
});

test('skipTrace: an empty batch, more than 50 persons or a person without a street is refused before any call; 403 insufficient balance is provider_balance_exhausted', async () => {
  let calls = 0;
  const provider = createBatchDataVerificationProvider('synthetic', async () => { calls++; return Response.json({ status: { code: 403, message: 'Insufficient balance' } }, { status: 403 }); });
  await assert.rejects(provider.skipTrace([]));
  await assert.rejects(provider.skipTrace(Array(51).fill(tracePeople[0])));
  await assert.rejects(provider.skipTrace([{ ...tracePeople[0], street: '' }]));
  assert.equal(calls, 0);
  await assert.rejects(provider.skipTrace([tracePeople[0]]), (error: unknown) => error instanceof LeadEngineError && error.code === 'provider_balance_exhausted');
  const broken = createBatchDataVerificationProvider('synthetic', async () => Response.json({ results: {} }));
  await assert.rejects(broken.skipTrace([tracePeople[0]]), (error: unknown) => error instanceof LeadEngineError && error.code === 'verification_unavailable');
});
