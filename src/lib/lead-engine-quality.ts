import { isUsState, matchesPhrase, normalizeWords } from "./lead-engine-plan.ts";

export type PublishedBusiness = {
  name: string; phone: string; city: string; state: string; category: string; subtypes: string[];
  status: string; placeId?: string; street?: string; franchise?: string;
  sourceUrl: string; contactPurpose: "published_business_contact" | "unknown";
};
export type GlobalLeadLedger = {
  loaded: boolean; deliveredPhones: ReadonlySet<string>; suppressedPhones: ReadonlySet<string>;
  processedPhones: ReadonlySet<string>; processedBusinessKeys: ReadonlySet<string>; processedPlaceIds: ReadonlySet<string>;
};
export type LeadVerification = {
  phone10: string | null; lineType: string | null; dnc: boolean | null; tcpa: boolean | null;
  reachable: boolean | null; verifiedAt: string | null;
};

export function normalizeBusinessPhone(input: unknown): string | null {
  if (typeof input !== "string" || !/^\+?[\d().\s-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, "");
  const phone = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(phone) ? phone : null;
}

function publicUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password && parsed.hostname.includes(".");
  } catch { return false; }
}

export function businessIdentity(business: Pick<PublishedBusiness, "name" | "city" | "state">): string {
  return [business.name, business.city, business.state].map(normalizeWords).join("|");
}

export function filterBusinessCandidates(rows: PublishedBusiness[], allowlist: string[], exclusions: string[], ledger: GlobalLeadLedger): { kept: Array<{ business: PublishedBusiness; phone10: string }>; rejected: Array<{ index: number; reason: string }> } {
  const seenPhones = new Set<string>();
  const seenBusinesses = new Set<string>();
  const seenPlaces = new Set<string>();
  const kept: Array<{ business: PublishedBusiness; phone10: string }> = [];
  const rejected: Array<{ index: number; reason: string }> = [];
  rows.forEach((business, index) => {
    const phone10 = normalizeBusinessPhone(business.phone);
    const identity = businessIdentity(business);
    const text = [business.name, business.category, ...business.subtypes].join(" ");
    let reason: string | null = null;
    if (ledger.loaded !== true) reason = "global_ledger_required";
    else if (business.contactPurpose !== "published_business_contact" || !publicUrl(business.sourceUrl)) reason = "business_contact_provenance_required";
    else if (!business.name.trim() || !business.city.trim() || !isUsState(business.state)) reason = "business_identity_required";
    else if (business.status !== "OPERATIONAL") reason = "not_operational";
    else if (!phone10) reason = "invalid_phone";
    else if (/^(800|888|877|866|855|844|833)/.test(phone10)) reason = "toll_free";
    else if (ledger.suppressedPhones.has(phone10)) reason = "suppressed";
    else if (ledger.deliveredPhones.has(phone10)) reason = "already_delivered";
    else if (ledger.processedPhones.has(phone10) || ledger.processedBusinessKeys.has(identity) || (business.placeId && ledger.processedPlaceIds.has(business.placeId))) reason = "already_processed";
    else if (!allowlist.some((term) => matchesPhrase(text, term))) reason = "no_positive_relevance";
    else if (exclusions.some((term) => matchesPhrase(`${text} ${business.city} ${business.state}`, term))) reason = "operator_exclusion";
    else if (seenPhones.has(phone10) || seenBusinesses.has(identity) || (business.placeId && seenPlaces.has(business.placeId))) reason = "duplicate_in_batch";
    if (reason || !phone10) { rejected.push({ index, reason: reason ?? "invalid_phone" }); return; }
    seenPhones.add(phone10); seenBusinesses.add(identity);
    if (business.placeId) seenPlaces.add(business.placeId);
    kept.push({ business, phone10 });
  });
  return { kept, rejected };
}

// Adapter contract only: unknown/missing provider flags stay unknown, never become false.
export function parseLeadVerification(payload: unknown): LeadVerification {
  const row = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  return {
    phone10: normalizeBusinessPhone(row.number),
    lineType: typeof row.type === "string" ? row.type : null,
    dnc: typeof row.dnc === "boolean" ? row.dnc : null,
    tcpa: typeof row.tcpa === "boolean" ? row.tcpa : null,
    reachable: typeof row.reachable === "boolean" ? row.reachable : null,
    verifiedAt: typeof row.verified_at === "string" ? row.verified_at : null,
  };
}

export function evaluateVerifiedBusiness(business: PublishedBusiness, verification: LeadVerification, ledger: GlobalLeadLedger, now: number): string[] {
  const blocked: string[] = [];
  const phone = normalizeBusinessPhone(business.phone);
  if (ledger.loaded !== true) blocked.push("global_ledger_required");
  if (business.contactPurpose !== "published_business_contact" || !publicUrl(business.sourceUrl)) blocked.push("business_contact_provenance_required");
  if (!phone || phone !== verification.phone10) blocked.push("phone_identity_mismatch");
  if (phone && ledger.suppressedPhones.has(phone)) blocked.push("suppressed");
  if (phone && ledger.deliveredPhones.has(phone)) blocked.push("already_delivered");
  if (verification.lineType !== "Mobile") blocked.push("verified_mobile_required");
  if (verification.dnc !== false) blocked.push("dnc_clear_required");
  if (verification.tcpa !== false) blocked.push("tcpa_clear_required");
  if (verification.reachable !== true) blocked.push("reachable_required");
  const timestamp = verification.verifiedAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(verification.verifiedAt) ? Date.parse(verification.verifiedAt) : NaN;
  const datePart = verification.verifiedAt?.slice(0, 10);
  const calendarDate = datePart ? new Date(`${datePart}T00:00:00Z`) : null;
  const validCalendarDate = calendarDate && Number.isFinite(calendarDate.getTime()) && calendarDate.toISOString().slice(0, 10) === datePart;
  if (!validCalendarDate || !Number.isFinite(now) || !Number.isFinite(timestamp) || timestamp > now || now - timestamp >= 31 * 86_400_000) blocked.push("fresh_verification_required");
  return blocked;
}
