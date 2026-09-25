export interface CityCoverageRequest {
  city: string;
  region: string;
  country: string;
  qualifiedLeadCount: number;
  hasPlannedCampaign: boolean;
}

export interface LocalNumberCandidate {
  phoneNumber: string;
  locality: string | null;
  region: string | null;
  rateCenter: string | null;
  voice: boolean;
  addressRequirements: "none" | "any" | "local" | "unknown";
}

export interface CityNumberAssignment extends LocalNumberCandidate {
  id: string;
  status: "active" | "retired";
}

export type CoverageDecision =
  | { action: "use_city_number"; assignment: CityNumberAssignment }
  | { action: "quote_city_number"; reason: "campaign" | "lead_threshold" }
  | { action: "use_metro_number"; assignment: CityNumberAssignment }
  | { action: "manual_review"; reason: "invalid_location" | "regulatory_requirement" | "no_voice_candidate" };

export const cityCoveragePolicy = {
  country: "US",
  qualifiedLeadThreshold: 25,
  maximumActiveNumbers: 10,
} as const;

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function matchesCity(assignment: CityNumberAssignment, request: CityCoverageRequest): boolean {
  return assignment.status === "active"
    && normalized(assignment.locality ?? "") === normalized(request.city)
    && normalized(assignment.region ?? "") === normalized(request.region)
    && assignment.voice;
}

function matchesMetro(assignment: CityNumberAssignment, request: CityCoverageRequest): boolean {
  return assignment.status === "active"
    && normalized(assignment.region ?? "") === normalized(request.region)
    && assignment.voice;
}

export function chooseCityCoverage(request: CityCoverageRequest, assignments: readonly CityNumberAssignment[]): CoverageDecision {
  if (request.country !== cityCoveragePolicy.country || !request.city.trim() || !/^[A-Z]{2}$/.test(request.region)) return { action: "manual_review", reason: "invalid_location" };
  const exact = assignments.find(assignment => matchesCity(assignment, request));
  if (exact) return { action: "use_city_number", assignment: exact };
  if (request.hasPlannedCampaign) return { action: "quote_city_number", reason: "campaign" };
  if (request.qualifiedLeadCount >= cityCoveragePolicy.qualifiedLeadThreshold) return { action: "quote_city_number", reason: "lead_threshold" };
  const metro = assignments.find(assignment => matchesMetro(assignment, request));
  if (metro) return { action: "use_metro_number", assignment: metro };
  return { action: "manual_review", reason: "no_voice_candidate" };
}

export function candidateIsEligible(candidate: LocalNumberCandidate): boolean {
  return candidate.voice && candidate.addressRequirements === "none";
}

export function canPreparePurchase(activeNumberCount: number, anasApprovedBudget: boolean): boolean {
  return anasApprovedBudget && activeNumberCount < cityCoveragePolicy.maximumActiveNumbers;
}
