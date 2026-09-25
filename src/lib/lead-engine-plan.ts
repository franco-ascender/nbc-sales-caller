export type LeadLane = "A" | "B" | "C";
export type LeadPlanInput = {
  industry: string; metro: string; target: number; hardBudgetCents: number;
  exclusions: string[]; operation?: LeadLane;
};

const INDUSTRIES: Record<LeadLane, string[]> = {
  A: ["roofing", "roofer", "hvac", "plumbing", "plumber", "electrical", "electrician", "decks", "patios", "concrete", "pavers", "masonry", "fencing", "landscaping", "landscaper", "hardscape", "painting", "flooring", "remodeling", "kitchen", "bath", "windows", "doors", "gutters", "siding", "restoration", "pressure washing", "pool service", "handyman", "tree", "pest", "cleaning", "moving", "junk removal", "auto repair", "tint", "detailing", "towing", "salon", "barber", "nails", "tattoo", "gym", "daycare"],
  B: ["chiropractor", "chiropractic", "dentist", "dental", "optometrist", "physical therapy", "physical therapist", "veterinarian", "veterinary", "dermatology", "med spa", "aesthetics", "podiatry", "orthodontist", "orthodontics"],
  C: ["ai development", "saas", "agency", "agencies", "e commerce", "realtor", "real estate", "mortgage", "insurance", "financial advisor", "attorney", "lawyer", "cpa", "consultant", "consulting", "recruiter", "recruiting"],
};

export const BENCHMARK_VERSION = "anas-brief-2026-09-14-unverified";
const US_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
export function isUsState(value: string): boolean { return US_STATES.has(value); }
export const LEAD_LIMITS = { pilotBusinesses: 300, pilotCents: 1_000, batchConfirmationCents: 15_000, stopLossCents: 15 } as const;
export const LANE_BENCHMARKS: Record<LeadLane, { minCents: number; maxCents: number; title: string }> = {
  A: { minCents: 4, maxCents: 6, title: "Local businesses & trades" },
  B: { minCents: 5, maxCents: 9, title: "Licensed practices" },
  C: { minCents: 20, maxCents: 50, title: "People within companies" },
};

export function normalizeWords(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchesPhrase(value: string, phrase: string): boolean {
  const normalized = normalizeWords(phrase);
  return normalized.length > 0 && ` ${normalizeWords(value)} `.includes(` ${normalized} `);
}

export function routeIndustry(industry: string, operation?: LeadLane): { lane: LeadLane | null; candidates: LeadLane[]; needsClarification: boolean } {
  const candidates = (Object.keys(INDUSTRIES) as LeadLane[]).filter((lane) => INDUSTRIES[lane].some((term) => matchesPhrase(industry, term)));
  if (operation && ["A", "B", "C"].includes(operation)) return { lane: operation, candidates, needsClarification: false };
  return { lane: candidates.length === 1 ? candidates[0] : null, candidates, needsClarification: candidates.length !== 1 };
}

export function dollarsToCents(value: string): number | null {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export type LeadPlan = LeadPlanInput & {
  lane: LeadLane | null; needsClarification: boolean; errors: string[];
  estimate: { minCents: number; maxCents: number; affordableTarget: number; businesses: number | null; pilotExpectedContacts: number | null } | null;
  overBudget: boolean; benchmarkVersion: string; executionEnabled: false;
  benchmarkNotice: string; dataScope: string; deliveryChannel: string;
};

export function buildLeadPlan(input: LeadPlanInput): LeadPlan {
  const errors: string[] = [];
  if (input.industry.trim().length < 2 || input.industry.length > 150) errors.push("Enter an industry between 2 and 150 characters.");
  const metroMatch = /^(.{2,}),\s*([A-Z]{2})$/.exec(input.metro.trim());
  if (!metroMatch || input.metro.length > 150 || !isUsState(metroMatch[2])) errors.push("Enter a US metro as City, ST with a valid state code (for example Charlotte, NC).");
  if (!Number.isSafeInteger(input.target) || input.target < 1 || input.target > 100_000) errors.push("Target must be a whole number from 1 to 100,000.");
  if (!Number.isSafeInteger(input.hardBudgetCents) || input.hardBudgetCents < 1 || input.hardBudgetCents > 999_999_999) errors.push("Enter a positive budget with at most two decimals.");
  if (input.exclusions.length > 50 || input.exclusions.some((item) => typeof item !== "string" || item.length > 150)) errors.push("Use at most 50 exclusions, each up to 150 characters.");
  const routed = routeIndustry(input.industry, input.operation);
  const estimate = routed.lane && errors.length === 0 ? {
    minCents: input.target * LANE_BENCHMARKS[routed.lane].minCents,
    maxCents: input.target * LANE_BENCHMARKS[routed.lane].maxCents,
    affordableTarget: Math.floor(input.hardBudgetCents / LANE_BENCHMARKS[routed.lane].maxCents),
    businesses: routed.lane === "A" ? Math.ceil(input.target * 1_000 / 187) : null,
    pilotExpectedContacts: routed.lane === "A" ? Math.floor(LEAD_LIMITS.pilotBusinesses * 187 / 1_000) : null,
  } : null;
  return {
    ...input, industry: input.industry.trim(), metro: input.metro.trim(), lane: routed.lane,
    needsClarification: routed.needsClarification, errors, estimate,
    overBudget: estimate !== null && estimate.maxCents > input.hardBudgetCents,
    benchmarkVersion: BENCHMARK_VERSION, executionEnabled: false as const,
    benchmarkNotice: "Source: Anas's supplied brief. Historical/estimated benchmark, not verified provider pricing or a quote. No pilot has run in this workspace.",
    dataScope: "Published business contacts only; no private phone discovery or personal append.",
    deliveryChannel: "Manual review only. No Caller or SMS connection.",
  };
}

export type BatchGuardInput = {
  lane: LeadLane; stage: "pilot" | "scale"; businesses: number; estimatedCents: number;
  hardBudgetCents: number; spentCents: number; reservedCents: number;
  pilotMeasured: boolean; pilotApproved: boolean; largeBatchApproved: boolean;
  balancesVerified: boolean; ledgerLoaded: boolean;
  lastBatch?: { costCents: number; delivered: number };
};

// Pure decision only. A future server must re-evaluate with authoritative records in a transaction.
export function evaluateBatchGuard(input: BatchGuardInput): string[] {
  const blocked: string[] = [];
  const amounts = [input.businesses, input.estimatedCents, input.hardBudgetCents, input.spentCents, input.reservedCents];
  if (amounts.some((value) => !Number.isSafeInteger(value) || value < 0) || input.businesses === 0 || input.hardBudgetCents === 0 || input.estimatedCents === 0) return ["invalid_amounts"];
  if (input.stage !== "pilot" && input.stage !== "scale") blocked.push("invalid_stage");
  if (input.lane !== "A") blocked.push("lane_paused");
  if (input.ledgerLoaded !== true) blocked.push("global_ledger_required");
  if (input.balancesVerified !== true) blocked.push("balance_check_required");
  if (input.estimatedCents > input.hardBudgetCents - input.spentCents - input.reservedCents) blocked.push("hard_budget_exceeded");
  if (input.stage === "pilot" && (input.businesses > LEAD_LIMITS.pilotBusinesses || input.estimatedCents > LEAD_LIMITS.pilotCents)) blocked.push("pilot_cap_exceeded");
  if (input.stage === "scale" && (input.pilotMeasured !== true || input.pilotApproved !== true)) blocked.push("approved_measured_pilot_required");
  if (input.estimatedCents > LEAD_LIMITS.batchConfirmationCents && input.largeBatchApproved !== true) blocked.push("large_batch_confirmation_required");
  if (input.lastBatch) {
    const { costCents, delivered } = input.lastBatch;
    if (!Number.isSafeInteger(costCents) || costCents < 0 || !Number.isSafeInteger(delivered) || delivered < 0) blocked.push("invalid_batch_evidence");
    else if (costCents > 0 && (delivered === 0 || costCents / delivered > LEAD_LIMITS.stopLossCents)) blocked.push("stop_loss_triggered");
  }
  return blocked;
}
