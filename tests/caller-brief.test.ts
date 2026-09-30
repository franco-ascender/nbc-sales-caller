import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidateScenario, renderScenarioBrief, briefLimits } from '../src/lib/caller-brief.ts';
import { emptyCallerContext } from '../src/lib/caller-context.ts';
import { defaultPhoneScenario } from '../src/lib/caller-default-scenario.ts';
import { compileScenarioPrompt, parseConversationScenario } from '../src/lib/caller-knowledge.ts';

const legacy = { ...defaultPhoneScenario, context: { ...emptyCallerContext(), business: 'Operates only in Florida.', leadSource: 'Requested a service comparison.', nextStep: 'Offer a discovery conversation after confirming fit.', boundaries: 'No fixed lead-volume guarantee.', qualification: 'Do not qualify businesses outside Florida.', proof: 'A weekly reporting walkthrough is available.', answers: [{ kind: 'objection' as const, question: 'I was burned by an agency.', answer: 'What specifically fell short with that agency?' }] } };

test('consolidating old saved briefs preserves every distinct fact and is idempotent', () => {
  const before = structuredClone(legacy), current = consolidateScenario(legacy);
  assert.deepEqual(legacy, before, 'Opening an old version does not mutate its snapshot');
  assert.equal(current.briefVersion, 2);
  for (const [field, previous] of [['agentRole', 'business'], ['prospectProfile', 'leadSource'], ['objective', 'nextStep'], ['ticket', 'boundaries']] as const) {
    assert.ok(current[field].includes(legacy[field]));
    assert.ok(current[field].includes(legacy.context[previous]));
    assert.equal(current.context?.[previous], '');
  }
  assert.deepEqual(consolidateScenario(current), current);
  assert.deepEqual(parseConversationScenario(current), current);
  assert.equal(current.objections, legacy.objections);
  assert.equal(current.instructions, legacy.instructions);
  assert.deepEqual(current.context?.answers, legacy.context.answers);
});

test('legacy maximum-length fields combine without truncation and remain editable/savable', () => {
  const current = consolidateScenario({ ...defaultPhoneScenario, agentRole: 'a'.repeat(600), objective: 'b'.repeat(1000), prospectProfile: 'c'.repeat(1400), ticket: 'd'.repeat(300), context: { ...emptyCallerContext(), business: 'e'.repeat(1800), nextStep: 'f'.repeat(1800), leadSource: 'g'.repeat(1800), boundaries: 'h'.repeat(1800) } });
  assert.deepEqual(parseConversationScenario(current), current);
  assert.equal(current.agentRole.length, 2402);
  assert.equal(current.objective.length, 2802);
  assert.equal(current.prospectProfile.length, 3202);
  assert.equal(current.ticket.length, 2102);
  for (const [key, max] of Object.entries(briefLimits)) assert.throws(() => parseConversationScenario({ ...current, [key]: 'X'.repeat(max + 1) }));
  assert.throws(() => parseConversationScenario({ ...current, briefVersion: 3 }));
});

test('preview and runtime use a single fact block, with exact paragraph duplicates removed', () => {
  const input = { ...legacy, agentRole: 'Unique business fact.', context: { ...legacy.context, business: 'Unique business fact.' } };
  const preview = renderScenarioBrief(input), compiled = compileScenarioPrompt(input).prompt;
  assert.equal(preview.split('Unique business fact.').length - 1, 1);
  assert.equal(compiled.split(preview).length - 1, 1);
  for (const fact of [legacy.context.leadSource, legacy.context.nextStep, legacy.context.boundaries, legacy.context.qualification, legacy.context.proof]) assert.equal(compiled.split(fact).length - 1, 1);
  assert.equal(compileScenarioPrompt(consolidateScenario(input)).prompt, compiled, 'Same behavior before/after saving in the optimized editor');
});

test('qualification, commercial uncertainty, unpaired objections and tool limits have explicit response rules', () => {
  const compiled = compileScenarioPrompt({ ...legacy, ticket: '', context: { ...legacy.context, boundaries: 'Contract length is not confirmed.' } }).prompt;
  assert.ok(!compiled.includes('Approved price for this simulation:'), 'A boundary alone must not be labeled as a confirmed price');
  assert.match(compiled, /disqualifier is clear/);
  assert.match(compiled, /not answers or evidence/);
  assert.match(compiled, /not confirmed.*remains unknown/);
  assert.match(compiled, /facts conflict/);
  assert.match(compiled, /successful connected-tool receipt/);
  assert.match(compiled, /When information is missing/);
  assert.match(compiled, /An opt-out takes priority/);
});
