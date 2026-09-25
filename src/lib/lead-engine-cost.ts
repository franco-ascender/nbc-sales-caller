// Cost transparency before spending (master prompt step 3.5: "before every batch tell me ... estimated
// cost"). Two numbers are deliberately kept apart:
//   approved  — what THIS action authorizes. Comes straight from the server quote, never recomputed
//               here, so the figure shown is the figure the server will charge against.
//   projected — the full path to a delivered cell, including stages this action does NOT approve.
// Mixing them is how an operator approves discovery and believes verification was included.

export type RateBasis = 'verified_rate' | 'documented_rate';

export interface CostLine {
  tool: string; stage: string; units: number; unitLabel: string;
  minCents: number; maxCents: number; basis: RateBasis; includedInApproval: boolean;
}
export interface CostEstimate {
  lines: CostLine[];
  approvedMinCents: number; approvedMaxCents: number;
  projectedMinCents: number; projectedMaxCents: number;
  verifiableNumbers: number; expectedCells: number;
  costPerCellMaxCents: number | null;
}

// Measured on Anas's production run of 54,850 businesses (build spec §2), per 1,000 scraped.
// A benchmark from someone else's run, not this workspace's measurement — re-measure per industry.
export const MEASURED_YIELD_PER_THOUSAND = { onTarget: 708, unique: 691, mobile: 346, cells: 187 } as const;

// USD 0.007 per record. Documented in the build spec rate card; BatchData exposes no rate endpoint,
// so this can only ever be 'documented_rate' until an invoice confirms it.
export const VERIFICATION_MILLICENTS_PER_NUMBER = 700;

// compass/crawler-google-places refuses a run whose maxTotalChargeUsd is under its
// minimalMaxTotalChargeUsd (USD 0.50, read live from the actor on 2026-09-17). The cap we send is the
// approved quote maximum, and raising it above what the operator approved would break the budget
// reservation, so an undersized run is refused up front instead of being rejected by the provider
// after the batch is already reserved.
export const PROVIDER_MIN_CHARGE_CENTS = 50;
export function belowProviderMinimum(maxCostCents: number): boolean {
  return !Number.isSafeInteger(maxCostCents) || maxCostCents < PROVIDER_MIN_CHARGE_CENTS;
}

// Anas's figure as relayed by Franco on 2026-09-17, not yet confirmed against a written decision.
// Nothing charges on this: client-facing NBC Credits pricing is not wired anywhere yet.
export const NBC_CREDITS_MARKUP_PERCENT = 20;

const millicentsToCents = (millicents: number, units: number) => Math.ceil(units * millicents / 1000);

export function estimateScrapeCost(input: {
  businesses: number; discoveryTool: string; discoveryMinCents: number; discoveryMaxCents: number;
}): CostEstimate {
  const businesses = Number.isSafeInteger(input.businesses) && input.businesses > 0 ? input.businesses : 0;
  const verifiableNumbers = Math.round(businesses * MEASURED_YIELD_PER_THOUSAND.unique / 1000);
  const expectedCells = Math.floor(businesses * MEASURED_YIELD_PER_THOUSAND.cells / 1000);
  const verificationCents = millicentsToCents(VERIFICATION_MILLICENTS_PER_NUMBER, verifiableNumbers);

  const lines: CostLine[] = [
    {
      tool: input.discoveryTool, stage: 'Business discovery', units: businesses, unitLabel: 'businesses',
      minCents: input.discoveryMinCents, maxCents: input.discoveryMaxCents,
      basis: 'verified_rate', includedInApproval: true,
    },
    {
      tool: 'BatchData', stage: 'Phone verification', units: verifiableNumbers, unitLabel: 'numbers',
      minCents: verificationCents, maxCents: verificationCents,
      basis: 'documented_rate', includedInApproval: false,
    },
  ];

  const projectedMinCents = input.discoveryMinCents + verificationCents;
  const projectedMaxCents = input.discoveryMaxCents + verificationCents;
  return {
    lines,
    approvedMinCents: input.discoveryMinCents, approvedMaxCents: input.discoveryMaxCents,
    projectedMinCents, projectedMaxCents, verifiableNumbers, expectedCells,
    costPerCellMaxCents: expectedCells > 0 ? projectedMaxCents / expectedCells : null,
  };
}

// What a client would be billed once NBC Credits are wired. Separate on purpose: today every figure
// an operator sees is NBC's own provider cost, per Franco's instruction on 2026-09-17.
export function nbcCreditsPrice(providerCents: number): { cents: number; markupPercent: number; confirmed: false } {
  return { cents: Math.ceil(providerCents * (100 + NBC_CREDITS_MARKUP_PERCENT) / 100), markupPercent: NBC_CREDITS_MARKUP_PERCENT, confirmed: false };
}
