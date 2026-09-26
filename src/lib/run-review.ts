import type { PilotRow, PilotResult } from './live-pilot.ts';
import type { LeadVerification } from './lead-engine-quality.ts';

export function excludeBeforeVerification(row: PilotRow): string | null {
  if (row.rejection) return row.rejection.replaceAll('_', ' ');
  if (!row.phone10) return 'Missing published phone';
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(row.phone10)) return 'Invalid US phone';
  if (/^(800|833|844|855|866|877|888)/.test(row.phone10)) return 'Toll-free business line';
  if (row.duplicate) return 'Duplicate business';
  if (row.chain) return `Chain or franchise: ${row.chain}`;
  return null;
}
export function phoneDecision(v: LeadVerification | null | undefined): { label: string; accepted: boolean } {
  if (!v) return { label: 'Not checked', accepted: false };
  const checkedAt = Date.parse(v.verifiedAt ?? '');
  if (!Number.isFinite(checkedAt) || checkedAt > Date.now() || Date.now() - checkedAt >= 31 * 86400000) return { label: 'Fresh verification required · held', accepted: false };
  if (v.lineType === null) return { label: 'Provider could not identify line type', accepted: false };
  if (v.lineType.toLowerCase() !== 'mobile') return { label: `${v.lineType} · excluded`, accepted: false };
  if (v.dnc === true) return { label: 'Do Not Call match · excluded', accepted: false };
  if (v.tcpa === true) return { label: 'TCPA risk signal · excluded', accepted: false };
  if (v.reachable === false) return { label: 'Unreachable · excluded', accepted: false };
  if (v.dnc !== false || v.tcpa !== false || v.reachable !== true) return { label: 'Incomplete verification · held', accepted: false };
  return { label: 'Mobile · checks passed', accepted: true };
}
export interface ConversationFinding { label: string; quote: string; turn: number; kind: 'objection'|'need'|'question'|'gap' }
// Evidence extraction, not an LLM score or a claim about what a human intended.
export function reviewConversation(result: PilotResult): ConversationFinding[] {
  const findings: ConversationFinding[] = [], seen = new Set<string>();
  const patterns: Array<[string, ConversationFinding['kind'], RegExp]> = [
    ['Previous agency disappointment', 'objection', /previous agenc|agencies.*(?:never|didn|over.?promis)|over.?promis|been burnt|been burned|tried.*agenc|didn.t.*work/],
    ['Price / investment question', 'question', /how much|pricing|price|what.*cost|pay for|afford|budget/],
    ['Predictable growth', 'need', /predictable|grow.*business|hire.*tech|scale|steady leads/],
    ['Follow-up gap', 'need', /falling through|follow.?up|cannot call|can.t call|call them back/],
    ['Invitation / scheduling requested', 'question', /invite|invitation|schedule|appointment|book.*call|meeting link/],
  ];
  (result.transcript ?? []).forEach((t, index) => {
    if (t.role !== 'user') return;
    for (const [label, kind, pattern] of patterns) if (!seen.has(label) && pattern.test(t.message.toLowerCase())) {
      seen.add(label); findings.push({ label, kind, quote: t.message, turn: index });
    }
  });
  for (const [label, pattern] of [
    ['Known offer was not answered', /don.t have.{0,55}(?:pric|number)|pricing.{0,20}(?:not|isn.t).{0,10}confirm/i],
    ['No invitation could be sent', /(?:don.t|do not|can.t|cannot).{0,40}(?:send|email|confirm messages)/i],
    ['Unconfirmed callback promise', /(?:team member|someone|specialist).{0,40}(?:will|going to).{0,20}(?:contact|reach|call|touch)|(?:I['’]ll|I will|I.m going to) arrange.{0,45}team/i],
  ] as const) {
    const index = (result.transcript ?? []).findIndex(t => t.role === 'agent' && pattern.test(t.message));
    if (index >= 0) findings.push({ label, kind: 'gap', quote: result.transcript![index].message, turn: index });
  }
  return findings;
}
export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return '"' + (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
}
