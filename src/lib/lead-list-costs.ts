import type {OperationCostRow} from './operation-costs';

export interface LeadListCosts {
  totalMicrousd: number | null;
  discoveryMicrousd: number | null;
  verificationMicrousd: number | null;
  dataAllowanceMicrousd: number | null;
  perMobileMicrousd: number | null;
  verifiedMobiles: number;
  newChecks: number;
  reusedChecks: number;
  missingCharges: number;
  pendingChecks: number;
  status: 'estimated' | 'partial';
}

// Uses the same attributed charges as the cost dashboard. Approval ceilings and
// reservations are never spend. Account plans/taxes are not allocated per list.
export function leadListCosts(row: OperationCostRow, dataAllowanceCents?: number, newChecks = 0, reusedChecks = 0, pendingChecks = 0): LeadListCosts {
  const discoveryMicrousd = row.lines.find(l => l.provider === 'Apify')?.reportedMicrousd ?? null;
  const checks = row.lines.find(l => l.provider === 'BatchData');
  const verificationMicrousd = checks ? checks.estimatedMicrousd : 0;
  const dataAllowanceMicrousd = Number.isSafeInteger(dataAllowanceCents) && dataAllowanceCents! >= 0 ? dataAllowanceCents! * 10000 : null;
  const known = discoveryMicrousd !== null || verificationMicrousd !== null && newChecks > 0;
  const totalMicrousd = known ? (discoveryMicrousd ?? 0) + (verificationMicrousd ?? 0) + (dataAllowanceMicrousd ?? 0) : null;
  const verifiedMobiles = row.qualified ?? 0;
  return {totalMicrousd, discoveryMicrousd, verificationMicrousd, dataAllowanceMicrousd,
    perMobileMicrousd: totalMicrousd !== null && verifiedMobiles > 0 ? totalMicrousd / verifiedMobiles : null,
    verifiedMobiles, newChecks, reusedChecks, pendingChecks, missingCharges: row.missing,
    status: pendingChecks > 0 || row.missing > 0 || dataAllowanceMicrousd === null || !['completed','failed','stopped'].includes(row.state) ? 'partial' : 'estimated'};
}
export function listCostMoney(microusd: number | null): string {
  return microusd === null ? 'Pending' : '$' + (microusd / 1e6).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 4});
}
