// Phase 4 task 2, the pure half of the parcel step: a licensee's name -> the one owner-occupied home the
// public parcel layer names them on. Port of engine.py PARCEL + parcel_lookup + street_ok (Anas, measured):
// the where clauses, the LAST FIRST% / FIRST LAST owner-string check, the entity-word exclusion and the
// "exactly one distinct owner, else skip" rule are his. No network here: the service fetches, this file
// builds the request and reads the answer, so every state's parser runs against a saved sample.
//
// Verified live 2026-09-21 (free reads): NC, FL (slow, 22 s), AZ, TX Travis (5 s), GA Fulton, WA Snohomish
// and PA Philadelphia answer the engine.py queries as written; TN Davidson stores owners as "LAST, FIRST"
// (engine.py's 'LAST FIRST%' matches nothing there, so TN asks 'LAST%FIRST%'); Cook County's year column
// is the text '2026.0' (engine.py's '2025' returns nothing). Deviations are only in the where clause; the
// match rule is unchanged.

export interface ParcelHit { owner: string; street: string; city: string; zip: string }
export type ParcelKind = 'arcgis' | 'socrata' | 'carto';
export interface ParcelSource {
  state: string; label: string; kind: ParcelKind;
  // Null when the layer is statewide; otherwise the county the layer covers, so the names step can skip
  // licensees who live elsewhere instead of paying a lookup that cannot match.
  county: string | null;
  url(first: string, last: string): string;
  parse(body: unknown): ParcelHit[] | null;
}

// engine.py: number, then a word, and never a unit, suite, floor or PO box. The deliverable gate (05 §7).
export function streetOk(value: string | null | undefined): boolean {
  if (!value) return false;
  const street = value.trim();
  return /^\d+ +[A-Za-z0-9]/.test(street) && !/\b(ste|suite|unit|apt|floor|fl|pmb)\b|#|p\.?o\.? ?box/i.test(street);
}

// engine.py parcel_lookup: an owner string with a trust or company word is never a person's home.
export const ENTITY_OWNER = /TRUST|LLC|INC\b|CORP/;

// Brain recipe B scale rule: about 25% of names resolve to a home in a big county (TX 20, AZ 22, IL 27, NC 25 to 50).
export const PARCEL_HIT_RATE = 0.25;
export const PARCEL_TIMEOUT_MS = 25000;
export const PARCEL_MAX_FAILURES = 3;
export const PARCEL_RESULT_COUNT = 5;
export const IL_ASSESSMENT_YEAR = '2026.0';

// Names go into a SQL LIKE inside a URL: letters, spaces, hyphens and apostrophes only, apostrophes doubled.
export function sqlName(value: string): string {
  return value.toUpperCase().replace(/[^A-Z \-']/g, '').replace(/\s+/g, ' ').trim().replace(/'/g, "''");
}
const encode = (params: Record<string, string>) => new URLSearchParams(params).toString().replace(/\+/g, '%20');

interface ArcgisSpec { state: string; label: string; county: string | null; url: string; fields: string; where(f: string, l: string): string; name: string; street: string; city: string; zip: string; clean?(hit: ParcelHit, raw: Record<string, unknown>): ParcelHit }
const record = (value: unknown): Record<string, unknown> | null => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const str = (value: unknown): string => typeof value === 'number' ? String(value) : typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

function arcgis(spec: ArcgisSpec): ParcelSource {
  return {
    state: spec.state, label: spec.label, kind: 'arcgis', county: spec.county,
    url: (first, last) => `${spec.url}/query?${encode({ where: spec.where(sqlName(first), sqlName(last)), outFields: spec.fields, returnGeometry: 'false', f: 'json', resultRecordCount: String(PARCEL_RESULT_COUNT) })}`,
    parse(body) {
      const data = record(body);
      if (!data || 'error' in data || !Array.isArray(data.features)) return null;
      const hits: ParcelHit[] = [];
      for (const feature of data.features) {
        const raw = record(record(feature)?.attributes);
        if (!raw) continue;
        const owner = str(raw[spec.name]);
        if (!owner || ENTITY_OWNER.test(owner.toUpperCase())) continue;
        const hit: ParcelHit = { owner, street: str(raw[spec.street]), city: str(raw[spec.city]), zip: str(raw[spec.zip]).slice(0, 5) };
        hits.push(spec.clean ? spec.clean(hit, raw) : hit);
      }
      return hits;
    },
  };
}

// The same title-casing engine.py applied to parcel cities.
const titleCase = (value: string) => value.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (_all, lead: string, letter: string) => lead + letter.toUpperCase());

export const PARCEL_SOURCES: Record<string, ParcelSource> = {
  NC: arcgis({ state: 'NC', label: 'NC OneMap statewide parcels', county: null, url: 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0',
    fields: 'ownname,siteadd,scity,szip,parusecode', where: (f, l) => `ownname LIKE '%${l}%' AND ownname LIKE '%${f}%'`, name: 'ownname', street: 'siteadd', city: 'scity', zip: 'szip',
    clean(hit) {
      // NC site addresses sometimes end in ", CITY NC": keep the street only.
      let street = hit.street;
      if (hit.city) street = street.replace(new RegExp(`\\s*,?\\s*${hit.city.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+NC$`, 'i'), '');
      street = street.replace(/,.*$/, '');
      return { ...hit, street, city: titleCase(hit.city) };
    } }),
  FL: arcgis({ state: 'FL', label: 'Florida statewide cadastral (DOR)', county: null, url: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0',
    fields: 'OWN_NAME,PHY_ADDR1,PHY_CITY,PHY_ZIPCD,OWN_ADDR1,OWN_CITY,OWN_ZIPCD', where: (f, l) => `OWN_NAME LIKE '${l} ${f}%'`, name: 'OWN_NAME', street: 'PHY_ADDR1', city: 'PHY_CITY', zip: 'PHY_ZIPCD',
    clean: hit => ({ ...hit, city: titleCase(hit.city) }) }),
  AZ: arcgis({ state: 'AZ', label: 'Maricopa County Assessor parcels (SFR)', county: 'Maricopa', url: 'https://services.arcgis.com/ykpntM6e3tHvzKRJ/arcgis/rest/services/Parcel_Data_View/FeatureServer/0',
    fields: 'OwnerName,OwnerAddressLine1,OwnerCity,OwnerState,OwnerZipCode', where: (f, l) => `OwnerName LIKE '${l} ${f}%' AND PropertyUseDescription LIKE 'SFR%'`, name: 'OwnerName', street: 'OwnerAddressLine1', city: 'OwnerCity', zip: 'OwnerZipCode',
    clean: hit => ({ ...hit, city: titleCase(hit.city) }) }),
  TX: arcgis({ state: 'TX', label: 'Travis County StratMap land parcels', county: 'Travis', url: 'https://services1.arcgis.com/7DRakJXKPEhwv0fM/arcgis/rest/services/stratmap25_landparcels_48453_travis_202508/FeatureServer/0',
    fields: 'OWNER_NAME,MAIL_LINE1,MAIL_CITY,MAIL_ZIP', where: (f, l) => `OWNER_NAME LIKE '${l} ${f}%'`, name: 'OWNER_NAME', street: 'MAIL_LINE1', city: 'MAIL_CITY', zip: 'MAIL_ZIP',
    clean: hit => ({ ...hit, city: titleCase(hit.city) }) }),
  GA: arcgis({ state: 'GA', label: 'Fulton County tax parcels', county: 'Fulton', url: 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services/Tax_Parcels/FeatureServer/0',
    fields: 'Owner,OwnerAddr1,OwnerAddr2,Address', where: (f, l) => `Owner LIKE '${l} ${f}%'`, name: 'Owner', street: 'OwnerAddr1', city: 'OwnerAddr2', zip: 'OwnerAddr2',
    clean(hit) {
      // OwnerAddr2 is "CITY GA 30213": split it.
      const match = /^(.*?)\s+GA\s+(\d{5})/.exec(hit.city);
      return { ...hit, city: titleCase(match ? match[1] : hit.city), zip: match ? match[2] : '' };
    } }),
  TN: arcgis({ state: 'TN', label: 'Nashville / Davidson County parcels', county: 'Davidson', url: 'https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Parcels_view/FeatureServer/0',
    // Verified 2026-09-21: owners are stored "SMITH, TYLER J", so the LIKE allows the comma.
    fields: 'Owner,OwnAddr1,OwnCity,OwnZip', where: (f, l) => `Owner LIKE '${l}%${f}%'`, name: 'Owner', street: 'OwnAddr1', city: 'OwnCity', zip: 'OwnZip',
    clean: hit => ({ ...hit, city: titleCase(hit.city) }) }),
  WA: arcgis({ state: 'WA', label: 'Snohomish County parcels', county: 'Snohomish', url: 'https://services6.arcgis.com/z6WYi9VRHfgwgtyW/arcgis/rest/services/Parcels/FeatureServer/0',
    fields: 'OWNERNAME,OWNERLINE1,OWNERCITY,OWNERZIP', where: (f, l) => `OWNERNAME LIKE '${l} ${f}%'`, name: 'OWNERNAME', street: 'OWNERLINE1', city: 'OWNERCITY', zip: 'OWNERZIP',
    clean: hit => ({ ...hit, city: titleCase(hit.city) }) }),
  IL: {
    state: 'IL', label: 'Cook County Assessor parcel addresses', kind: 'socrata', county: 'Cook',
    url: (first, last) => `https://datacatalog.cookcountyil.gov/resource/3723-97qp.json?${encode({
      $where: `year='${IL_ASSESSMENT_YEAR}' AND owner_address_name like '${sqlName(first)}%${sqlName(last)}'`, $limit: '3',
      $select: 'owner_address_name,owner_address_full,owner_address_city_name,owner_address_zipcode_1,prop_address_full',
    })}`,
    parse(body) {
      if (!Array.isArray(body)) return null;
      const hits: ParcelHit[] = [];
      for (const item of body) {
        const raw = record(item); if (!raw) continue;
        const owner = str(raw.owner_address_name), mail = str(raw.owner_address_full), prop = str(raw.prop_address_full);
        // Owner-occupied only: the mailing address and the property start with the same house number.
        if (!owner || !mail || !prop || mail.split(' ')[0] !== prop.split(' ')[0]) continue;
        if (ENTITY_OWNER.test(owner.toUpperCase())) continue;
        hits.push({ owner, street: mail, city: titleCase(str(raw.owner_address_city_name)), zip: str(raw.owner_address_zipcode_1).slice(0, 5) });
      }
      return hits;
    },
  },
  PA: {
    state: 'PA', label: 'Philadelphia OPA properties', kind: 'carto', county: 'Philadelphia',
    url: (first, last) => `https://phl.carto.com/api/v2/sql?${encode({ q: `SELECT owner_1,location,zip_code FROM opa_properties_public WHERE owner_1 LIKE '${sqlName(last)} ${sqlName(first)}%' AND (mailing_street IS NULL OR mailing_street=location) LIMIT 3` })}`,
    parse(body) {
      const data = record(body);
      if (!data || !Array.isArray(data.rows)) return null;
      const hits: ParcelHit[] = [];
      for (const item of data.rows) {
        const raw = record(item); if (!raw) continue;
        const owner = str(raw.owner_1);
        if (!owner || ENTITY_OWNER.test(owner.toUpperCase())) continue;
        hits.push({ owner, street: str(raw.location), city: 'Philadelphia', zip: str(raw.zip_code).slice(0, 5) });
      }
      return hits;
    },
  },
};

export function parcelSourceFor(state: string): ParcelSource | null { return PARCEL_SOURCES[state.toUpperCase()] ?? null; }
export const PARCEL_STATES: readonly string[] = Object.keys(PARCEL_SOURCES);

// engine.py cmd_parcel: the owner string must actually name this person, LAST FIRST (optionally a middle
// token between) or FIRST ... LAST, not merely contain both tokens somewhere.
export function ownerMatches(first: string, last: string, owner: string): boolean {
  const f = first.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), l = last.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const text = owner.toUpperCase();
  return new RegExp(`\\b${l}\\b[, ]+(?:[A-Z]+ )?${f}\\w*`).test(text) || new RegExp(`\\b${f}\\b[A-Z ]*\\b${l}\\b`).test(text);
}

export type ParcelStatus = 'matched' | 'none' | 'ambiguous' | 'street_not_ok' | 'failed';
export interface ParcelResolution { status: ParcelStatus; hit: ParcelHit | null; owners: number }

// Exactly one distinct owner who is this person and whose parcel has a usable street. Two different
// owners (the "two parcels" case in the do-not-build list) is a skip, never a guess.
export function resolveHome(first: string, last: string, hits: ParcelHit[] | null): ParcelResolution {
  if (hits === null) return { status: 'failed', hit: null, owners: 0 };
  const named = hits.filter(hit => ownerMatches(first, last, hit.owner));
  const owners = new Set(named.map(hit => hit.owner.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12)));
  if (named.length === 0) return { status: 'none', hit: null, owners: 0 };
  if (owners.size !== 1) return { status: 'ambiguous', hit: null, owners: owners.size };
  const usable = named.filter(hit => streetOk(hit.street));
  if (usable.length === 0) return { status: 'street_not_ok', hit: null, owners: 1 };
  return { status: 'matched', hit: usable[0], owners: 1 };
}

// Where the home street of a names row comes from (brain recipe B, step parcel, skip_if): the licence
// file itself for FL RE and FL CPA (Anas), the practitioner rows of the FL barbers file and a TABC mailing
// address that differs from the premises (research); everything else needs the parcel step.
export type HomeStreetSource = 'register' | 'register_mailing' | 'parcel';
export function homeStreetSource(source: string, titleCode: string | null, street: string | null): HomeStreetSource {
  const base = source.split(':')[0];
  if (base === 'fl_re' || base === 'fl_cpa') return 'register';
  if (base === 'fl_dbpr_barbers' && titleCode === 'Barber') return 'register';
  if (base === 'tx_tabc' && street) return 'register_mailing';
  return 'parcel';
}
// True when every row of the register carries the home street, so the quote can skip the parcel hit rate.
export function registerCarriesHomeStreet(source: string): boolean {
  const base = source.split(':')[0];
  return base === 'fl_re' || base === 'fl_cpa';
}

// engine.py show_addresses: the operator eyeballs three full addresses before any trace fires.
export function addressLine(row: { first: string; last: string; street: string; city: string; state: string; zip: string }): string {
  return `${row.first} ${row.last} | ${row.street} | ${row.city} ${row.state} ${row.zip}`.replace(/\s+/g, ' ').trim();
}
