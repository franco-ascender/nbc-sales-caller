// Workflow reviews are descriptive evidence, not executable provider instructions.
export type WorkflowKind = 'source' | 'filter' | 'decision' | 'verify' | 'hold' | 'deliver';
export interface WorkflowNode { id: string; label: string; detail: string; kind: WorkflowKind }
export interface WorkflowEdge { from: string; to: string; label: string }
export interface IndustryWorkflow {
  industry: string; title: string; hypothesis: string; ownerSource: string; phoneSource: string;
  workflow: WorkflowNode[]; edges: WorkflowEdge[];
  failures: Array<{ risk: string; mitigation: string; status: string }>;
  sources: Array<{ label: string; scope: string; evidence: 'VERIFIED' | 'REPORTED' | 'UNKNOWN'; reference: string; status: 'implemented' | 'proposed' | 'blocked' }>;
  iterations: Array<{ hypothesis: string; test: string; observed: string; change: string }>;
  measurement: { kind: 'free_source_sample' | 'fixture' | 'code_audit'; sampleSize: number; observedAt: string; result: string; verifiedPhones: number };
  cost: { basis: string; perInputUsd: number | null; perCleanUsd: number | null; note: string };
  implementation: { status: 'reviewed' | 'partial' | 'blocked'; summary: string; runtimeFiles: string[] };
  nextMeasurement: string;
}

// Reviewed metadata is authored by multiple workers. Reject incomplete evidence before packaging.
export function validateWorkflow(value: unknown, expectedKey: string): asserts value is IndustryWorkflow {
  const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  const fail = (field: string): never => { throw Error(`${expectedKey}: invalid ${field}`); };
  const string = (v: unknown, field: string) => { if (typeof v !== 'string' || !v.trim()) fail(field); };
  const fields = (v: unknown, keys: string[], field: string) => { if (!obj(v)) fail(field); for (const key of keys) string((v as Record<string, unknown>)[key], `${field}.${key}`); };
  const list = (v: unknown, field: string): unknown[] => { if (!Array.isArray(v) || !v.length) fail(field); return v as unknown[]; };
  if (!obj(value)) fail('review');
  const v = value as Record<string, unknown>;
  if (v.industry !== expectedKey) fail('industry');
  fields(v, ['industry', 'title', 'hypothesis', 'ownerSource', 'phoneSource', 'nextMeasurement'], 'review');
  for (const node of list(v.workflow, 'workflow')) {
    fields(node, ['id', 'label', 'detail', 'kind'], 'node');
    if (!['source', 'filter', 'decision', 'verify', 'hold', 'deliver'].includes((node as WorkflowNode).kind)) fail('node kind');
  }
  for (const edge of list(v.edges, 'edges')) fields(edge, ['from', 'to', 'label'], 'edge');
  workflowLayout(v.workflow as WorkflowNode[], v.edges as WorkflowEdge[]);
  for (const entry of list(v.failures, 'failures')) fields(entry, ['risk', 'mitigation', 'status'], 'failure');
  for (const entry of list(v.iterations, 'iterations')) fields(entry, ['hypothesis', 'test', 'observed', 'change'], 'iteration');
  for (const entry of list(v.sources, 'sources')) {
    fields(entry, ['label', 'scope', 'evidence', 'reference', 'status'], 'source');
    const source = entry as IndustryWorkflow['sources'][number];
    if (!['VERIFIED', 'REPORTED', 'UNKNOWN'].includes(source.evidence) || !['implemented', 'proposed', 'blocked'].includes(source.status)) fail('source status');
  }
  fields(v.measurement, ['kind', 'observedAt', 'result'], 'measurement');
  const measurement = v.measurement as IndustryWorkflow['measurement'];
  if (!['free_source_sample', 'fixture', 'code_audit'].includes(measurement.kind) || !Number.isInteger(measurement.sampleSize) || measurement.sampleSize < 0 || measurement.verifiedPhones !== 0 || !/^\d{4}-\d{2}-\d{2}$/.test(measurement.observedAt)) fail('measurement');
  fields(v.cost, ['basis', 'note'], 'cost');
  const cost = v.cost as IndustryWorkflow['cost'];
  if (cost.perCleanUsd !== null || (cost.perInputUsd !== null && (typeof cost.perInputUsd !== 'number' || !Number.isFinite(cost.perInputUsd) || cost.perInputUsd < 0))) fail('unmeasured cost');
  fields(v.implementation, ['status', 'summary'], 'implementation');
  const implementation = v.implementation as IndustryWorkflow['implementation'];
  if (!['reviewed', 'partial', 'blocked'].includes(implementation.status)) fail('implementation status');
  for (const path of list(implementation.runtimeFiles, 'runtimeFiles')) string(path, 'runtimeFile');
}

// Layout a bounded acyclic graph. Keep all branches and labels, including hold/reject paths.
export function workflowLayout(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const ids = new Set(nodes.map(node => node.id));
  if (nodes.length < 2 || nodes.length > 30 || ids.size !== nodes.length) throw Error('Invalid workflow nodes');
  if (edges.some(edge => !ids.has(edge.from) || !ids.has(edge.to))) throw Error('Unknown workflow edge');
  const reached = new Set([nodes[0].id]);
  for (let i = 0; i < nodes.length; i++) for (const edge of edges) if (reached.has(edge.from)) reached.add(edge.to);
  if (reached.size !== nodes.length) throw Error('Workflow contains unreachable nodes');
  const levels = new Map<string, number>();
  let pending = [...nodes];
  while (pending.length) {
    const ready = pending.filter(node => edges.filter(edge => edge.to === node.id).every(edge => levels.has(edge.from)));
    if (!ready.length) throw Error('Workflow must be acyclic');
    for (const node of ready) {
      const incoming = edges.filter(edge => edge.to === node.id);
      levels.set(node.id, incoming.length ? Math.max(...incoming.map(edge => levels.get(edge.from)!)) + 1 : 0);
    }
    pending = pending.filter(node => !levels.has(node.id));
  }
  const depth = Math.max(...levels.values());
  const rowCount = Math.max(...Array.from({ length: depth + 1 }, (_, level) => nodes.filter(node => levels.get(node.id) === level).length));
  const height = Math.max(220, rowCount * 150 + 30);
  return {
    width: (depth + 1) * 240 + 20, height,
    nodes: nodes.map(node => {
      const level = levels.get(node.id)!;
      const peers = nodes.filter(item => levels.get(item.id) === level);
      return { ...node, x: level * 240 + 12, y: (height - peers.length * 150) / 2 + peers.indexOf(node) * 150 + 15 };
    }),
  };
}

export function benchmarkLabel(measuredBy: string, n: number): string {
  if (measuredBy === 'research_measured_identity_only') return `Identity study · n=${n} · not a clean-phone rate`;
  if (n === 0) return 'Estimate · no verified-phone sample';
  if (measuredBy === 'anas') return `Historical Anas benchmark · paid-step inputs n=${n}`;
  return `${measuredBy} · n=${n} · denominator requires review`;
}
