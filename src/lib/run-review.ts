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
  if (v.lineType.toLowerCase() !== 'mobile') return { label: `${v.lineType} · not a mobile`, accepted: false };
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

export function qualifiedRows(result: PilotResult): PilotRow[] {
  const seen = new Set<string>();
  return (result.rows ?? []).filter(row => {
    if (excludeBeforeVerification(row) || !row.phone10 || seen.has(row.phone10)) return false;
    const check = result.phoneChecks?.find(c => c.phone10 === row.phone10);
    if (check?.state !== 'completed' || !phoneDecision(check.verification).accepted) return false;
    seen.add(row.phone10);
    return true;
  });
}

export function runEvidenceCsv(result: PilotResult, qualifiedOnly = false): string {
  const rows = qualifiedOnly ? qualifiedRows(result) : result.rows ?? [];
  return [
    ['Business','City','State','Published phone','Website','Discovery decision','Phone decision','Line type','DNC','TCPA','Reachable','Verified at','Owner identity','Registry person','Registry role','Registry phone (not verified)','Registry evidence','Registry basis','Listing source'],
    ...rows.map(row => {
      const check = result.phoneChecks?.find(c => c.phone10 === row.phone10);
      const v = check?.verification;
      const evidence = result.ownerEvidence?.find(e => e.business === row.name && e.phone10 === row.phone10);
      return [row.name,row.city,row.state,row.phone10,row.website,excludeBeforeVerification(row) ?? 'Eligible',check?.state === 'completed' ? phoneDecision(v).label : check?.state ?? 'Not checked',v?.lineType,v?.dnc,v?.tcpa,v?.reachable,v?.verifiedAt,'Not established',evidence?.person,evidence?.role,evidence?.registryPhone,evidence?.source,evidence?.basis,row.sourceUrl];
    }),
  ].map(row => row.map(csvCell).join(',')).join('\r\n');
}

/** Counts unique eligible phones, not duplicate listings or unsent numbers. */
export function verificationSummary(result: PilotResult) {
  const eligible = new Set((result.rows ?? []).filter(r => !excludeBeforeVerification(r)).map(r => r.phone10!));
  const counts = { total: eligible.size, checked: 0, pending: 0, unresolved: 0, reachable: 0, unreachable: 0, unknown: 0, mobile: 0, landline: 0, other: 0, qualified: qualifiedRows(result).length };
  for (const phone of eligible) {
    const check = result.phoneChecks?.find(c => c.phone10 === phone);
    if (!check) { counts.pending++; continue; }
    if (check.state !== 'completed') { counts.unresolved++; continue; }
    counts.checked++;
    const v = check.verification, at = Date.parse(v?.verifiedAt ?? '');
    const fresh = Number.isFinite(at) && at <= Date.now() && Date.now() - at < 31 * 86400000;
    if (!fresh || typeof v?.reachable !== 'boolean') counts.unknown++;
    else if (v.reachable) counts.reachable++;
    else counts.unreachable++;
    const type = fresh ? v?.lineType?.toLowerCase().replace(/[\s_-]/g, '') : null;
    if (type === 'mobile') counts.mobile++;
    else if (type === 'landline') counts.landline++;
    else counts.other++;
  }
  return counts;
}
export function verificationPercent(count: number, checked: number): string {
  return checked ? `${(count / checked * 100).toFixed(1)}%` : '—';
}
export function verificationSummaryCsv(result: PilotResult): string {
  const s = verificationSummary(result);
  return [
    ['Metric', 'Unique phones', 'Percent of completed checks'],
    ['Eligible for verification', s.total, ''], ['Completed checks', s.checked, ''],
    ['Not checked', s.pending, ''], ['Unresolved requests', s.unresolved, ''],
    ...([['Reachable (provider reported)', s.reachable], ['Unreachable (provider reported)', s.unreachable], ['Reachability unknown or stale', s.unknown], ['Mobile', s.mobile], ['Landline', s.landline], ['Other or unknown line type', s.other], ['Mobile checks passed', s.qualified]] as const).map(([label, n]) => [label, n, verificationPercent(n, s.checked)]),
    ['Note', 'Reachability does not confirm an answered call, owner identity, or permission to call.', ''],
  ].map(row => row.map(csvCell).join(',')).join('\r\n');
}
