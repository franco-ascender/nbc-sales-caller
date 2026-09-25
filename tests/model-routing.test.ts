import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
// @ts-expect-error The tested local CLI is intentionally plain ESM JavaScript.
import { routeTask } from '../scripts/route-lane-task.mjs';

const execFile = promisify(execFileCallback);

const policy = {
  version: 1,
  verifiedAt: '2026-09-16',
  defaults: { provider: 'codex', maxAttempts: 2 },
  tiers: {
    routine: { codex: { model: 'luna', effort: 'low' }, claude: { model: 'haiku', effort: 'low' } },
    implementation: { codex: { model: 'terra', effort: 'medium' }, claude: { model: 'sonnet', effort: 'medium' } },
    critical: { codex: { model: 'sol', effort: 'high' }, claude: { model: 'opus', effort: 'high' } },
    exceptional: { codex: { model: 'astra', effort: 'high' }, claude: { model: 'opus', effort: 'high' } },
  },
  taskTiers: { docs: 'routine', integration: 'implementation', orchestration: 'implementation', auth: 'critical', billing: 'critical', migration: 'critical', architecture: 'critical' },
  escalation: ['routine', 'implementation', 'critical', 'exceptional'],
  orchestrator: { provider: 'codex', model: 'gpt-6-astra', effort: 'high' },
};

test('routes a normal task to the default provider and declared tier', () => {
  const route = routeTask(policy, { task: 'integration' });
  assert.deepEqual({ tier: route.tier, model: route.model, effort: route.effort, provider: route.provider, status: route.status }, {
    tier: 'implementation', model: 'terra', effort: 'medium', provider: 'codex', status: 'ready',
  });
  assert.match(route.limitations.join(' '), /Does not execute a provider API/);
});

test('risk and protected tasks require the critical tier', () => {
  assert.equal(routeTask(policy, { task: 'docs', risk: 'high' }).tier, 'critical');
  assert.equal(routeTask(policy, { task: 'auth', risk: 'low' }).tier, 'critical');
});

test('attempt limit requires a replan without selecting a model', () => {
  const route = routeTask(policy, { task: 'integration', attempts: 2 });
  assert.equal(route.status, 'needs_replan');
  assert.equal(route.model, null);
  assert.equal(route.effort, null);
});

test('orchestration has a fixed Astra route while retaining the attempt quality gate', () => {
  const route = routeTask(policy, { task: 'orchestration', risk: 'high', escalate: true, reason: 'failure reproduced' });
  assert.deepEqual({ tier: route.tier, provider: route.provider, model: route.model, effort: route.effort, status: route.status }, {
    tier: 'orchestration', provider: 'codex', model: 'gpt-6-astra', effort: 'high', status: 'ready',
  });
  const replan = routeTask(policy, { task: 'orchestration', attempts: 2 });
  assert.equal(replan.status, 'needs_replan');
  assert.equal(replan.model, null);
  assert.throws(() => routeTask(policy, { task: 'orchestration', provider: 'claude', billing: 'api', claudeAvailable: true }), /fixed Codex role/);
  assert.throws(() => routeTask({ ...policy, orchestrator: { provider: 'codex', model: 'other', effort: 'high' } }, { task: 'orchestration' }), /orchestrator/);
});

test('escalation advances one tier and exceptional routing needs its explicit flag', () => {
  assert.equal(routeTask(policy, { task: 'docs', escalate: true, reason: 'test failure reproduced' }).tier, 'implementation');
  const review = routeTask(policy, { task: 'auth', escalate: true, reason: 'security review failed' });
  assert.equal(review.status, 'needs_exception_review');
  assert.equal(routeTask(policy, { task: 'auth', exceptional: true, reason: 'security review failed' }).tier, 'exceptional');
  assert.throws(() => routeTask(policy, { task: 'docs', escalate: true }), /reason/);
  const exceptionalTaskPolicy = { ...policy, taskTiers: { ...policy.taskTiers, docs: 'exceptional' } };
  assert.equal(routeTask(exceptionalTaskPolicy, { task: 'docs' }).status, 'needs_exception_review');
});

test('Claude requires both explicit availability and known billing', () => {
  assert.equal(routeTask(policy, { task: 'docs', provider: 'claude', billing: 'api' }).status, 'needs_access');
  assert.equal(routeTask(policy, { task: 'docs', provider: 'claude', claudeAvailable: true }).status, 'needs_billing_confirmation');
  assert.equal(routeTask(policy, { task: 'docs', provider: 'claude', claudeAvailable: true, billing: 'included' }).status, 'ready');
});

test('rejects invalid values and produces reproducible CLI JSON from another cwd', async () => {
  assert.throws(() => routeTask(policy, { task: 'unknown' }), /configured task/);
  assert.throws(() => routeTask(policy, { task: 'docs', attempts: 0.5 }), /non-negative integer/);
  assert.throws(() => routeTask({ ...policy, version: 2 }, { task: 'docs' }), /version/);
  assert.throws(() => routeTask({ ...policy, defaults: { ...policy.defaults, maxAttempts: 0 } }, { task: 'docs' }), /positive safe integer/);
  assert.throws(() => routeTask({ ...policy, escalation: ['routine', 'routine', 'critical', 'exceptional'] }, { task: 'docs' }), /escalation/);
  assert.throws(() => routeTask({ ...policy, tiers: { ...policy.tiers, routine: { ...policy.tiers.routine, codex: { model: '', effort: 'low' } } } }, { task: 'docs' }), /routine.codex/);
  const cli = fileURLToPath(new URL('../scripts/route-lane-task.mjs', import.meta.url));
  const { stdout } = await execFile(process.execPath, [cli, '--task', 'integration'], { cwd: '/tmp' });
  const output = JSON.parse(stdout);
  assert.equal(output.status, 'ready');
  assert.equal(output.model, 'gpt-5.6-terra');
  const invalid = await execFile(process.execPath, [cli, '--task', 'docs', '--attempts', '1e2'], { cwd: '/tmp' }).catch((error: { stdout: string }) => error);
  assert.equal(JSON.parse(invalid.stdout).status, 'invalid_input');
});
