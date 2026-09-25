import { normalizeWords } from './lead-engine-plan.ts';

// Build spec §11.2: every delivered row carries a time zone derived from the business address with an
// area-code fallback. Calls are legal 8:00am to 8:00pm in the RECIPIENT's local time (Florida cap, applied everywhere) and the operator is
// on Eastern, so a missing or invented zone is a compliance trap, not a cosmetic gap.
// An unresolved zone returns null. A blank field is honest; a guessed one gets someone called at 5am.

export const EASTERN = 'America/New_York';
export const CENTRAL = 'America/Chicago';
export const MOUNTAIN = 'America/Denver';
export const ARIZONA = 'America/Phoenix';
export const PACIFIC = 'America/Los_Angeles';
export const ALASKA = 'America/Anchorage';
export const HAWAII = 'Pacific/Honolulu';

const SINGLE_ZONE_STATES: Record<string, string> = {
  CT: EASTERN, DE: EASTERN, DC: EASTERN, GA: EASTERN, ME: EASTERN, MD: EASTERN, MA: EASTERN, NH: EASTERN,
  NJ: EASTERN, NY: EASTERN, NC: EASTERN, OH: EASTERN, PA: EASTERN, RI: EASTERN, SC: EASTERN, VT: EASTERN,
  VA: EASTERN, WV: EASTERN,
  AL: CENTRAL, AR: CENTRAL, IL: CENTRAL, IA: CENTRAL, LA: CENTRAL, MN: CENTRAL, MS: CENTRAL, MO: CENTRAL,
  OK: CENTRAL, WI: CENTRAL,
  CO: MOUNTAIN, MT: MOUNTAIN, NM: MOUNTAIN, UT: MOUNTAIN, WY: MOUNTAIN,
  AZ: ARIZONA, CA: PACIFIC, WA: PACIFIC, HI: HAWAII,
  // The Aleutians keep America/Adak, but no commercial metro sits there; Anchorage covers the rest.
  AK: ALASKA,
};

interface SplitState { zones: readonly string[]; cities: Record<string, string>; areaCodes?: Record<string, string>; fallback?: string }

// Only the minority-zone cities are listed. `fallback` is used only where the minority region holds a
// negligible share of the state; states with a real split and one statewide area code resolve to null
// unless the city is known.
const SPLIT_STATES: Record<string, SplitState> = {
  TX: { zones: [CENTRAL, MOUNTAIN], cities: { 'el paso': MOUNTAIN, socorro: MOUNTAIN, 'horizon city': MOUNTAIN, anthony: MOUNTAIN, fabens: MOUNTAIN }, areaCodes: { '915': MOUNTAIN }, fallback: CENTRAL },
  TN: { zones: [EASTERN, CENTRAL], cities: { knoxville: EASTERN, chattanooga: EASTERN, 'johnson city': EASTERN, kingsport: EASTERN, bristol: EASTERN, cleveland: EASTERN, 'oak ridge': EASTERN, morristown: EASTERN, maryville: EASTERN, sevierville: EASTERN, nashville: CENTRAL, memphis: CENTRAL, murfreesboro: CENTRAL, franklin: CENTRAL, jackson: CENTRAL, clarksville: CENTRAL, hendersonville: CENTRAL, smyrna: CENTRAL, brentwood: CENTRAL, columbia: CENTRAL }, areaCodes: { '423': EASTERN, '865': EASTERN, '615': CENTRAL, '629': CENTRAL, '731': CENTRAL, '901': CENTRAL, '931': CENTRAL } },
  KY: { zones: [EASTERN, CENTRAL], cities: { louisville: EASTERN, lexington: EASTERN, covington: EASTERN, richmond: EASTERN, georgetown: EASTERN, florence: EASTERN, nicholasville: EASTERN, frankfort: EASTERN, 'bowling green': CENTRAL, owensboro: CENTRAL, paducah: CENTRAL, henderson: CENTRAL, hopkinsville: CENTRAL, madisonville: CENTRAL }, areaCodes: { '606': EASTERN, '859': EASTERN, '502': EASTERN, '270': CENTRAL, '364': CENTRAL } },
  FL: { zones: [EASTERN, CENTRAL], cities: { pensacola: CENTRAL, pace: CENTRAL, milton: CENTRAL, 'gulf breeze': CENTRAL, navarre: CENTRAL, 'fort walton beach': CENTRAL, destin: CENTRAL, crestview: CENTRAL, niceville: CENTRAL, 'panama city': CENTRAL, 'panama city beach': CENTRAL, 'lynn haven': CENTRAL, marianna: CENTRAL, 'defuniak springs': CENTRAL, chipley: CENTRAL, bonifay: CENTRAL }, fallback: EASTERN },
  MI: { zones: [EASTERN, CENTRAL], cities: { 'iron mountain': CENTRAL, kingsford: CENTRAL, 'iron river': CENTRAL, ironwood: CENTRAL, menominee: CENTRAL, bessemer: CENTRAL, wakefield: CENTRAL, norway: CENTRAL, 'crystal falls': CENTRAL }, fallback: EASTERN },
  IN: { zones: [EASTERN, CENTRAL], cities: { gary: CENTRAL, hammond: CENTRAL, merrillville: CENTRAL, valparaiso: CENTRAL, 'michigan city': CENTRAL, 'crown point': CENTRAL, portage: CENTRAL, schererville: CENTRAL, evansville: CENTRAL, newburgh: CENTRAL, 'mount vernon': CENTRAL, princeton: CENTRAL, boonville: CENTRAL, vincennes: CENTRAL, 'tell city': CENTRAL, rockport: CENTRAL, petersburg: CENTRAL, knox: CENTRAL, winamac: CENTRAL }, areaCodes: { '219': CENTRAL }, fallback: EASTERN },
  SD: { zones: [CENTRAL, MOUNTAIN], cities: { 'rapid city': MOUNTAIN, spearfish: MOUNTAIN, sturgis: MOUNTAIN, deadwood: MOUNTAIN, 'belle fourche': MOUNTAIN, 'hot springs': MOUNTAIN, custer: MOUNTAIN, lead: MOUNTAIN, 'box elder': MOUNTAIN }, fallback: CENTRAL },
  ND: { zones: [CENTRAL, MOUNTAIN], cities: { dickinson: MOUNTAIN, bowman: MOUNTAIN, beach: MOUNTAIN, hettinger: MOUNTAIN, 'new england': MOUNTAIN, mott: MOUNTAIN, killdeer: MOUNTAIN, medora: MOUNTAIN, belfield: MOUNTAIN, richardton: MOUNTAIN }, fallback: CENTRAL },
  NE: { zones: [CENTRAL, MOUNTAIN], cities: { scottsbluff: MOUNTAIN, gering: MOUNTAIN, sidney: MOUNTAIN, chadron: MOUNTAIN, alliance: MOUNTAIN, ogallala: MOUNTAIN, kimball: MOUNTAIN, bridgeport: MOUNTAIN, crawford: MOUNTAIN, mitchell: MOUNTAIN }, fallback: CENTRAL },
  KS: { zones: [CENTRAL, MOUNTAIN], cities: { goodland: MOUNTAIN, tribune: MOUNTAIN, syracuse: MOUNTAIN, 'sharon springs': MOUNTAIN }, fallback: CENTRAL },
  OR: { zones: [PACIFIC, MOUNTAIN], cities: { ontario: MOUNTAIN, nyssa: MOUNTAIN, vale: MOUNTAIN, 'jordan valley': MOUNTAIN }, fallback: PACIFIC },
  NV: { zones: [PACIFIC, MOUNTAIN], cities: { 'west wendover': MOUNTAIN }, fallback: PACIFIC },
  // Idaho is genuinely split under one area code with no dominant side, so an unknown city stays null.
  ID: { zones: [MOUNTAIN, PACIFIC], cities: { boise: MOUNTAIN, meridian: MOUNTAIN, nampa: MOUNTAIN, caldwell: MOUNTAIN, 'idaho falls': MOUNTAIN, pocatello: MOUNTAIN, 'twin falls': MOUNTAIN, rexburg: MOUNTAIN, blackfoot: MOUNTAIN, burley: MOUNTAIN, 'mountain home': MOUNTAIN, eagle: MOUNTAIN, kuna: MOUNTAIN, ammon: MOUNTAIN, chubbuck: MOUNTAIN, hailey: MOUNTAIN, jerome: MOUNTAIN, preston: MOUNTAIN, rupert: MOUNTAIN, 'coeur d alene': PACIFIC, 'post falls': PACIFIC, hayden: PACIFIC, lewiston: PACIFIC, moscow: PACIFIC, sandpoint: PACIFIC, rathdrum: PACIFIC, 'bonners ferry': PACIFIC, kellogg: PACIFIC, orofino: PACIFIC } },
};

export function zonesForState(state: string): readonly string[] {
  const single = SINGLE_ZONE_STATES[state];
  if (single) return [single];
  return SPLIT_STATES[state]?.zones ?? [];
}

export function resolveTimeZone(input: { state: string; city?: string | null; phone10?: string | null }): string | null {
  const state = typeof input.state === 'string' ? input.state.trim().toUpperCase() : '';
  const single = SINGLE_ZONE_STATES[state];
  if (single) return single;
  const split = SPLIT_STATES[state];
  if (!split) return null;
  const city = normalizeWords(input.city ?? '');
  if (city && split.cities[city]) return split.cities[city];
  const phone = typeof input.phone10 === 'string' && /^\d{10}$/.test(input.phone10) ? input.phone10.slice(0, 3) : null;
  if (phone && split.areaCodes?.[phone]) return split.areaCodes[phone];
  return split.fallback ?? null;
}

// Quality gate (build spec §8): every row has a time zone consistent with its state.
export function timeZoneMatchesState(state: string, timeZone: string | null): boolean {
  if (typeof timeZone !== 'string' || !timeZone) return false;
  return zonesForState(typeof state === 'string' ? state.trim().toUpperCase() : '').includes(timeZone);
}
