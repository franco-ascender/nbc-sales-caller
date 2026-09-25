import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { evaluateLeadConfidence, unscoredLeadConfidence } from '../src/lib/lead-engine-confidence.ts';
import type { OwnerEvidence } from '../src/lib/lead-engine-research.ts';
import type { LeadVerification } from '../src/lib/lead-engine-quality.ts';
import { createLeadResearchStore } from '../src/services/lead-engine-scrape-store.ts';
const now = Date.parse('2026-09-15T20:00:00Z');
const source: OwnerEvidence = { url: 'https://roofing.example/contact', publisher: 'Example Roofing', kind: 'business_website', businessName: 'Example Roofing', personName: 'Alex Example', role: 'owner', phone: '2025550123', explicitlyDirectBusinessContact: true, reviewedAt: '2026-09-15T10:00:00Z' };
const registry: OwnerEvidence = { ...source, url: 'https://registry.example/company', publisher: 'County Registry', kind: 'registry', phone: null, explicitlyDirectBusinessContact: false };
const verification: LeadVerification = { phone10: '2025550123', lineType: 'Mobile', reachable: true, verifiedAt: '2026-09-15T10:00:00Z', dnc: null, tcpa: null };
const input = { business: 'Example Roofing', phone: '2025550123', evidence: [source, registry], verification };
test('100 means maximum evidence and carries a version, never a probability or contact permission', () => {
  const result = evaluateLeadConfidence(input, now);
  assert.equal(result.value, 100); assert.equal(result.status, 'strong_evidence'); assert.equal(result.meaning, 'evidence_strength');
  assert.equal(result.version, 'owner-phone-v1'); assert.equal('probability' in result, false); assert.equal('approved' in result, false);
});
test('discovery URLs, a formatted number and missing verification do not manufacture a score', () => {
  assert.deepEqual(evaluateLeadConfidence({ ...input, evidence: [], verification: null }, now), unscoredLeadConfidence());
  assert.equal(evaluateLeadConfidence({ ...input, phone: null }, now).value, null);
  assert.equal(evaluateLeadConfidence(input, NaN).value, null);
});
test('phone activity and mobile alone cannot imply owner match', () => {
  const result = evaluateLeadConfidence({ ...input, evidence: [] }, now);
  assert.equal(result.value, 35); assert.equal(result.status, 'needs_review');
});
test('duplicate sources, a different publisher on the same host and subdomains do not earn independent points', () => {
  for (const url of [source.url, 'https://www.roofing.example/registry', 'https://records.roofing.example/registry']) {
    assert.equal(evaluateLeadConfidence({ ...input, evidence: [source, source, { ...registry, url }] }, now).value, 75);
  }
  assert.equal(evaluateLeadConfidence({ ...input, evidence: [source, registry, registry] }, now).value, 100);
});
test('stale, future and invalid calendar dates do not count as current verification or evidence', () => {
  for (const reviewedAt of ['2026-08-15T20:00:00Z', '2026-09-16T10:00:00Z', '2026-02-30T10:00:00Z', 'not-a-date']) {
    const result = evaluateLeadConfidence({ ...input, evidence: input.evidence.map(row => ({ ...row, reviewedAt })), verification: { ...verification, verifiedAt: reviewedAt } }, now);
    assert.equal(result.value, null);
  }
});
test('front desk, mismatched phone, inactive and nonmobile results prevent a high score', () => {
  const cases = [
    { data: { ...input, evidence: [{ ...source, role: 'front_desk' as const }] }, status: 'wrong_contact', value: 0 },
    { data: { ...input, verification: { ...verification, phone10: '2025550199' } }, status: 'wrong_contact', value: 0 },
    { data: { ...input, verification: { ...verification, reachable: false } }, status: 'inactive', value: 0 },
    { data: { ...input, verification: { ...verification, lineType: 'Landline' } }, status: 'not_mobile', value: 35 },
  ];
  for (const { data, status, value } of cases) { const result = evaluateLeadConfidence(data, now); assert.equal(result.status, status); assert.equal(result.value, value); }
});
test('conflicting owner names and business mismatch cannot produce a strong match', () => {
  const conflict = evaluateLeadConfidence({ ...input, evidence: [source, registry, { ...registry, personName: 'Other Example' }] }, now);
  assert.equal(conflict.status, 'conflicting'); assert.ok(conflict.value! <= 35);
  assert.equal(evaluateLeadConfidence({ ...input, business: 'Another business' }, now).value, 35);
});
test('suppression fields stay outside the evidence score; no authorization is created', () => {
  const data = { ...input, verification: { ...verification, dnc: true, tcpa: true } };
  assert.equal(evaluateLeadConfidence(data, now).value, 100);
  assert.equal(data.verification.dnc, true); assert.equal(data.verification.tcpa, true);
});
test('detail API store attaches Not checked and ignores a score supplied by raw discovery data', async () => {
  const row = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Example search', folder_id: null, plan_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', cursor: 1, import_status: 'complete', created_at: '2026-09-15T10:00:00Z' };
  class Query {
    readonly table: string;
    constructor(table: string) { this.table = table; }
    select() { return this; } eq() { return this; }
    maybeSingle() { return Promise.resolve({ data: row, error: null }); }
    in() { return Promise.resolve({ data: this.table === 'lead_engine_discovery_jobs' ? [{ batch_id: row.id, status: 'succeeded', max_results: 1 }] : [{ id: row.id, reserved_cents: 100, consumed_cents: 0 }], error: null }); }
  }
  const db = { from: (table: string) => new Query(table), rpc: async () => ({ data: [{ position: 0, name: 'Example business', city: 'Charlotte', state: 'NC', website: null, sourceUrl: null, reviewStatus: 'verification_pending', confidence: { value: 100 } }], error: null }) } as unknown as SupabaseClient;
  const result = await createLeadResearchStore(db).get('operator', row.id, 0);
  assert.equal(result.records[0].confidence?.value, null); assert.equal(result.records[0].confidence?.status, 'not_scored');
});
