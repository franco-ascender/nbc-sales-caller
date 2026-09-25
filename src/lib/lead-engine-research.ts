import { normalizeWords } from './lead-engine-plan.ts';
import { filterBusinessCandidates, normalizeBusinessPhone } from './lead-engine-quality.ts';
import type { PublishedBusiness, GlobalLeadLedger } from './lead-engine-quality.ts';

// Evidence must come from a trusted ingestion/review service; this is not an approval payload for the browser.
export interface OwnerEvidence {
  url: string; publisher: string; kind: 'business_website' | 'registry' | 'directory';
  businessName: string; personName: string | null; role: 'owner' | 'founder' | 'front_desk' | 'unknown';
  phone: string | null; explicitlyDirectBusinessContact: boolean; reviewedAt: string | null;
}
export interface OwnerAssessment { status: 'supported' | 'needs_review' | 'front_desk' | 'conflicting'; reasons: string[]; sourceUrls: string[] }
export function assessOwnerEvidence(business: string, phone: string, evidence: OwnerEvidence[], now: number): OwnerAssessment {
  const normalizedPhone = normalizeBusinessPhone(phone);
  if (!normalizedPhone || !normalizeWords(business) || !Number.isFinite(now)) return { status: 'needs_review', reasons: ['valid_business_and_phone_required'], sourceUrls: [] };
  const usable = evidence.filter(item => {
    try {
      const url = new URL(item.url); const reviewed = Date.parse(item.reviewedAt ?? '');
      return url.protocol === 'https:' && !url.username && !url.password && item.publisher.trim().length > 0
        && normalizeWords(item.businessName) === normalizeWords(business) && Number.isFinite(reviewed)
        && reviewed <= now && now - reviewed < 31 * 86400000;
    } catch { return false; }
  });
  const linked = usable.filter(item => normalizeBusinessPhone(item.phone) === normalizedPhone);
  const direct = linked.filter(item => item.explicitlyDirectBusinessContact === true && item.kind === 'business_website'
    && ['owner', 'founder'].includes(item.role) && item.personName && normalizeWords(item.personName).split(' ').length >= 2);
  const frontDesk = linked.some(item => item.role === 'front_desk');
  const names = new Set(direct.map(item => normalizeWords(item.personName!)));
  const urls = [...new Set(usable.map(item => item.url))];
  if (names.size > 1 || (frontDesk && direct.length > 0)) return { status: 'conflicting', reasons: ['sources_disagree_on_contact'], sourceUrls: urls };
  if (frontDesk) return { status: 'front_desk', reasons: ['source_identifies_front_desk'], sourceUrls: urls };
  const corroborated = direct.some(item => usable.some(other => other.kind === 'registry'
    && normalizeWords(other.publisher) !== normalizeWords(item.publisher) && other.personName
    && normalizeWords(other.personName) === normalizeWords(item.personName!) && ['owner', 'founder'].includes(other.role)));
  return corroborated ? { status: 'supported', reasons: ['direct_business_contact_and_independent_role_evidence'], sourceUrls: urls }
    : { status: 'needs_review', reasons: ['explicit_owner_contact_and_independent_evidence_required'], sourceUrls: urls };
}
export function prepareVerificationBatches(rows: PublishedBusiness[], allowlist: string[], exclusions: string[], ledger: GlobalLeadLedger, providerBatchSize: number) {
  if (!Number.isSafeInteger(providerBatchSize) || providerBatchSize < 1 || providerBatchSize > 1000) throw new Error('A verified provider batch limit from 1 to 1000 is required.');
  if (rows.length > 10000) throw new Error('Research input exceeds the local preparation limit.');
  const filtered = filterBusinessCandidates(rows, allowlist, exclusions, ledger);
  const batches: typeof filtered.kept[] = [];
  for (let offset = 0; offset < filtered.kept.length; offset += providerBatchSize) batches.push(filtered.kept.slice(offset, offset + providerBatchSize));
  return { batches, rejected: filtered.rejected, eligible: filtered.kept.length, executionEnabled: false as const };
}
export interface LeadConnectionCheck {
  checkedAt: string;
  apify: 'missing' | 'access_verified' | 'rejected' | 'unavailable';
  outscraper: 'missing' | 'access_verified' | 'rejected' | 'unavailable';
  phoneVerifier: 'missing' | 'configured_unverified';
  executionEnabled: false;
}
