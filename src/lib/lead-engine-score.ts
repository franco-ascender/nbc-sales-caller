// Phase 5 task 3: Owner Probability Score v0. The rule based formula from handoff/01_MERGED_ARCHITECTURE.md
// §8, applied to the features frozen on a ledger row (lead_engine_row_ledger.features, and the same keys
// in lead_engine_dial_outcomes.features_snapshot): source weight 0.25, phone differs from Maps 0.20,
// mobile 0.20, name match 0.15, sole proprietor 0.10, small business 0.10. Each factor scores 0 to 1
// and the total is reported 0 to 100 with every contributing factor listed, so a caller can see why a
// row sorts where it does. v1 (a logistic model over dial_outcomes) replaces the weights, not the shape.
//
// Wiring left to the jobs service owner (not done here, see the report):
//   - jobWorkbook(): rows = scoreDialRows(rows.map(row => ({ ...row, features: featuresFromLedger(...) })))
//     so the dial sheet ships owner-likely rows first;
//   - deliver(): store `score` inside features when the ledger row is written (optional, the report recomputes).

export type LineType = 'Mobile' | 'Landline' | 'VoIP' | string;

export interface ScoreFeatures {
  recipe: 'A' | 'B' | 'C' | 'D' | null;
  bucket: 1 | 2 | 3 | 4 | null;
  source_register: string | null;        // 'google_maps', 'fl_dbpr', 'ny_dos_salons', 'nppes', 'reviews', ...
  title_code: string | null;              // register title: owner, president, ambr, mgr, rme, qualifier, ao, ...
  business_type: string | null;           // sole_proprietor, individual, llc, corp, pllc, ...
  phone_reuse_count: number | null;       // how many register rows share the phone
  register_eq_maps: boolean | null;       // register phone equals the Maps phone (business line)
  line_type: LineType | null;
  review_bucket: 'owner_named' | 'owner_reply' | 'none' | null;   // what the reviews extractor found
  personnel_count: number | null;         // staff on the register, booking page or website
  permit_velocity: number | null;         // permits in the last 12 months (contractors)
  license_age_years: number | null;
  reviews: number | null;                 // Maps review count (small business proxy when personnel_count is unknown)
  state: string | null;
  industry: string | null;
}

export interface ScoreFactor { key: string; label: string; weight: number; value: number; points: number; note: string }
export interface OwnerScore { score: number; factors: ScoreFactor[]; context: { state: string | null; industry: string | null } }

export const SCORE_WEIGHTS = { source: 0.25, phone_differs: 0.2, mobile: 0.2, name_match: 0.15, sole_proprietor: 0.1, small_business: 0.1 } as const;

// Registers that name the licensee or owner as a person carry full weight; Maps carries the least
// (a business phone with no name). Reviews sit between: a name, but from a customer's mouth.
const SOURCE_WEIGHT: Array<[RegExp, number, string]> = [
  [/^google_maps$/, 0.3, 'Maps listing: business phone, no name'],
  [/review|about_page/, 0.6, 'name from reviews or the website'],
  [/nppes/, 0.8, 'NPPES authorized official or clinician'],
  [/^$/, 0.5, 'unknown source'],
];
const OWNER_TITLES = /^(owner|sole[_ ]?owner|sole[_ ]?proprietor|proprietor|president|pres|ceo|founder|principal|ambr|authorized[_ ]member|managing[_ ]member|mgrm|member|manager|mgr|partner|qualifier|qualifying[_ ]agent|ao|authorized[_ ]official|drlp|dba[_ ]owner|licensee)$/i;
const EMPLOYEE_TITLES = /^(rme|rmo|responsible[_ ]managing|employee|staff|technician|agent|registered[_ ]agent|director[_ ]only|medical[_ ]director|supervising)$/i;

function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }

function sourceFactor(f: ScoreFeatures): ScoreFactor {
  const source = (f.source_register ?? '').toLowerCase();
  let value = 1, note = `register ${source} names the licensee`;
  for (const [pattern, weight, text] of SOURCE_WEIGHT) if (pattern.test(source)) { value = weight; note = text; break; }
  if (f.bucket === 1) { value = clamp(value + 0.1); note += '; licensed but invisible on Maps'; }
  if ((f.phone_reuse_count ?? 0) > 3) { value = clamp(value - 0.4); note += `; phone on ${f.phone_reuse_count} register rows`; }
  return { key: 'source', label: 'Source weight', weight: SCORE_WEIGHTS.source, value, points: 0, note };
}
function phoneDiffersFactor(f: ScoreFeatures): ScoreFactor {
  let value = 0, note = 'the phone is the Maps phone (recipe A) or unknown';
  if (f.bucket === 2) { value = 1; note = 'register phone differs from the Maps phone (direct line candidate)'; }
  else if (f.bucket === 3 || f.register_eq_maps === true) { value = 0; note = 'register phone equals the Maps phone (business line)'; }
  else if (f.bucket === 1) { value = 0.8; note = 'no Maps listing to contrast; the register phone is the only line'; }
  else if (f.recipe === 'B' || f.recipe === 'C') { value = 0.6; note = 'traced or register phone, no Maps contrast'; }
  return { key: 'phone_differs', label: 'Phone differs from Maps', weight: SCORE_WEIGHTS.phone_differs, value, points: 0, note };
}
function mobileFactor(f: ScoreFeatures): ScoreFactor {
  const mobile = (f.line_type ?? '').toLowerCase() === 'mobile';
  return { key: 'mobile', label: 'Mobile line', weight: SCORE_WEIGHTS.mobile, value: mobile ? 1 : 0, points: 0, note: mobile ? 'verified mobile' : `line type ${f.line_type ?? 'unknown'}` };
}
function nameMatchFactor(f: ScoreFeatures): ScoreFactor {
  const title = (f.title_code ?? '').trim();
  let value = 0, note = 'no named person on the row';
  if (title && OWNER_TITLES.test(title)) { value = 1; note = `register title ${title} is an owner title`; }
  else if (title && EMPLOYEE_TITLES.test(title)) { value = 0.1; note = `register title ${title} is a staff title`; }
  else if (title) { value = 0.5; note = `register title ${title} (unclassified)`; }
  if (f.review_bucket === 'owner_named') { value = Math.max(value, 0.7); note += '; reviews name the owner'; }
  else if (f.review_bucket === 'owner_reply') { value = Math.max(value, 0.5); note += '; owner signs review replies'; }
  return { key: 'name_match', label: 'Name match', weight: SCORE_WEIGHTS.name_match, value, points: 0, note };
}
function soleProprietorFactor(f: ScoreFeatures): ScoreFactor {
  const type = (f.business_type ?? '').toLowerCase();
  let value = 0.4, note = 'business type unknown';
  if (/sole|individual|dba|fictitious|proprietor/.test(type)) { value = 1; note = 'sole proprietor or individual'; }
  else if (/llc|pllc|partnership|lp$/.test(type)) { value = 0.6; note = `single or few member entity (${type})`; }
  else if (/corp|inc|pa$|pc$|nonprofit/.test(type)) { value = 0.3; note = `corporation (${type})`; }
  return { key: 'sole_proprietor', label: 'Sole proprietor', weight: SCORE_WEIGHTS.sole_proprietor, value, points: 0, note };
}
function smallBusinessFactor(f: ScoreFeatures): ScoreFactor {
  let value: number, note: string;
  if (typeof f.personnel_count === 'number') {
    value = f.personnel_count <= 3 ? 1 : f.personnel_count <= 10 ? 0.6 : 0.1; note = `${f.personnel_count} people on record`;
  } else if (typeof f.reviews === 'number') {
    value = f.reviews < 50 ? 0.8 : f.reviews < 200 ? 0.5 : 0.2; note = `${f.reviews} Maps reviews as a size proxy`;
  } else { value = 0.5; note = 'size unknown'; }
  if (typeof f.permit_velocity === 'number' && f.permit_velocity > 24) { value = clamp(value - 0.3); note += `; ${f.permit_velocity} permits in 12 months (crew, not a solo)`; }
  if (typeof f.license_age_years === 'number' && f.license_age_years < 2) { value = clamp(value + 0.1); note += '; new licensee'; }
  return { key: 'small_business', label: 'Small business', weight: SCORE_WEIGHTS.small_business, value, points: 0, note };
}

export function scoreOwnerProbability(features: ScoreFeatures): OwnerScore {
  const factors = [sourceFactor(features), phoneDiffersFactor(features), mobileFactor(features), nameMatchFactor(features), soleProprietorFactor(features), smallBusinessFactor(features)]
    .map(factor => ({ ...factor, value: clamp(factor.value), points: Math.round(clamp(factor.value) * factor.weight * 1000) / 10 }));
  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, factor) => sum + factor.points, 0))));
  return { score, factors, context: { state: features.state, industry: features.industry } };
}

const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

// The ledger stores features as loose JSON (written by the jobs service at delivery). This reads the
// known keys defensively; anything missing scores as unknown, never as a throw.
export function featuresFromLedger(features: Record<string, unknown>, lineType: string | null = 'Mobile'): ScoreFeatures {
  const recipe = str(features.recipe); const bucket = num(features.bucket);
  const issue = str(features.license_issue_date);
  const issued = issue ? Date.parse(issue) : NaN;
  const reviewBucket = str(features.review_bucket);
  return {
    recipe: recipe === 'A' || recipe === 'B' || recipe === 'C' || recipe === 'D' ? recipe : null,
    bucket: bucket === 1 || bucket === 2 || bucket === 3 || bucket === 4 ? bucket : null,
    source_register: str(features.source_register), title_code: str(features.title_code), business_type: str(features.business_type),
    phone_reuse_count: num(features.phone_reuse_count), register_eq_maps: bool(features.register_eq_maps),
    line_type: str(features.line_type) ?? lineType,
    review_bucket: reviewBucket === 'owner_named' || reviewBucket === 'owner_reply' || reviewBucket === 'none' ? reviewBucket : null,
    personnel_count: num(features.personnel_count), permit_velocity: num(features.permit_velocity),
    license_age_years: num(features.license_age_years) ?? (Number.isFinite(issued) ? Math.max(0, (Date.now() - issued) / (365.25 * 86400000)) : null),
    reviews: num(features.reviews), state: str(features.state), industry: str(features.industry),
  };
}

// Sort order for the dial sheet: highest owner probability first, then the caller's original position
// (stable). Rows keep every field they came with plus `score`.
export function scoreDialRows<T extends { features: ScoreFeatures }>(rows: readonly T[]): Array<T & { score: number }> {
  return rows.map((row, index) => ({ row, index, score: scoreOwnerProbability(row.features).score }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ row, score }) => ({ ...row, score }));
}
