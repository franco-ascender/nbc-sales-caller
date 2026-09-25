import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateWorkflow, workflowLayout, benchmarkLabel, type WorkflowNode } from '../src/lib/lead-engine-workflows.ts';
import { inspectWorkflowRoutes } from '../src/lib/lead-engine-workflow-routing.ts';
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('every live industry has a validated, exactly packaged review with no fabricated paid outcomes', () => {
  const brain = read('../src/data/lead-engine-brain.json');
  const bundle = read('../src/data/lead-engine-workflows.json');
  assert.deepEqual(Object.keys(bundle).sort(), Object.keys(brain.industries).sort());
  for (const key of Object.keys(brain.industries)) {
    const review = read(`../src/data/industry-workflows/${key}.json`);
    validateWorkflow(review, key);
    assert.deepEqual(bundle[key], review);
    assert.ok(review.workflow.some((node: WorkflowNode) => node.kind === 'hold'), `${key} must expose failed/uncertain path`);
  }
});

test('diagrams preserve a diamond decision and reject cycles, unknown references and disconnected nodes', () => {
  const nodes: WorkflowNode[] = ['start', 'accept', 'hold', 'end'].map(id => ({ id, label: id, detail: id, kind: 'decision' }));
  const edges = [{from:'start',to:'accept',label:'yes'},{from:'start',to:'hold',label:'no'},{from:'accept',to:'end',label:'pass'}];
  const graph = workflowLayout(nodes, edges);
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.nodes[1].x, graph.nodes[2].x);
  assert.notEqual(graph.nodes[1].y, graph.nodes[2].y);
  assert.ok(graph.nodes[3].x > graph.nodes[1].x);
  assert.throws(() => workflowLayout(nodes, [...edges, {from:'end',to:'start',label:'loop'}]), /acyclic/);
  assert.throws(() => workflowLayout(nodes, [{from:'start',to:'missing',label:'bad'}]), /Unknown/);
  assert.throws(() => workflowLayout(nodes, edges.slice(0,2)), /unreachable/);
});

test('metadata validation refuses invented phone results, measured clean costs, bad status and bad evidence', () => {
  const good = read('../src/data/industry-workflows/hvac.json');
  for (const mutate of [
    (v: any) => { v.measurement.verifiedPhones = 5; },
    (v: any) => { v.cost.perCleanUsd = .01; },
    (v: any) => { v.sources[0].status = 'live-ish'; },
    (v: any) => { v.sources[0].evidence = 'probably'; },
    (v: any) => { v.measurement.sampleSize = -5; },
  ]) { const candidate = structuredClone(good); mutate(candidate); assert.throws(() => validateWorkflow(candidate, 'hvac')); }
});

test('historical identity coverage and unmeasured expectations are never labeled phone yields', () => {
  assert.match(benchmarkLabel('research_measured_identity_only', 200), /not a clean-phone rate/);
  assert.match(benchmarkLabel('research_estimate', 0), /no verified-phone sample/);
  assert.match(benchmarkLabel('anas', 100), /Historical Anas/);
});

test('state inspection shows actual quote fallback and unsupported routes instead of research source claims', () => {
  const centers = inspectWorkflowRoutes('childcare_center');
  assert.equal(Object.keys(centers).length, 51);
  assert.equal(centers.FL.recipe, 'A');
  assert.equal(centers.FL.fallback, true);
  const lawyers = inspectWorkflowRoutes('attorney_ny');
  assert.equal(lawyers.TX.blocked, true);
  assert.equal(lawyers.TX.fallback, false);
});
