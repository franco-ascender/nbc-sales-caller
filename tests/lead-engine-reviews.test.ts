import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractOwnerFromText, pickOwnerName, stripHtml, reviewCorpus, reviewBucketOf, MAX_REVIEWS_PER_LISTING } from '../src/lib/lead-engine-reviews.ts';
import { createReviewsScraper, createAnthropicOwnerModel, extractOwnersForRows, reviewsCents, anthropicCents, fetchAboutPages, APIFY_REVIEWS_ACTOR_ID, ANTHROPIC_MODEL } from '../src/services/lead-engine-reviews.service.ts';
import type { ReviewsScraper, OwnerModel } from '../src/services/lead-engine-reviews.service.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const names = (text: string) => extractOwnerFromText(text).map(c => `${c.first}${c.last ? ' ' + c.last : ''}`);

test('extractor: English review phrasings name the owner and nothing else', () => {
  assert.deepEqual(names('The owner, Mike, came out himself to fix the leak.'), ['Mike']);
  assert.deepEqual(names('Owner Mike came out the same day and was super professional.'), ['Mike']);
  assert.deepEqual(names('Mike the owner is honest and fair.'), ['Mike']);
  assert.deepEqual(names('Talked with Mike (owner) about the quote.'), ['Mike']);
  assert.deepEqual(names('Family business owned by Mike Smith since 2004.'), ['Mike Smith']);
  assert.deepEqual(names('Thanks Sarah, owner, for squeezing us in!'), ['Sarah']);
  assert.deepEqual(names('The owner is Dave and he answers his own phone.'), ['Dave']);
  const es = extractOwnerFromText('El dueño, Miguel, nos atendió personalmente. Miguel es el dueño y siempre está.');
  assert.deepEqual(es.map(c => c.first), ['Miguel', 'Miguel']); assert.ok(es.every(c => c.language === 'es'));
  assert.deepEqual(names('La propietaria Ana me explicó todo. Gracias Ana!'), ['Ana']);
});

test('extractor: about page titles, and rejects for generic words, honorifics and staff titles', () => {
  assert.deepEqual(names('Meet the Team. Jane Smith, Owner & Lead Injector. Bob Lee - Office Manager.'), ['Jane Smith']);
  assert.deepEqual(names('Founder: Carlos Ruiz. Proprietor: Anne Marie'), ['Carlos Ruiz', 'Anne Marie']);
  assert.deepEqual(names('The owner was great and the staff is friendly. The owner is very rude.'), []);
  assert.deepEqual(names('Owner Great service! The owner Himself called.'), []);
  assert.deepEqual(names('the owner, Dr. , came out'), []);
  assert.deepEqual(names('Receptionist Lisa was helpful; manager Tom too.'), []);
  assert.deepEqual(names('Owned by The Company Inc since forever.'), []);
  assert.deepEqual(names(''), []);
  const about = stripHtml('<html><head><style>p{}</style><script>var owner="Nope"</script></head><body><h3>Jane Smith</h3><p>Owner &amp; Founder</p><br><div>Bob</div></body></html>');
  assert.equal(about, 'Jane Smith . Owner & Founder . Bob .');
  assert.deepEqual(names(about), ['Jane Smith']);
});

test('pickOwnerName: majority vote, last name from the plurality, ties and weak singles return null', () => {
  const candidates = extractOwnerFromText('Owner Mike came out. Mike the owner was here. Mike Smith (owner) followed up. Steve the owner? no, Steve is the manager.');
  const pick = pickOwnerName(candidates);
  assert.ok(pick); assert.equal(pick.first, 'Mike'); assert.equal(pick.last, 'Smith'); assert.ok(pick.votes >= 3); assert.equal(pick.confidence, 1);
  assert.equal(pickOwnerName(extractOwnerFromText('Owner Mike came out.'), 0.8), null, 'one casual mention is below a 0.8 bar');
  assert.equal(pickOwnerName(extractOwnerFromText('Thanks Sarah, owner!'))?.votes, 1, 'one mention, one vote, even when two rules can read it');
  assert.equal(pickOwnerName([{ first: 'A', last: null, evidence: '', language: 'en', confidence: 0.8, pattern: 'x' }, { first: 'B', last: null, evidence: '', language: 'en', confidence: 0.8, pattern: 'x' }]), null, 'tie');
  assert.equal(pickOwnerName([]), null);
  const corpus = reviewCorpus(Array.from({ length: 40 }, (_, i) => ({ text: `Review number ${i}`, ownerReply: i === 0 ? 'Thanks! - Mike, owner' : null, language: 'en' })));
  assert.equal(corpus.split('\n').filter(line => line.startsWith('Review ')).length, MAX_REVIEWS_PER_LISTING);
  assert.equal(reviewBucketOf([], [{ text: 'x', ownerReply: 'Thank you! Mike, owner', language: 'en' }]), 'owner_reply');
  assert.equal(reviewBucketOf([], [{ text: 'x', ownerReply: null, language: 'en' }]), 'none');
});

const run = (status: string) => ({ data: { id: 'runRUNRUNrunRUN123', defaultDatasetId: 'dsDSDSdsDSDSds1234', status } });
const response = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

test('apify reviews scraper: request shape (actor, 25 newest, no personal data, cap floor), run parsing, dataset grouping', async () => {
  const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
  const request: typeof fetch = async (input, init) => {
    const url = String(input); seen.push({ url, init });
    if (url.includes('/runs?')) return response(run('RUNNING'), { status: 201 });
    if (url.includes('/actor-runs/')) return response(run('SUCCEEDED'));
    if (url.includes('/datasets/')) return response([{ placeId: 'p1', text: 'Owner Mike came out today.', responseFromOwnerText: null, originalLanguage: 'en' }, { placeId: 'p1', text: null, textTranslated: 'Mike the owner is great', originalLanguage: 'es' }, { placeId: 'p2', text: 'ok' }, { nope: true }]);
    return response({}, { status: 404 });
  };
  const scraper = createReviewsScraper('token', request);
  const started = await scraper.start(['p1', 'p2'], 3);
  assert.equal(started.status, 'running');
  const startCall = seen[0];
  assert.match(startCall.url, new RegExp(`acts/${APIFY_REVIEWS_ACTOR_ID}/runs\\?`)); assert.match(startCall.url, /maxTotalChargeUsd=0\.50/);
  const body = JSON.parse(String(startCall.init?.body));
  assert.deepEqual(body.placeIds, ['p1', 'p2']); assert.equal(body.maxReviews, 25); assert.equal(body.reviewsSort, 'newest'); assert.equal(body.personalData, false);
  assert.equal((startCall.init?.headers as Record<string, string>).Authorization, 'Bearer token');
  assert.equal((await scraper.poll(started.runId)).status, 'succeeded');
  const reviews = await scraper.reviews(started.datasetId);
  assert.equal(reviews.get('p1')?.length, 2); assert.equal(reviews.get('p1')?.[1].text, 'Mike the owner is great'); assert.equal(reviews.get('p2')?.length, 1); assert.equal(reviews.size, 2);
  await assert.rejects(scraper.start([], 100), /between 1 and 200/);
  await assert.rejects(scraper.poll('bad'), /invalid run id/);
  assert.throws(() => createReviewsScraper(''), /not configured/);
  assert.equal(reviewsCents(10), Math.ceil(10 * 25 * 0.06 + 0.005));
});

test('anthropic owner model: JSON-only request to the Messages API, names must be quoted from the corpus, refusals return null', async () => {
  const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
  let answer = '{"first":"Mike","last":"Smith","evidence":"Mike Smith the owner","language":"en"}';
  const request: typeof fetch = async (input, init) => { seen.push({ url: String(input), init }); return response({ content: [{ type: 'text', text: answer }], stop_reason: 'end_turn' }); };
  const model = createAnthropicOwnerModel('sk-test', request);
  const corpus = 'Review 1: Mike Smith the owner came out.';
  const found = await model.extract(corpus);
  assert.ok(found); assert.equal(found.first, 'Mike'); assert.equal(found.last, 'Smith'); assert.equal(found.pattern, 'model');
  assert.equal(seen[0].url, 'https://api.anthropic.com/v1/messages');
  const headers = seen[0].init?.headers as Record<string, string>;
  assert.equal(headers['x-api-key'], 'sk-test'); assert.equal(headers['anthropic-version'], '2023-06-01');
  const body = JSON.parse(String(seen[0].init?.body));
  assert.equal(body.model, ANTHROPIC_MODEL); assert.equal(body.max_tokens, 200); assert.match(body.system, /JSON only/); assert.equal(body.messages[0].content, corpus);
  answer = '{"first":"Bob","last":null,"evidence":null,"language":"en"}';
  assert.equal(await model.extract(corpus), null, 'a name not in the corpus is a guess');
  answer = '{"first":null,"last":null,"evidence":null,"language":null}';
  assert.equal(await model.extract(corpus), null);
  answer = 'not json';
  assert.equal(await model.extract(corpus), null);
  assert.equal(await model.extract('   '), null);
  assert.ok(model.estimateCents(corpus) >= 1); assert.equal(anthropicCents(8000), Math.ceil(2000 * 0.0001 + 200 * 0.0005));
  const failing = createAnthropicOwnerModel('sk-test', async () => response({ error: { type: 'overloaded_error' } }, { status: 529 }));
  await assert.rejects(failing.extract(corpus), /HTTP 529: overloaded_error/);
  assert.throws(() => createAnthropicOwnerModel('bad\nkey'), /not configured/);
});

test('about pages: same-origin GETs on the documented paths, non-HTML skipped, bad hosts return nothing', async () => {
  const urls: string[] = [];
  const request: typeof fetch = async input => {
    const url = String(input); urls.push(url);
    if (url.endsWith('/about')) return new Response('<h2>Jane Smith</h2><p>Owner</p>', { headers: { 'content-type': 'text/html' } });
    if (url.endsWith('/team')) return new Response('{"x":1}', { headers: { 'content-type': 'application/json' } });
    return new Response('<p>Welcome</p>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  const text = await fetchAboutPages('acmeroofing.example', request);
  assert.match(text, /Jane Smith \. Owner/);
  assert.ok(urls.every(url => url.startsWith('https://acmeroofing.example/')));
  assert.equal(await fetchAboutPages('not a url', request), ''); assert.equal(await fetchAboutPages('ftp://x.y', request), '');
});

interface Charge { vendor: string; step: string; units: number; cents: number }
function fakeDb(allow: (charge: Charge) => boolean) {
  const charges: Charge[] = []; const updates: Array<Record<string, unknown>> = [];
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      assert.equal(name, 'lead_engine_meter');
      const charge = { vendor: String(args.p_vendor), step: String(args.p_step), units: Number(args.p_units), cents: Number(args.p_cents) };
      charges.push(charge);
      return Promise.resolve({ data: allow(charge) ? { allowed: true, reason: 'ok' } : { allowed: false, reason: 'daily_ceiling' }, error: null });
    },
    from: (table: string) => {
      assert.equal(table, 'lead_engine_job_rows');
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { verification: { lineType: 'Mobile' } }, error: null }) }) }),
        update: (patch: Record<string, unknown>) => ({ eq: () => ({ is: () => { updates.push(patch); return Promise.resolve({ error: null }); } }) }),
      };
    },
  } as unknown as SupabaseClient;
  return { db, charges, updates };
}
const job = { id: 'job-1', operator_id: 'op-1' };
const rows = [
  { id: 'r1', name: 'Acme Roofing', place_id: 'p1', website: 'acme.example', owner_name: null, line_type: 'Mobile' },
  { id: 'r2', name: 'Bob Plumbing', place_id: 'p2', website: null, owner_name: null, line_type: 'Mobile' },
  { id: 'r3', name: 'Zed HVAC', place_id: 'p3', website: null, owner_name: null, line_type: 'Mobile' },
  { id: 'r4', name: 'Named Already', place_id: 'p4', website: null, owner_name: 'Ann Named' },
  { id: 'r5', name: 'Landline Co', place_id: 'p5', website: null, owner_name: null, line_type: 'Landline' },
];
function scraper(reviewsByPlace: Record<string, Array<{ text: string | null; ownerReply: string | null }>>): ReviewsScraper & { started: string[][] } {
  const started: string[][] = [];
  return {
    started,
    start: async placeIds => { started.push(placeIds); return { runId: 'run', datasetId: 'ds', status: 'succeeded' }; },
    poll: async () => ({ runId: 'run', datasetId: 'ds', status: 'succeeded' }),
    reviews: async () => new Map(Object.entries(reviewsByPlace).map(([place, list]) => [place, list.map(item => ({ ...item, language: 'en' }))])),
  };
}
const aboutFetch: typeof fetch = async input => new Response(String(input).endsWith('/about') ? '<h1>Jane Acme, Owner</h1>' : '<p>hi</p>', { headers: { 'content-type': 'text/html' } });

test('missing or null line evidence never starts extraction, meters or provider requests', async () => {
  const { db, charges, updates } = fakeDb(() => true);
  const apify = scraper({});
  const unverified = [undefined, null, 'Landline', 'VoIP'].map((line_type, index) => ({ ...rows[0], id: `unknown-${index}`, line_type }));
  const result = await extractOwnersForRows(db, job, unverified, { apify, anthropic: null }, { request: async () => { throw Error('Unverified rows must not fetch'); } });
  assert.deepEqual(apify.started, []);
  assert.deepEqual(charges, []);
  assert.deepEqual(updates, []);
  assert.equal(result.results.length, 0);
});

test('extractOwnersForRows: free website first, reviews behind the apify meter, model only where the rules found nothing and behind the anthropic meter', async () => {
  const { db, charges, updates } = fakeDb(() => true);
  const apify = scraper({ p2: [{ text: 'Owner Bob came out and fixed it.', ownerReply: null }, { text: 'Bob the owner rocks', ownerReply: null }], p3: [{ text: 'Great work, fair price.', ownerReply: 'Thank you!' }] });
  const asked: string[] = [];
  const anthropic: OwnerModel = { estimateCents: () => 1, extract: async corpus => { asked.push(corpus); return { first: 'Zed', last: 'Zimmer', evidence: 'Zed Zimmer', language: 'en', confidence: 0.7, pattern: 'model' }; } };
  const result = await extractOwnersForRows(db, job, rows, { apify, anthropic }, { request: aboutFetch });
  assert.deepEqual(apify.started, [['p2', 'p3']], 'r1 solved for free, r4 named, r5 not mobile: only p2 and p3 go to the scraper');
  const byId = Object.fromEntries(result.results.map(item => [item.rowId, item]));
  assert.equal(byId.r1.method, 'about_page'); assert.equal(byId.r1.owner?.first, 'Jane'); assert.equal(byId.r1.owner?.last, 'Acme');
  assert.equal(byId.r2.method, 'reviews'); assert.equal(byId.r2.owner?.first, 'Bob'); assert.equal(byId.r2.reviewBucket, 'owner_named');
  assert.equal(byId.r3.method, 'model'); assert.equal(byId.r3.owner?.first, 'Zed'); assert.equal(byId.r3.owner?.last, 'Zimmer'); assert.equal(byId.r3.reviewsRead, 1);
  assert.equal(asked.length, 1, 'the model ran once, for the one row the rules could not name'); assert.match(asked[0], /fair price/);
  assert.equal(result.results.length, 3, 'r4 and r5 were never candidates');
  assert.deepEqual(charges.map(c => `${c.vendor}:${c.step}:${c.units}`), ['apify:reviews:50', 'anthropic:reviews:1']);
  assert.equal(result.spentCents, charges.reduce((sum, c) => sum + c.cents, 0));
  assert.equal(updates.length, 3); assert.equal(updates[0].owner_name, 'Jane Acme'); assert.equal((updates[1].verification as Record<string, unknown>).owner_source, 'reviews'); assert.equal(updates[2].owner_name, 'Zed Zimmer');
  assert.equal(result.apifyRun, null); assert.equal(result.stopped, null);
});

test('extractOwnersForRows: a denied meter means no vendor call and a clear stop reason; a running run comes back to resume', async () => {
  const denied = fakeDb(() => false);
  const apify = scraper({});
  const anthropic: OwnerModel = { estimateCents: () => 1, extract: async () => { throw new Error('must not be called'); } };
  const result = await extractOwnersForRows(denied.db, job, rows.slice(1, 3), { apify, anthropic });
  assert.deepEqual(apify.started, []); assert.match(result.stopped ?? '', /daily_ceiling/); assert.equal(result.spentCents, 0);
  assert.ok(result.results.every(item => item.method === 'none'));
  const running: ReviewsScraper = { ...scraper({}), start: async () => ({ runId: 'run', datasetId: 'ds', status: 'running' }) };
  const pending = await extractOwnersForRows(fakeDb(() => true).db, job, rows.slice(1, 3), { apify: running, anthropic: null });
  assert.equal(pending.apifyRun?.status, 'running');
  const none = await extractOwnersForRows(fakeDb(() => true).db, job, rows.slice(1, 3), { apify: null, anthropic: null });
  assert.equal(none.spentCents, 0); assert.ok(none.results.every(item => item.method === 'none'));
});
