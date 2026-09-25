import { normalizeWords } from './lead-engine-plan.ts';
import { normalizeBusinessPhone } from './lead-engine-quality.ts';
import type { LeadVerification } from './lead-engine-quality.ts';
import type { OwnerEvidence } from './lead-engine-research.ts';

export type ConfidenceStatus = 'not_scored' | 'needs_review' | 'strong_evidence' | 'conflicting' | 'wrong_contact' | 'not_mobile' | 'inactive';
export interface ConfidenceCheck { key: string; label: string; points: number; maximum: number; state: 'passed' | 'missing' | 'failed' }
export interface LeadConfidence {
  version: 'owner-phone-v1'; meaning: 'evidence_strength'; value: number | null; maximum: 100;
  status: ConfidenceStatus; assessedAt: string | null; checks: ConfidenceCheck[]; sourceUrls: string[];
}
export function unscoredLeadConfidence(): LeadConfidence {
  return { version: 'owner-phone-v1', meaning: 'evidence_strength', value: null, maximum: 100, status: 'not_scored', assessedAt: null,
    checks: [
      { key: 'direct_owner', label: 'Direct owner contact on the business website', points: 0, maximum: 40, state: 'missing' },
      { key: 'independent_owner', label: 'Owner corroborated by an independent business record', points: 0, maximum: 25, state: 'missing' },
      { key: 'active_phone', label: 'Same phone verified active', points: 0, maximum: 20, state: 'missing' },
      { key: 'mobile', label: 'Same phone verified mobile', points: 0, maximum: 15, state: 'missing' },
    ], sourceUrls: [] };
}
const ageLimit = 31 * 86400000;
function fresh(value: string | null, now: number): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const date = new Date(value.slice(0, 10) + 'T00:00:00Z'), timestamp = Date.parse(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10)
    && Number.isFinite(timestamp) && timestamp <= now && now - timestamp < ageLimit;
}
function host(value: string): string | null {
  try { const url = new URL(value); const name = url.hostname.toLowerCase().replace(/^www\./, '');
    return url.protocol === 'https:' && !url.username && !url.password && name.includes('.') && !/^[\d.]+$/.test(name) && !name.includes(':') ? name : null;
  } catch { return null; }
}
function independent(a: OwnerEvidence, b: OwnerEvidence): boolean {
  const first = host(a.url), second = host(b.url);
  return Boolean(first && second && first !== second && !first.endsWith('.' + second) && !second.endsWith('.' + first)
    && normalizeWords(a.publisher) !== normalizeWords(b.publisher));
}
// Trusted review/provider records only. No HTTP endpoint accepts this input or a client-assigned score.
// A score is neither a calibrated probability nor permission to contact a person.
export function evaluateLeadConfidence(input: { business: string; phone: string | null; evidence: readonly OwnerEvidence[]; verification: LeadVerification | null }, now: number): LeadConfidence {
  const result = unscoredLeadConfidence();
  const phone = normalizeBusinessPhone(input.phone), business = normalizeWords(input.business);
  if (!phone || !business || !Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) return result;
  const evidence = input.evidence.filter(row => host(row.url) && normalizeWords(row.publisher) && normalizeWords(row.businessName) === business && fresh(row.reviewedAt, now));
  const linked = evidence.filter(row => normalizeBusinessPhone(row.phone) === phone);
  const owner = (row: OwnerEvidence) => ['owner', 'founder'].includes(row.role) && row.personName && normalizeWords(row.personName).split(' ').length >= 2;
  const direct = linked.filter(row => row.kind === 'business_website' && row.explicitlyDirectBusinessContact === true && owner(row));
  const registry = evidence.filter(row => row.kind === 'registry' && owner(row));
  const frontDesk = linked.some(row => row.role === 'front_desk');
  const names = new Set(direct.map(row => normalizeWords(row.personName!)));
  const conflict = names.size > 1 || (direct.length > 0 && (frontDesk || registry.some(row => !names.has(normalizeWords(row.personName!)))));
  const corroborated = direct.some(row => registry.some(other => normalizeWords(row.personName!) === normalizeWords(other.personName!) && independent(row, other)));
  const v = input.verification, current = v !== null && fresh(v.verifiedAt, now);
  const samePhone = current && normalizeBusinessPhone(v.phone10) === phone;
  const mismatch = current && v.phone10 !== null && !samePhone;
  const active = samePhone && v.reachable === true, mobile = samePhone && v.lineType === 'Mobile';
  if (evidence.length === 0 && !current) return result;
  const passed = [direct.length > 0, corroborated, active, mobile];
  result.checks = result.checks.map((check, index) => ({ ...check, points: passed[index] ? check.maximum : 0,
    state: passed[index] ? 'passed' : index === 2 && samePhone && v.reachable === false || index === 3 && samePhone && v.lineType !== null && !mobile ? 'failed' : 'missing' }));
  result.value = result.checks.reduce((sum, check) => sum + check.points, 0);
  result.assessedAt = new Date(now).toISOString();
  result.sourceUrls = [...new Set(evidence.map(row => row.url))];
  result.status = result.value === 100 ? 'strong_evidence' : 'needs_review';
  if (conflict) { result.status = 'conflicting'; result.value = Math.min(result.value, 35); }
  else if (frontDesk || mismatch) { result.status = 'wrong_contact'; result.value = 0; }
  else if (samePhone && v.reachable === false) { result.status = 'inactive'; result.value = 0; }
  else if (samePhone && v.lineType !== null && !mobile) { result.status = 'not_mobile'; result.value = Math.min(result.value, 35); }
  return result;
}
