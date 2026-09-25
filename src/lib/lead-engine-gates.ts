import { matchesPhrase } from './lead-engine-plan.ts';
import { normalizeBusinessPhone } from './lead-engine-quality.ts';
import { timeZoneMatchesState } from './lead-engine-timezone.ts';
import { streetOk } from './lead-engine-parcel.ts';

// Build spec §8: a failed gate must PREVENT delivery, not warn. Every check below returns a blocking
// code; an empty array is the only thing that authorizes handing a file to a caller.

export interface DeliveryRow {
  company: string; phone10: string; city: string; state: string; timeZone: string | null;
  lineType: string | null; dnc: boolean | null; tcpa: boolean | null; reachable: boolean | null; verifiedAt: string | null;
}
export interface DeliveryGateInput {
  rows: readonly DeliveryRow[];
  topRows: readonly DeliveryRow[];
  summaryCount: number;
  mobilesFound: number;
  dncExcluded: number;
  deliveredPhones: ReadonlySet<string>;
  suppressedPhones: ReadonlySet<string>;
  exclusions: readonly string[];
  now: number;
  staleScrubOverride?: boolean;
}

const SCRUB_MAX_AGE_MS = 31 * 86_400_000;
// The 15–60% DNC band diagnoses a broken filter. Below this many mobiles the ratio is noise, not
// evidence, so a small pilot is not blocked on it — call it out to the operator instead.
const DNC_BAND_MIN_SAMPLE = 20;

export function evaluateDeliveryGates(input: DeliveryGateInput): string[] {
  const failures: string[] = [];
  const { rows, topRows } = input;

  if (!Number.isSafeInteger(input.summaryCount) || input.summaryCount !== rows.length) failures.push('row_count_mismatch');

  const phones = rows.map(row => row.phone10);
  if (new Set(phones).size !== phones.length) failures.push('duplicate_phone_in_file');
  if (phones.some(phone => normalizeBusinessPhone(phone) !== phone)) failures.push('invalid_phone_format');
  if (rows.some(row => typeof row.company !== 'string' || !row.company.trim())) failures.push('missing_company_name');

  if (phones.some(phone => input.deliveredPhones.has(phone))) failures.push('already_delivered_intersection');
  if (phones.some(phone => input.suppressedPhones.has(phone))) failures.push('suppression_intersection');

  if (rows.some(row => !timeZoneMatchesState(row.state, row.timeZone))) failures.push('time_zone_missing_or_inconsistent');

  if (rows.some(row => row.lineType !== 'Mobile' || row.dnc !== false || row.tcpa !== false || row.reachable !== true)) {
    failures.push('unverified_or_excluded_number_present');
  }

  if (input.mobilesFound >= DNC_BAND_MIN_SAMPLE) {
    const rate = input.dncExcluded / input.mobilesFound;
    if (!(rate >= 0.15 && rate <= 0.6)) failures.push('dnc_exclusion_rate_out_of_range');
  } else if (rows.length > 0 && input.mobilesFound === 0) {
    failures.push('mobile_count_inconsistent');
  }

  const inFile = new Set(phones);
  if (topRows.some(row => !inFile.has(row.phone10))) failures.push('top_rows_not_subset');

  if (rows.some(row => input.exclusions.some(term => matchesPhrase(`${row.company} ${row.city} ${row.state}`, term)))) {
    failures.push('operator_exclusion_present');
  }

  if (input.staleScrubOverride !== true) {
    const stale = rows.some(row => {
      const verified = Date.parse(row.verifiedAt ?? '');
      return !Number.isFinite(verified) || verified > input.now || input.now - verified >= SCRUB_MAX_AGE_MS;
    });
    if (stale) failures.push('stale_dnc_scrub');
  }

  return failures;
}

// Phase 1 task 4 (Anas §7): the job runner's blocking checks, evaluated inside deliver() on the rows
// about to be settled. Same rule as above: any failure prevents delivery. `clean_rate_out_of_range`
// (a filter that broke, 10% to 70% of verified input) is the one gate an operator may override by
// resuming the frozen job; the override is recorded on the file, never silent.

export interface JobGateRow {
  phone10: string; company: string; state: string | null; timeZone: string | null;
  lineType: string | null; dnc: boolean | null; tcpa: boolean | null; reachable: boolean | null; flagged: boolean;
  // Lane B (05 §7): the row came from a skip trace, the address it was traced at, and how many distinct
  // parcel owners the name matched (one is the only number that may be traced).
  traced?: boolean; homeStreet?: string | null; parcelOwners?: number | null;
}
export interface JobGateInput {
  rows: readonly JobGateRow[];          // delivered rows plus flag-mode DNC rows
  dncMode: 'strict' | 'flag';
  verifiedInput: number;                // numbers that went through verify
  summary: { delivered: number; flagged: number };
  brokenFilterOverride?: boolean;       // operator resumed after a clean_rate freeze
  // Recipe A cannot be the deliverable for the guardrail industries (attorneys, CPAs, med spas).
  recipe: 'A' | 'B' | 'C' | 'D'; industryKey: string;
}
export interface JobGateResult { failures: string[]; cleanRate: number | null; note: string | null }

export const CLEAN_RATE_MIN = 0.1;
export const CLEAN_RATE_MAX = 0.7;
// Below this many verified numbers the clean rate is noise (a 20 cell sample can legitimately be 75%).
export const CLEAN_RATE_MIN_SAMPLE = 30;
export const NEVER_MAPS_DELIVERABLE: readonly string[] = ['attorney', 'attorney_ny', 'cpa', 'med_spa'];

export function evaluateJobGates(input: JobGateInput): JobGateResult {
  const failures: string[] = [];
  const { rows } = input;
  const phones = rows.map(row => row.phone10);
  if (new Set(phones).size !== phones.length) failures.push('duplicate_phone_in_file');
  if (phones.some(phone => normalizeBusinessPhone(phone) !== phone)) failures.push('invalid_phone_format');
  if (rows.some(row => typeof row.company !== 'string' || !row.company.trim())) failures.push('missing_company_name');
  if (rows.some(row => !row.state || !timeZoneMatchesState(row.state, row.timeZone))) failures.push('time_zone_missing_or_inconsistent');
  if (rows.some(row => row.lineType !== 'Mobile' || row.reachable !== true)) failures.push('landline_or_voip_present');
  if (rows.some(row => row.tcpa !== false)) failures.push('tcpa_litigator_present');
  const dncRows = rows.filter(row => row.dnc !== false);
  if (input.dncMode === 'strict' ? dncRows.length > 0 : dncRows.some(row => !row.flagged)) failures.push(input.dncMode === 'strict' ? 'dnc_present' : 'dnc_unmarked_in_flag_mode');
  const delivered = rows.filter(row => !row.flagged).length, flagged = rows.length - delivered;
  if (input.summary.delivered !== delivered || input.summary.flagged !== flagged) failures.push('summary_counts_mismatch');
  if (input.recipe === 'A' && NEVER_MAPS_DELIVERABLE.includes(input.industryKey)) failures.push('maps_deliverable_forbidden');
  if (input.recipe === 'B') {
    // Lane B: every traced address had number + street + suffix (engine's street_ok); a name that matched two parcels is never traced.
    const traced = rows.filter(row => row.traced === true);
    if (traced.some(row => !streetOk(row.homeStreet))) failures.push('traced_address_incomplete');
    if (traced.some(row => (row.parcelOwners ?? 1) !== 1)) failures.push('two_parcel_trace_present');
  }

  let cleanRate: number | null = null, note: string | null = null;
  if (input.verifiedInput >= CLEAN_RATE_MIN_SAMPLE) {
    cleanRate = delivered / input.verifiedInput;
    if (cleanRate < CLEAN_RATE_MIN || cleanRate > CLEAN_RATE_MAX) {
      const text = `clean rate ${(cleanRate * 100).toFixed(0)}% of ${input.verifiedInput} verified is outside 10% to 70% (broken_filter)`;
      if (input.brokenFilterOverride) note = `Delivered under operator override: ${text}.`;
      else failures.push(`clean_rate_out_of_range: ${text}`);
    }
  }
  return { failures, cleanRate, note };
}
