// Phase 3 task 1: the bucket step of recipe D, pure and dependency free. Register rows (a licensee with
// a name, an address and usually a phone) are matched to Google Maps places scraped for the same trade
// and cities. Name match: token-sort ratio >= 0.87 on the normalized business or person name. Address
// match: token-sort ratio >= 0.90 on street + zip. The 0.80 to 0.87 name band is counted (manual review
// signal, brain §3) and never treated as a match. Buckets:
//   1 register only (licensed but invisible)      2 matched, phones differ (register phone = direct line candidate)
//   3 matched, phones equal (business line)        4 Maps only (route like recipe A)

export const NAME_THRESHOLD = 0.87;
export const NAME_BAND_LOW = 0.8;
export const ADDRESS_THRESHOLD = 0.9;

export type Bucket = 1 | 2 | 3 | 4;
export type BusinessLineEvidence = 'register_eq_maps' | 'verify_business_flag' | 'none';

export interface RegisterRow { id: string; name: string; ownerName?: string | null; street: string | null; city: string | null; zip: string | null; phone10: string | null }
export interface MapsRow { id: string; name: string; street: string | null; city: string | null; zip: string | null; phone10: string | null; placeId: string | null }

export interface RegisterAssignment { registerId: string; bucket: 1 | 2 | 3; mapsId: string | null; placeId: string | null; mapsPhone: string | null; nameScore: number; addressScore: number; evidence: BusinessLineEvidence }
export interface BucketResult {
  register: RegisterAssignment[];
  mapsOnly: string[];          // Maps rows nobody matched: bucket 4
  matchedMaps: string[];       // Maps rows consumed by a register match
  counts: { bucket1: number; bucket2: number; bucket3: number; bucket4: number; band: number };
}

const SUFFIXES = new Set(['llc', 'l l c', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'lp', 'llp', 'pllc', 'pc', 'pa', 'dba', 'the', 'and']);
const STREET_WORDS: Record<string, string> = {
  street: 'st', avenue: 'ave', av: 'ave', boulevard: 'blvd', road: 'rd', drive: 'dr', lane: 'ln', court: 'ct', circle: 'cir', place: 'pl', parkway: 'pkwy', highway: 'hwy',
  terrace: 'ter', trail: 'trl', way: 'way', north: 'n', south: 's', east: 'e', west: 'w', northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
  suite: '', ste: '', unit: '', apt: '', building: '', bldg: '', floor: '', fl: '',
};

const ascii = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

// Runs of single letters ("A.C.M.E.", "L.L.C.") collapse into one token before suffix stripping.
function joinInitials(tokens: string[]): string[] {
  const out: string[] = [];
  let run = '';
  for (const token of tokens) {
    if (token.length === 1) { run += token; continue; }
    if (run) { out.push(run); run = ''; }
    out.push(token);
  }
  if (run) out.push(run);
  return out;
}
// Corporate suffixes and articles out, tokens sorted so word order never matters.
export function normalizeName(value: string): string {
  return joinInitials(ascii(value).split(' ').filter(Boolean)).filter(token => !SUFFIXES.has(token)).sort().join(' ');
}
// Street words abbreviated, unit designators dropped (the licence says Ste 200, Maps says #200), zip appended.
export function normalizeAddress(street: string | null, zip: string | null): string {
  const tokens = ascii(street ?? '').split(' ').filter(Boolean).map(token => (token in STREET_WORDS ? STREET_WORDS[token] : token)).filter(Boolean);
  const zip5 = (zip ?? '').replace(/\D/g, '').slice(0, 5);
  return [...tokens.sort(), zip5].filter(Boolean).join(' ');
}

// Longest common subsequence length: the rapidfuzz "ratio" is the normalized Indel similarity,
// 2 * LCS / (|a| + |b|), which this reproduces on sorted-token strings (so it is a token sort ratio).
function lcs(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  let previous = new Array<number>(b.length + 1).fill(0);
  let current = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) current[j] = a[i - 1] === b[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}
export function tokenSortRatio(a: string, b: string): number {
  const left = a.split(' ').filter(Boolean).sort().join(' '), right = b.split(' ').filter(Boolean).sort().join(' ');
  if (left.length === 0 && right.length === 0) return 0;
  if (left === right) return 1;
  return (2 * lcs(left, right)) / (left.length + right.length);
}

export interface MatchScore { nameScore: number; addressScore: number; phoneEqual: boolean; matched: boolean; band: boolean }
// A match is name + address above both thresholds, or the same ten digits on both sides (the register
// printed the number Maps advertises: that is bucket 3 whatever the spelling).
export function scorePair(register: RegisterRow, maps: MapsRow): MatchScore {
  const names = [register.name, register.ownerName ?? ''].filter(Boolean).map(normalizeName);
  const mapsName = normalizeName(maps.name);
  const nameScore = Math.max(0, ...names.map(name => tokenSortRatio(name, mapsName)));
  const left = normalizeAddress(register.street, register.zip), right = normalizeAddress(maps.street, maps.zip);
  const addressScore = left && right ? tokenSortRatio(left, right) : 0;
  const phoneEqual = Boolean(register.phone10 && maps.phone10 && register.phone10 === maps.phone10);
  const matched = phoneEqual || (nameScore >= NAME_THRESHOLD && addressScore >= ADDRESS_THRESHOLD);
  return { nameScore, addressScore, phoneEqual, matched, band: !matched && nameScore >= NAME_BAND_LOW && nameScore < NAME_THRESHOLD && addressScore >= ADDRESS_THRESHOLD };
}

const blockKey = (zip: string | null, city: string | null) => { const z = (zip ?? '').replace(/\D/g, '').slice(0, 5); return z ? `z:${z}` : `c:${ascii(city ?? '')}`; };

// Candidates are blocked by zip (or city when a side has no zip) and by phone, so a thousand register
// rows against a few thousand places stays in the low millions of character comparisons.
export function assignBuckets(register: readonly RegisterRow[], maps: readonly MapsRow[]): BucketResult {
  const byBlock = new Map<string, MapsRow[]>(), byCity = new Map<string, MapsRow[]>(), byPhone = new Map<string, MapsRow>();
  for (const row of maps) {
    const key = blockKey(row.zip, row.city);
    byBlock.set(key, [...(byBlock.get(key) ?? []), row]);
    const city = `c:${ascii(row.city ?? '')}`;
    byCity.set(city, [...(byCity.get(city) ?? []), row]);
    if (row.phone10 && !byPhone.has(row.phone10)) byPhone.set(row.phone10, row);
  }
  const taken = new Set<string>();
  const result: BucketResult = { register: [], mapsOnly: [], matchedMaps: [], counts: { bucket1: 0, bucket2: 0, bucket3: 0, bucket4: 0, band: 0 } };
  // Phone-equal pairs are certain, so they claim their place before any name match can take it.
  const phoneFirst = (row: RegisterRow) => (row.phone10 && byPhone.has(row.phone10) ? 0 : 1);
  const ordered = [...register].sort((a, b) => phoneFirst(a) - phoneFirst(b));
  for (const row of ordered) {
    const candidates = new Map<string, MapsRow>();
    for (const candidate of [...(byBlock.get(blockKey(row.zip, row.city)) ?? []), ...(byCity.get(`c:${ascii(row.city ?? '')}`) ?? [])]) candidates.set(candidate.id, candidate);
    const byPhoneHit = row.phone10 ? byPhone.get(row.phone10) : undefined;
    if (byPhoneHit) candidates.set(byPhoneHit.id, byPhoneHit);
    let best: { maps: MapsRow; score: MatchScore } | null = null, sawBand = false;
    for (const candidate of candidates.values()) {
      if (taken.has(candidate.id)) continue;
      const score = scorePair(row, candidate);
      if (score.band) sawBand = true;
      if (!score.matched) continue;
      const rank = (s: MatchScore) => (s.phoneEqual ? 2 : 0) + s.nameScore + s.addressScore;
      if (!best || rank(score) > rank(best.score)) best = { maps: candidate, score };
    }
    if (!best) {
      if (sawBand) result.counts.band++;
      result.counts.bucket1++;
      result.register.push({ registerId: row.id, bucket: 1, mapsId: null, placeId: null, mapsPhone: null, nameScore: 0, addressScore: 0, evidence: 'none' });
      continue;
    }
    taken.add(best.maps.id); result.matchedMaps.push(best.maps.id);
    const equal = Boolean(row.phone10 && best.maps.phone10 && row.phone10 === best.maps.phone10);
    // No register phone: nothing to contrast, the Maps phone is the only line (treated as a business line).
    const bucket: 2 | 3 = equal || !row.phone10 ? 3 : 2;
    result.counts[bucket === 2 ? 'bucket2' : 'bucket3']++;
    result.register.push({ registerId: row.id, bucket, mapsId: best.maps.id, placeId: best.maps.placeId, mapsPhone: best.maps.phone10, nameScore: best.score.nameScore, addressScore: best.score.addressScore, evidence: equal ? 'register_eq_maps' : 'none' });
  }
  for (const row of maps) if (!taken.has(row.id)) { result.mapsOnly.push(row.id); result.counts.bucket4++; }
  return result;
}

export const bucketLabel = (bucket: Bucket | null): string => bucket === 1 ? 'Register only (invisible on Maps)' : bucket === 2 ? 'Direct line candidate (differs from Maps)' : bucket === 3 ? 'Business line (equals Maps)' : bucket === 4 ? 'Maps only' : 'Maps scrape';
