import brandsFile from '../data/lead-engine-brands.json' with { type: 'json' };
import directorsFile from '../data/lead-engine-tn-medspa-directors.json' with { type: 'json' };
import { normalizeAddress, tokenSortRatio, ADDRESS_THRESHOLD } from './lead-engine-buckets.ts';
import { normalizeBrandText } from './lead-engine-brands.ts';

// Phase 4 task 4: the med spa identity path, pure. Anas's nppes --industry medspa step looked for the
// spa as an organization (NPI-2) and cleaned 26 percent. The research path goes person first:
//   (a) NPI-1 address roster: clinicians (NP 363L*, PA 363A*, RN 163W*) whose practice LOCATION is the
//       spa's street and suite; sole_proprietor YES, a residential mailing address and a mailing phone
//       that differs from the location phone are the owner signals (04_SOURCE_CATALOG Group D);
//   (b) TX Comptroller franchise tax Public Information Report officers (per record, adapter in the service);
//   (c) medical director graph from the TN Medical Spa Registry: a director on 3 or more spas is a
//       supervising physician for hire, flagged director_only_contact and never delivered as the owner;
//   (d) franchise, telehealth and registered agent service blocklists, applied before any spend.
// resolveMedSpaOwner() runs (d) -> (a) -> (b) -> (c) and returns candidates with an evidence trail.
// Traps honoured: NPPES skip ceiling (limit 200, skip <= 1000, slice by zip) lives in the service;
// organization_name wildcard is trailing only, so nothing here searches by spa name.

const brands = brandsFile as { groups: Record<string, string[]> };
const directors = directorsFile as { rows: number; distinct_directors: number; directors: Record<string, number> };

export const DIRECTOR_ONLY_THRESHOLD = 3;
export type RosterRole = 'NP' | 'PA' | 'RN';
export const ROSTER_TAXONOMY: Record<RosterRole, { prefix: string; description: string }> = {
  NP: { prefix: '363L', description: 'Nurse Practitioner' },
  PA: { prefix: '363A', description: 'Physician Assistant' },
  RN: { prefix: '163W', description: 'Registered Nurse' },
};

export interface ClinicianAddress { street: string | null; street2: string | null; city: string | null; state: string | null; zip: string | null; phone10: string | null }
export interface Clinician {
  npi: string; first: string; last: string; credential: string | null; soleProprietor: boolean | null; status: string | null;
  roles: RosterRole[]; taxonomyCodes: string[]; licenses: Array<{ number: string; state: string }>;
  location: ClinicianAddress; mailing: ClinicianAddress | null;
}

const rec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
export function phone10(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return /^[2-9][0-9]{2}[2-9][0-9]{6}$/.test(ten) ? ten : null;
}
export const zip5 = (value: unknown): string | null => { const digits = String(value ?? '').replace(/\D/g, ''); return digits.length >= 5 ? digits.slice(0, 5) : null; };

function address(entry: Record<string, unknown>): ClinicianAddress {
  return { street: str(entry.address_1), street2: str(entry.address_2), city: str(entry.city), state: str(entry.state), zip: zip5(entry.postal_code), phone10: phone10(entry.telephone_number) };
}
export function rolesOf(codes: readonly string[]): RosterRole[] {
  const out = new Set<RosterRole>();
  for (const code of codes) for (const [role, { prefix }] of Object.entries(ROSTER_TAXONOMY) as Array<[RosterRole, { prefix: string }]>) if (code.startsWith(prefix)) out.add(role);
  return [...out];
}

// One NPPES NPI-1 result as the API returns it (version 2.1). Anything malformed is skipped, never thrown.
export function parseClinician(payload: unknown): Clinician | null {
  if (!rec(payload) || !rec(payload.basic) || typeof payload.number !== 'string' || !/^\d{10}$/.test(payload.number)) return null;
  if (payload.enumeration_type && payload.enumeration_type !== 'NPI-1') return null;
  const basic = payload.basic;
  const first = str(basic.first_name), last = str(basic.last_name);
  if (!first || !last) return null;
  const addresses = (Array.isArray(payload.addresses) ? payload.addresses : []).filter(rec);
  const location = addresses.find(entry => entry.address_purpose === 'LOCATION');
  const mailing = addresses.find(entry => entry.address_purpose === 'MAILING');
  if (!location) return null;
  const taxonomies = (Array.isArray(payload.taxonomies) ? payload.taxonomies : []).filter(rec);
  const codes = taxonomies.map(entry => str(entry.code)).filter((code): code is string => code !== null);
  const licenses = taxonomies.map(entry => ({ number: str(entry.license), state: str(entry.state) })).filter((item): item is { number: string; state: string } => item.number !== null && item.state !== null);
  const sole = str(basic.sole_proprietor);
  return {
    npi: payload.number, first, last, credential: str(basic.credential), soleProprietor: sole === 'YES' ? true : sole === 'NO' ? false : null, status: str(basic.status),
    roles: rolesOf(codes), taxonomyCodes: [...new Set(codes)], licenses: [...new Map(licenses.map(item => [`${item.state}:${item.number}`, item])).values()],
    location: address(location), mailing: mailing ? address(mailing) : null,
  };
}

// Suite tokens are compared on their own: the address normalizer drops unit designators so that
// "Ste 600" and "#600" match, but two spas in one building differ only by suite.
export function suiteOf(street: string | null, street2: string | null): string | null {
  const text = `${street ?? ''} ${street2 ?? ''}`.toLowerCase();
  const match = text.match(/\b(?:ste|suite|unit|apt|bldg|building|#)\s*\.?\s*#?\s*([a-z]?\d+[a-z]?|[a-z])\b/) ?? text.match(/#\s*([a-z0-9]+)/);
  return match ? match[1].replace(/^0+/, '') || match[1] : null;
}
export interface SpaAddress { street: string | null; zip: string | null }
export interface RosterMatch { clinician: Clinician; addressScore: number; suite: 'match' | 'differs' | 'unknown'; matched: boolean }
export function matchClinicianToSpa(spa: SpaAddress, clinician: Clinician): RosterMatch {
  const spaZip = zip5(spa.zip), left = normalizeAddress(spa.street, spaZip), right = normalizeAddress(clinician.location.street, clinician.location.zip);
  // The house number is exact or nothing: "2605 W Swann" and "2615 W Swann" are neighbours, not a match.
  const number = (street: string | null) => (street ?? '').match(/(?:^|\s)(\d+)(?=\s)/)?.[1] ?? null;
  const sameNumber = number(spa.street) !== null && number(spa.street) === number(clinician.location.street);
  const addressScore = sameNumber && left && right && spaZip && clinician.location.zip === spaZip ? tokenSortRatio(left, right) : 0;
  const spaSuite = suiteOf(spa.street, null), theirs = suiteOf(clinician.location.street, clinician.location.street2);
  const suite = spaSuite && theirs ? (spaSuite === theirs ? 'match' : 'differs') : 'unknown';
  return { clinician, addressScore, suite, matched: addressScore >= ADDRESS_THRESHOLD && suite !== 'differs' };
}

export interface ClinicianContact {
  name: string; credential: string | null; roles: RosterRole[]; npi: string; license: { number: string; state: string } | null; soleProprietor: boolean | null;
  locationPhone10: string | null; mailingPhone10: string | null; mailingPhoneDiffers: boolean;
  mailing: 'residential_candidate' | 'po_box' | 'same_as_location' | 'unknown';
}
// The contact the recipe uses: a mailing address that is not the spa is the skip trace key, and a
// mailing phone that differs from the front desk is a free direct line candidate.
export function clinicianContact(clinician: Clinician): ClinicianContact {
  const mailing = clinician.mailing;
  let kind: ClinicianContact['mailing'] = 'unknown';
  if (mailing?.street) {
    if (/^p\.?\s*o\.?\s*box\b/i.test(mailing.street)) kind = 'po_box';
    else kind = normalizeAddress(mailing.street, mailing.zip) === normalizeAddress(clinician.location.street, clinician.location.zip) ? 'same_as_location' : 'residential_candidate';
  }
  const mailingPhone = mailing?.phone10 ?? null;
  return {
    name: `${clinician.first} ${clinician.last}`, credential: clinician.credential, roles: clinician.roles, npi: clinician.npi, license: clinician.licenses[0] ?? null, soleProprietor: clinician.soleProprietor,
    locationPhone10: clinician.location.phone10, mailingPhone10: mailingPhone, mailingPhoneDiffers: Boolean(mailingPhone && mailingPhone !== clinician.location.phone10), mailing: kind,
  };
}

// (c) The medical director graph. Names are compared without punctuation, middle names or credentials.
export function directorKey(name: string): string {
  const tokens = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/,.*$/, '').replace(/\b(md|do|jr|sr|ii|iii|iv|phd|facs)\b\.?/gi, '').toLowerCase().replace(/[^a-z ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return tokens.length >= 2 ? `${tokens[0]} ${tokens[tokens.length - 1]}` : tokens.join(' ');
}
export interface RegistryRow { facility: string; address: string | null; directors: string[] }
export function directorCounts(rows: readonly RegistryRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) for (const name of new Set(row.directors.map(directorKey))) if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  return counts;
}
export function directorOnlyContacts(counts: ReadonlyMap<string, number>, threshold = DIRECTOR_ONLY_THRESHOLD): Set<string> {
  return new Set([...counts.entries()].filter(([, count]) => count >= threshold).map(([name]) => name));
}
// The shipped TN graph (src/data/lead-engine-tn-medspa-directors.json, fetched 2026-09-21).
export function tnDirectorCounts(): Map<string, number> {
  return new Map(Object.entries(directors.directors).map(([name, count]) => [directorKey(name), count]));
}
export const tnRegistrySummary = () => ({ rows: directors.rows, distinctDirectors: directors.distinct_directors, directorOnly: directorOnlyContacts(tnDirectorCounts()).size });

// The registry PDF as text (pypdf or pdftotext output). Rows start "N M/D/YYYY M/D/YYYY Facility ...";
// directors are "Name, MD" or "Name, DO" anywhere in the row block.
export function parseTnRegistryText(text: string): RegistryRow[] {
  const blocks = text.split(/\n(?=\d{1,3} \d{1,2}\/\d{1,2}\/\d{4} \d{1,2}\/\d{1,2}\/\d{4} )/);
  const rows: RegistryRow[] = [];
  for (const block of blocks) {
    const head = block.match(/^(\d{1,3}) (\d{1,2}\/\d{1,2}\/\d{4}) (\d{1,2}\/\d{1,2}\/\d{4}) ([\s\S]*)$/);
    if (!head) continue;
    const rest = head[4];
    const found = [...rest.matchAll(/([A-Z][A-Za-z.\-' ]{3,60}?),\s*(?:MD|DO)\b/g)].map(match => match[1].trim());
    const flat = rest.replace(/\n/g, ' ');
    const addr = flat.match(/(\d+[^,]*,.*?TN\s+\d{5})/);
    const firstLine = rest.split('\n')[0];
    const facility = (addr ? firstLine.split(/ \d+ /)[0] : firstLine).trim().slice(0, 120);
    rows.push({ facility, address: addr ? addr[1] : null, directors: [...new Set(found)] });
  }
  return rows;
}

// (d) Blocklists. A spa whose title carries a corporate, franchise or telehealth brand is not an
// independent owner's business; a registered agent service is never an owner candidate.
function matchGroup(group: string, text: string): string | null {
  const body = ` ${normalizeBrandText(text)} `;
  if (body.trim().length === 0) return null;
  for (const token of [...(brands.groups[group] ?? [])].sort((a, b) => b.length - a.length)) {
    if (!token.includes(' ') && token.length < 5) continue;
    if (body.includes(` ${token} `)) return token;
  }
  return null;
}
export const medSpaFranchise = (businessName: string): string | null => matchGroup('medspa_franchise_telehealth', businessName) ?? matchGroup('medspa_wellness', businessName);
export const registeredAgentService = (name: string): string | null => matchGroup('registered_agent_services', name);

// (b) TX Comptroller PIR officers, as the service adapter returns them (fields REPORTED, not VERIFIED).
export interface TxOfficer { name: string; title: string; address: string | null }
const OWNER_TITLE = /\b(president|managing member|member|manager|owner|director|partner|ceo|principal|sole)\b/i;

export interface MedSpaRow { id: string; name: string; street: string | null; zip: string | null; state: string | null; phone10: string | null; place_id?: string | null }
export type MedSpaStatus = 'blocked_franchise' | 'owner_candidate' | 'director_only' | 'unresolved';
export interface OwnerCandidateRow {
  name: string; role: string; source: 'nppes_npi1' | 'tx_comptroller_pir'; confidence: number; phone10: string | null; residentialMailing: boolean;
  npi: string | null; license: { number: string; state: string } | null; directorOnly: boolean;
}
export interface MedSpaResolution { rowId: string; status: MedSpaStatus; blockedBy: string | null; candidates: OwnerCandidateRow[]; evidence: string[] }
export interface MedSpaInputs { clinicians: readonly Clinician[]; txOfficers: readonly TxOfficer[] | null; directors?: ReadonlyMap<string, number> }

export function resolveMedSpaOwner(row: MedSpaRow, inputs: MedSpaInputs): MedSpaResolution {
  const evidence: string[] = [];
  const blocked = medSpaFranchise(row.name);
  if (blocked) return { rowId: row.id, status: 'blocked_franchise', blockedBy: blocked, candidates: [], evidence: [`title carries blocklisted brand "${blocked}"; dropped before any spend`] };
  const directorOnly = directorOnlyContacts(inputs.directors ?? tnDirectorCounts());
  const candidates: OwnerCandidateRow[] = [];

  // (a) clinicians at the suite.
  const matches = inputs.clinicians.map(clinician => matchClinicianToSpa(row, clinician)).filter(match => match.matched);
  evidence.push(`nppes npi-1 roster: ${inputs.clinicians.length} clinicians in zip ${zip5(row.zip) ?? '?'}, ${matches.length} at the spa address`);
  for (const match of matches.sort((a, b) => b.addressScore - a.addressScore)) {
    const contact = clinicianContact(match.clinician);
    const isDirector = directorOnly.has(directorKey(contact.name));
    let confidence = 0.5 + (match.suite === 'match' ? 0.15 : 0);
    if (contact.soleProprietor) confidence += 0.2;
    if (contact.mailing === 'residential_candidate') confidence += 0.1;
    if (contact.mailingPhoneDiffers) confidence += 0.05;
    if (contact.locationPhone10 && row.phone10 && contact.locationPhone10 === row.phone10) { confidence += 0.05; evidence.push(`${contact.name}: NPI location phone equals the Maps phone`); }
    if (isDirector) { confidence = Math.min(confidence, 0.2); evidence.push(`${contact.name} supervises ${directorOnly.has(directorKey(contact.name)) ? 'three or more' : ''} registered spas: director_only_contact`); }
    candidates.push({ name: contact.name, role: contact.roles.join('/') || contact.credential || 'clinician', source: 'nppes_npi1', confidence: Math.round(Math.min(0.95, confidence) * 100) / 100,
      phone10: contact.mailingPhoneDiffers ? contact.mailingPhone10 : null, residentialMailing: contact.mailing === 'residential_candidate', npi: contact.npi, license: contact.license, directorOnly: isDirector });
  }

  // (b) Texas officers.
  if (inputs.txOfficers) {
    evidence.push(`tx comptroller pir: ${inputs.txOfficers.length} officers`);
    for (const officer of inputs.txOfficers) {
      const agent = registeredAgentService(officer.name);
      if (agent) { evidence.push(`${officer.name} is a registered agent service (${agent}); not an owner`); continue; }
      if (!OWNER_TITLE.test(officer.title)) continue;
      const isDirector = directorOnly.has(directorKey(officer.name));
      candidates.push({ name: officer.name, role: officer.title, source: 'tx_comptroller_pir', confidence: isDirector ? 0.2 : /president|owner|managing member|sole/i.test(officer.title) ? 0.7 : 0.55,
        phone10: null, residentialMailing: false, npi: null, license: null, directorOnly: isDirector });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const usable = candidates.filter(candidate => !candidate.directorOnly);
  const status: MedSpaStatus = usable.length > 0 ? 'owner_candidate' : candidates.length > 0 ? 'director_only' : 'unresolved';
  return { rowId: row.id, status, blockedBy: null, candidates, evidence };
}
