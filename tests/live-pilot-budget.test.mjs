import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { openPilotBudget, ALLOCATIONS } from '../scripts/lib/live-pilot-budget.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'nbc-pilot-'));
  const path = join(dir, 'ledger.sqlite');
  const budget = openPilotBudget(path, { initialize: true });
  t.after(() => { budget.close(); rmSync(dir, { recursive: true, force: true }); });
  return { path, budget };
}
test('enforces the full round and each allocation, without recycling confirmed usage', t => {
  const { budget } = fixture(t);
  for (const [allocation, cap] of Object.entries(ALLOCATIONS)) budget.reserve(allocation, allocation, allocation.startsWith('caller') ? 'elevenlabs-twilio' : 'apify', cap);
  budget.observe('roofing-miami', 'completed', { run: 'fixture' }, 0.20);
  assert.equal(budget.summary().reservedUsd, 25);
  assert.throws(() => budget.reserve('extra', 'roofing-miami', 'apify', 1), /budget exceeded/);
  assert.equal(budget.summary().reportedUsageUsd, 0.20);
});
test('reservations survive reopening and ambiguous dispatch cannot be retried', t => {
  const { budget, path } = fixture(t);
  budget.reserve('first', 'roofing-miami', 'apify', 50);
  budget.observe('first', 'uncertain', { reason: 'network_timeout' });
  const reopened = openPilotBudget(path, { initialize: true });
  try { assert.throws(() => reopened.reserve('first', 'roofing-miami', 'apify', 50), /already has a reservation/); assert.equal(reopened.summary().reservedUsd, .50); }
  finally { reopened.close(); }
});
test('rejects excluded providers, unapproved allocations, invalid costs and regression', t => {
  const { budget } = fixture(t);
  assert.throws(() => budget.reserve('a', 'roofing-miami', 'outscraper', 50));
  assert.throws(() => budget.reserve('a', 'new-city', 'apify', 50));
  for (const cost of [0, -1, 0.5, NaN, Infinity]) assert.throws(() => budget.reserve('a', 'roofing-miami', 'apify', cost));
  budget.reserve('a', 'roofing-miami', 'apify', 50);
  assert.throws(() => budget.observe('a', 'completed', {}, 1), /exceeds reservation/);
  budget.observe('a', 'completed', {}, 0.2);
  assert.throws(() => budget.observe('a', 'running', {}), /cannot regress/);
});
test('two processes cannot acquire the same paid operation', async t => {
  const { path, budget } = fixture(t);
  const module = new URL('../scripts/lib/live-pilot-budget.mjs', import.meta.url).href;
  const source = `import {openPilotBudget} from ${JSON.stringify(module)};
    const b=openPilotBudget(process.argv[1]);try{b.reserve('race','roofing-miami','apify',50);process.exitCode=0;}catch{process.exitCode=3;}finally{b.close();}`;
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', source, path], { stdio: 'ignore' });
    child.on('error', reject); child.on('exit', resolve);
  });
  const codes = await Promise.all([run(), run()]);
  assert.deepEqual(codes.sort(), [0, 3]);
  assert.equal(budget.summary().reservedUsd, .5);
});
