import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOwnerProbability, featuresFromLedger, scoreDialRows, SCORE_WEIGHTS } from '../src/lib/lead-engine-score.ts';
import type { ScoreFeatures } from '../src/lib/lead-engine-score.ts';

const base: ScoreFeatures = { recipe: 'A', bucket: null, source_register: 'google_maps', title_code: null, business_type: null, phone_reuse_count: null, register_eq_maps: null, line_type: 'Mobile', review_bucket: null, personnel_count: null, permit_velocity: null, license_age_years: null, reviews: null, state: 'FL', industry: 'hvac' };

test('score: weights sum to 1, results stay within 0 to 100 and list every factor', () => {
  assert.equal(Math.round(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0) * 100), 100);
  const low = scoreOwnerProbability({ ...base, line_type: 'Landline', source_register: 'google_maps', business_type: 'corp', personnel_count: 40, phone_reuse_count: 9 });
  const high = scoreOwnerProbability({ ...base, recipe: 'D', bucket: 2, source_register: 'fl_dbpr', title_code: 'owner', business_type: 'sole_proprietor', personnel_count: 1 });
  assert.ok(low.score >= 0 && low.score < 25, `low ${low.score}`);
  assert.ok(high.score >= 90 && high.score <= 100, `high ${high.score}`);
  assert.deepEqual(high.factors.map(f => f.key), ['source', 'phone_differs', 'mobile', 'name_match', 'sole_proprietor', 'small_business']);
  assert.equal(high.factors.reduce((sum, f) => sum + f.points, 0) > 0, true);
  assert.deepEqual(high.context, { state: 'FL', industry: 'hvac' });
});

test('score: the §8 factors move the score in the documented direction', () => {
  const at = (patch: Partial<ScoreFeatures>) => scoreOwnerProbability({ ...base, ...patch }).score;
  assert.ok(at({ recipe: 'D', bucket: 2, source_register: 'fl_dbpr' }) > at({ recipe: 'D', bucket: 3, source_register: 'fl_dbpr', register_eq_maps: true }), 'phones differ beats business line');
  assert.ok(at({ line_type: 'Mobile' }) > at({ line_type: 'VoIP' }), 'mobile');
  assert.ok(at({ title_code: 'owner' }) > at({ title_code: 'rme' }), 'owner title beats staff title');
  assert.ok(at({ review_bucket: 'owner_named' }) > at({ review_bucket: 'none' }), 'reviews naming the owner');
  assert.ok(at({ business_type: 'sole_proprietor' }) > at({ business_type: 'corp' }), 'sole proprietor');
  assert.ok(at({ personnel_count: 2 }) > at({ personnel_count: 30 }), 'small business');
  assert.ok(at({ personnel_count: 2, permit_velocity: 60 }) < at({ personnel_count: 2, permit_velocity: 3 }), 'permit velocity');
  assert.ok(at({ source_register: 'fl_dbpr', phone_reuse_count: 5 }) < at({ source_register: 'fl_dbpr', phone_reuse_count: 1 }), 'phone reuse');
  assert.ok(at({ recipe: 'D', bucket: 1, source_register: 'fl_dbpr' }) > at({ recipe: 'A' }), 'licensed but invisible beats a bare Maps row');
});

test('featuresFromLedger reads the frozen JSON defensively and derives license age', () => {
  const features = featuresFromLedger({ recipe: 'D', bucket: 2, source_register: 'fl_dbpr', title_code: 'owner', phone_reuse_count: 1, register_eq_maps: false, license_issue_date: '2015-01-01', reviews: 12, state: 'FL', industry: 'roofing', junk: { a: 1 } });
  assert.equal(features.bucket, 2); assert.equal(features.recipe, 'D'); assert.equal(features.line_type, 'Mobile');
  assert.ok((features.license_age_years ?? 0) > 10);
  const empty = featuresFromLedger({}, null);
  assert.equal(empty.recipe, null); assert.equal(empty.line_type, null); assert.equal(scoreOwnerProbability(empty).score >= 0, true);
});

test('scoreDialRows sorts highest owner probability first and is stable', () => {
  const rows = [
    { id: 'a', features: { ...base } },
    { id: 'b', features: { ...base, recipe: 'D' as const, bucket: 2 as const, source_register: 'fl_dbpr', title_code: 'owner' } },
    { id: 'c', features: { ...base } },
  ];
  const sorted = scoreDialRows(rows);
  assert.deepEqual(sorted.map(row => row.id), ['b', 'a', 'c']);
  assert.ok(sorted[0].score > sorted[1].score); assert.equal(sorted[1].score, sorted[2].score);
});
