import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadBrain, route, coverage, matchIndustry, creditsForCells, capCentsForCredits, BrainError } from '../src/lib/lead-engine-brain.ts';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/brain-routes.json', import.meta.url), 'utf8')) as {
  cases: Array<{ industry: string; state: string; recipe: string; legalStatus: string; industryKey: string; expectedClean: number; creditsPerCleanCell: number; fallbackRecipe: string | null }>;
  unmatched: string[]; badStates: string[];
};
const brain = loadBrain();

test('the brain file loads and validates: version, four recipes, 44 industries, measured entries intact', () => {
  assert.equal(brain.version, '2026-09-21.1');
  assert.deepEqual(Object.keys(brain.recipes), ['A', 'B', 'C', 'D']);
  assert.equal(brain.industries.length, 44);
  assert.equal(brain.industries.filter(industry => industry.measuredBy === 'anas').length, 26);
  assert.equal(brain.creditValueUsd, 0.1); assert.equal(brain.spendCapRatio, 0.6); assert.equal(brain.rescrubDays, 31);
  assert.deepEqual(brain.dialWindow, { start: '08:00', end: '20:00' });
  assert.equal(brain.outputColumns.length, 20);
  assert.deepEqual(brain.recipes.A.paidSteps, ['scrape', 'verify']);
});

test('routing answers the shared fixture vectors (same file drives the Python mirror)', () => {
  for (const item of fixtures.cases) {
    const answer = route(item.industry, item.state);
    const label = `${item.industry} / ${item.state}`;
    assert.equal(answer.industry, item.industryKey, label);
    assert.equal(answer.recipe, item.recipe, label);
    assert.equal(answer.legalStatus, item.legalStatus, label);
    assert.equal(answer.expectedClean, item.expectedClean, label);
    assert.equal(answer.creditsPerCleanCell, item.creditsPerCleanCell, label);
    assert.equal(answer.fallbackRecipe, item.fallbackRecipe, label);
    assert.equal(answer.state, item.state.toUpperCase());
  }
});

test('build-plan acceptance: hvac FL is A, chiropractor direct line FL is D and legal, contractors SC is prohibited', () => {
  assert.equal(route('hvac', 'FL').recipe, 'A');
  const chiro = route('chiropractor direct line', 'FL');
  assert.equal(chiro.recipe, 'D'); assert.equal(chiro.legalStatus, 'ok'); assert.match(chiro.sources[0], /NPPES/);
  const sc = route('contractors', 'SC');
  assert.equal(sc.legalStatus, 'prohibited'); assert.equal(sc.fallbackRecipe, 'A'); assert.match(sc.legalNote ?? '', /LLR/);
});

test('unknown industries and malformed states fail loudly instead of routing to a guess', () => {
  for (const text of fixtures.unmatched) assert.equal(matchIndustry(text, 'FL'), null, text);
  for (const text of fixtures.unmatched) assert.throws(() => route(text, 'FL'), BrainError);
  for (const state of fixtures.badStates) assert.throws(() => route('hvac', state), BrainError);
});

test('a state the brain never measured still routes recipe A and marks register recipes as missing a source', () => {
  assert.equal(route('plumbing', 'OH').recipe, 'A');
  const cpa = route('cpa', 'OH');
  assert.equal(cpa.legalStatus, 'restricted'); assert.equal(cpa.fallbackRecipe, 'A'); assert.deepEqual(cpa.sources, []);
});

test('coverage grid: one cell per industry and state, prohibited states greyed out, recipe A always available', () => {
  const grid = coverage();
  assert.equal(grid.length, 44 * Object.keys(brain.states).length);
  const sc = grid.filter(cell => cell.state === 'SC');
  assert.ok(sc.filter(cell => cell.recipe !== 'A').every(cell => !cell.available));
  assert.ok(sc.filter(cell => cell.recipe === 'A').every(cell => cell.available));
  assert.ok(grid.find(cell => cell.industry === 'contractor_registry' && cell.state === 'CA')?.available);
});

test('money: 500 cells of recipe A hold 1,000 credits and let the engine spend at most $60', () => {
  assert.equal(creditsForCells(500, brain.recipes.A.creditsPerCleanCell), 1000);
  assert.equal(capCentsForCredits(1000), 6000);
  assert.equal(capCentsForCredits(10), 60);
});

test('a corrupted brain is refused on load, never at the first paid call', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/lead-engine-brain.json', import.meta.url), 'utf8')) as Record<string, unknown>;
  assert.throws(() => loadBrain({ ...raw, spend_cap_ratio: 1.5 }), BrainError);
  assert.throws(() => loadBrain({ ...raw, dial_window_local: { start: '08:00', end: '21:00' } }), BrainError);
  assert.throws(() => loadBrain({ ...raw, industries: { hvac: { recipe: 'Z', expected_clean: 0.2 } } }), BrainError);
  assert.throws(() => loadBrain({ ...raw, output_columns: ['#'] }), BrainError);
});
