import { LeadEngineError } from '../lib/lead-engine-storage.ts';
import { parseClinician, resolveMedSpaOwner, tnDirectorCounts, ROSTER_TAXONOMY } from '../lib/lead-engine-medspa.ts';
import type { Clinician, MedSpaRow, MedSpaResolution, RosterRole, TxOfficer } from '../lib/lead-engine-medspa.ts';

// Phase 4 task 4, the network half. Everything here is free and public:
//   (a) NPPES NPI-1 address roster per zip and taxonomy (npiregistry.cms.hhs.gov, no key). The API
//       caps limit at 200 and skip at 1000 (skip=1200 silently repeats skip=1000), so a zip with more
//       than 1,200 clinicians of one taxonomy is truncated and reported as such; dedupe on number.
//   (b) TX Comptroller Public Information Report: the catalog names https://mycpa.cpa.state.tx.us/coa/,
//       which today (2026-09-21) redirects to https://comptroller.texas.gov/taxes/franchise/account-status/search,
//       an HTML search form with no JSON endpoint observed. The adapter below is a documented, UNVERIFIED
//       HTML parser exercised on a fixture only; it never claims fields it did not see. The paid route
//       (Apify bovi/texas-taxable-entity, $1.50 per 1,000) is not used.
//   (c) the TN director graph ships as data (src/data/lead-engine-tn-medspa-directors.json).

const MAX_BODY_BYTES = 4 * 1024 * 1024;
export const NPPES_LIMIT = 200;
export const NPPES_SKIP_CEILING = 1000;

function nppesError(): LeadEngineError { return new LeadEngineError(503, 'nppes_unavailable', 'The NPPES registry could not be read. No clinicians were produced from this call.'); }
const rec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) { await response.body?.cancel(); throw nppesError(); }
  const text = await response.text();
  if (text.length > MAX_BODY_BYTES) throw nppesError();
  try { return JSON.parse(text); } catch { throw nppesError(); }
}

export interface RosterPage { clinicians: Clinician[]; resultCount: number; truncated: boolean }
export interface RosterResult { zip: string; clinicians: Clinician[]; perRole: Record<RosterRole, { fetched: number; truncated: boolean }>; queries: number }

export function createNpiRoster(request: typeof fetch = fetch) {
  async function page(zip: string, role: RosterRole, skip: number): Promise<{ rows: unknown[]; resultCount: number }> {
    const params = new URLSearchParams({ version: '2.1', enumeration_type: 'NPI-1', address_purpose: 'LOCATION', postal_code: zip, taxonomy_description: ROSTER_TAXONOMY[role].description, limit: String(NPPES_LIMIT), skip: String(skip) });
    let response: Response;
    try { response = await request(`https://npiregistry.cms.hhs.gov/api/?${params}`, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) }); }
    catch { throw nppesError(); }
    const data = await readJson(response);
    if (!rec(data) || !Number.isSafeInteger(data.result_count) || !Array.isArray(data.results)) throw nppesError();
    return { rows: data.results, resultCount: data.result_count as number };
  }
  return {
    // Every clinician of one role at a LOCATION in the zip, walking skip up to the ceiling.
    async role(zip: string, role: RosterRole): Promise<RosterPage> {
      if (!/^\d{5}$/.test(zip)) throw new LeadEngineError(400, 'invalid_input', 'A five digit zip is required.');
      const out = new Map<string, Clinician>(); let skip = 0, truncated = false, total = 0;
      for (;;) {
        const { rows, resultCount } = await page(zip, role, skip);
        total = Math.max(total, resultCount);
        for (const row of rows) { const clinician = parseClinician(row); if (clinician && clinician.location.zip === zip) out.set(clinician.npi, clinician); }
        if (rows.length < NPPES_LIMIT) break;
        if (skip >= NPPES_SKIP_CEILING) { truncated = true; break; }
        skip += NPPES_LIMIT;
      }
      return { clinicians: [...out.values()], resultCount: total, truncated };
    },
    async zip(zip: string): Promise<RosterResult> {
      const all = new Map<string, Clinician>();
      const perRole = {} as Record<RosterRole, { fetched: number; truncated: boolean }>;
      let queries = 0;
      for (const role of Object.keys(ROSTER_TAXONOMY) as RosterRole[]) {
        const result = await this.role(zip, role); queries += Math.ceil(Math.max(1, result.clinicians.length) / NPPES_LIMIT);
        perRole[role] = { fetched: result.clinicians.length, truncated: result.truncated };
        for (const clinician of result.clinicians) { const known = all.get(clinician.npi); all.set(clinician.npi, known ? { ...known, roles: [...new Set([...known.roles, ...clinician.roles])] } : clinician); }
      }
      return { zip, clinicians: [...all.values()], perRole, queries };
    },
  };
}

// (b) TX Comptroller PIR adapter: UNVERIFIED. parseTxPirHtml reads an officers table of the shape the
// catalog REPORTS (name, title, address columns); the live form needs a per-entity search first.
export const TX_COMPTROLLER_SEARCH_URL = 'https://comptroller.texas.gov/taxes/franchise/account-status/search';
export interface TxPirResult { verified: false; officers: TxOfficer[]; note: string }
export function parseTxPirHtml(html: string): TxOfficer[] {
  const officers: TxOfficer[] = [];
  const rows = html.replace(/\s+/g, ' ').match(/<tr[^>]*>.*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gi)].map(match => match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim());
    if (cells.length < 2 || /^(name|officer)/i.test(cells[0]) && /^title/i.test(cells[1])) continue;
    if (!/^[A-Za-z][A-Za-z.,'\- ]{2,80}$/.test(cells[0]) || !cells[1]) continue;
    officers.push({ name: cells[0], title: cells[1], address: cells[2] ?? null });
  }
  return officers;
}
export function createTxComptrollerAdapter(request: typeof fetch = fetch) {
  return {
    async officers(entityName: string): Promise<TxPirResult> {
      const name = entityName.trim().slice(0, 120);
      if (!name) return { verified: false, officers: [], note: 'empty entity name' };
      try {
        const response = await request(`${TX_COMPTROLLER_SEARCH_URL}?name=${encodeURIComponent(name)}`, { method: 'GET', cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { Accept: 'text/html' } });
        if (!response.ok) return { verified: false, officers: [], note: `HTTP ${response.status} from the Comptroller search; adapter unverified` };
        const html = (await response.text()).slice(0, 1024 * 1024);
        return { verified: false, officers: parseTxPirHtml(html), note: 'parsed from the search response; the PIR officer table layout is REPORTED, not verified live' };
      } catch { return { verified: false, officers: [], note: 'network error reaching the Comptroller search; adapter unverified' }; }
    },
  };
}

// The live orchestration for one spa row: roster for its zip (three free queries plus pagination), the
// Texas officers when the row is in TX, the shipped director graph, then the pure resolver.
export async function resolveMedSpaOwnerLive(row: MedSpaRow, request: typeof fetch = fetch): Promise<MedSpaResolution & { roster: RosterResult['perRole'] | null; txNote: string | null }> {
  const zip = (row.zip ?? '').replace(/\D/g, '').slice(0, 5);
  const roster = /^\d{5}$/.test(zip) ? await createNpiRoster(request).zip(zip) : null;
  const tx = row.state === 'TX' ? await createTxComptrollerAdapter(request).officers(row.name) : null;
  const resolution = resolveMedSpaOwner(row, { clinicians: roster?.clinicians ?? [], txOfficers: tx?.officers ?? null, directors: tnDirectorCounts() });
  if (roster) for (const [role, info] of Object.entries(roster.perRole)) if (info.truncated) resolution.evidence.push(`nppes ${role} roster truncated at the 1,200 row ceiling for zip ${zip}`);
  return { ...resolution, roster: roster?.perRole ?? null, txNote: tx?.note ?? null };
}
