import assert from "node:assert/strict";
import test from "node:test";
import { businessIdentity, evaluateVerifiedBusiness, filterBusinessCandidates, normalizeBusinessPhone, parseLeadVerification, type GlobalLeadLedger, type PublishedBusiness } from "../src/lib/lead-engine-quality.ts";

const business: PublishedBusiness = { name: "Example Roofing", phone: "(704) 555-0140", city: "Charlotte", state: "NC", category: "Roofing contractor", subtypes: [], status: "OPERATIONAL", placeId: "example-place", sourceUrl: "https://example.com/contact", contactPurpose: "published_business_contact", franchise: "Example brand" };
const ledger = (): GlobalLeadLedger => ({ loaded: true, deliveredPhones: new Set(), suppressedPhones: new Set(), processedPhones: new Set(), processedBusinessKeys: new Set(), processedPlaceIds: new Set() });
const now = Date.parse("2026-09-14T12:00:00Z");
const verified = { number: "7045550140", type: "Mobile", dnc: false, tcpa: false, reachable: true, verified_at: "2026-09-14T11:00:00Z" };

test("phone normalization rejects extensions, foreign prefixes and malformed NANP", () => {
  assert.equal(normalizeBusinessPhone("+1 (704) 555-0140"), "7045550140");
  for (const value of [7045550140, "+44 20 7946 0000", "7045550140 ext 1", "1045550140", "7041550140", "++17045550140", null]) assert.equal(normalizeBusinessPhone(value), null);
});

test("free filtering requires positive trade relevance and preserves franchises without street addresses", () => {
  const unrelated = { ...business, name: "Example restaurant", category: "Restaurant", placeId: "other", phone: "2125550150" };
  const result = filterBusinessCandidates([business, unrelated], ["roofing"], [], ledger());
  assert.equal(result.kept.length, 1);
  assert.equal(result.kept[0].business.franchise, "Example brand");
  assert.equal(result.rejected[0].reason, "no_positive_relevance");
  assert.equal(filterBusinessCandidates([business], [], [], ledger()).kept.length, 0);
  assert.equal(filterBusinessCandidates([business], ["roofing"], ["NC"], ledger()).rejected[0].reason, "operator_exclusion");
  assert.equal(filterBusinessCandidates([{ ...business, state: "ZZ" }], ["roofing"], [], ledger()).kept.length, 0);
});

test("dedupe uses all three identifiers and global suppression regardless of industry", () => {
  for (const duplicate of [
    { ...business, name: "Other business", placeId: "other" },
    { ...business, phone: "7045550141", placeId: "other" },
    { ...business, name: "Other roofing", phone: "7045550141" },
  ]) assert.equal(filterBusinessCandidates([business, duplicate], ["roofing"], [], ledger()).rejected[0].reason, "duplicate_in_batch");
  for (const key of ["deliveredPhones", "suppressedPhones", "processedPhones"] as const) {
    const loaded = { ...ledger(), [key]: new Set(["7045550140"]) };
    assert.equal(filterBusinessCandidates([business], ["roofing"], [], loaded).kept.length, 0);
  }
  assert.equal(filterBusinessCandidates([business], ["roofing"], [], { ...ledger(), processedBusinessKeys: new Set([businessIdentity(business)]) }).kept.length, 0);
  assert.equal(filterBusinessCandidates([business], ["roofing"], [], { ...ledger(), loaded: false }).kept.length, 0);
});

test("missing provenance, closed businesses and toll-free contacts fail before verification", () => {
  for (const candidate of [
    { ...business, sourceUrl: "" }, { ...business, sourceUrl: "javascript:alert(1)" },
    { ...business, contactPurpose: "unknown" as const }, { ...business, status: "CLOSED_PERMANENTLY" },
    { ...business, phone: "8005550140" },
  ]) assert.equal(filterBusinessCandidates([candidate], ["roofing"], [], ledger()).kept.length, 0);
});

test("verification adapter leaves absent or string flags unknown, not clean", () => {
  assert.deepEqual(evaluateVerifiedBusiness(business, parseLeadVerification(verified), ledger(), now), []);
  for (const value of [undefined, null, "false", "true", 0, 1, {}]) {
    for (const flag of ["dnc", "tcpa", "reachable"]) {
      const parsed = parseLeadVerification({ ...verified, [flag]: value });
      assert.equal(parsed[flag as "dnc" | "tcpa" | "reachable"], null);
      assert.ok(evaluateVerifiedBusiness(business, parsed, ledger(), now).length > 0);
    }
  }
  for (const type of ["Land Line", "VoIP", "mobile", "", null]) assert.ok(evaluateVerifiedBusiness(business, parseLeadVerification({ ...verified, type }), ledger(), now).includes("verified_mobile_required"));
});

test("fresh verification binds phone identity and cannot override suppression or unknown provenance", () => {
  for (const verified_at of ["2026-08-14T12:00:00Z", "2026-09-15T12:00:00Z", "2026-02-30T12:00:00Z", "2026-09-14", "bad", ""]) {
    assert.ok(evaluateVerifiedBusiness(business, parseLeadVerification({ ...verified, verified_at }), ledger(), now).includes("fresh_verification_required"));
  }
  assert.ok(evaluateVerifiedBusiness(business, parseLeadVerification({ ...verified, number: "7045550141" }), ledger(), now).includes("phone_identity_mismatch"));
  assert.ok(evaluateVerifiedBusiness(business, parseLeadVerification(verified), { ...ledger(), suppressedPhones: new Set(["7045550140"]) }, now).includes("suppressed"));
  assert.ok(evaluateVerifiedBusiness({ ...business, contactPurpose: "unknown" }, parseLeadVerification(verified), ledger(), now).includes("business_contact_provenance_required"));
});
