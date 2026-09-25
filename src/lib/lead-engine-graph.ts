// Phase 5 task 2: the entity graph with history. Pure edge builders for lead_engine_entity_graph_edges
// (migration 202609210230): every ingest and every match writes edges with observed_at and nothing is
// ever overwritten, so the registers' history (a phone moving from a company to a person, a licence
// returning under a new LLC, a spa changing its medical director) accumulates here.
//
// Call sites for the jobs service owner (writes are NOT wired here; see the report):
//   1. names phase, after each register page is read:      writeEdges(db, edgesFromRegisterRow(row))
//   2. scrape phase, after each Maps dataset page is saved: writeEdges(db, edgesFromMapsRow(row))
//   3. bucket phase, per assignment:                        writeEdges(db, edgesFromBucketMatch(...))
//   4. verify phase, per verified number:                   writeEdges(db, edgesFromVerification(...))
//   5. deliver(), per ledger row:                           writeEdges(db, edgesFromDelivery(...))
// writeEdges inserts with on-conflict-do-nothing on (from, to, relation, source, observed_day), so a
// re-run of the same step on the same day adds nothing and a later day adds a new observation.

import { normalizeName } from './lead-engine-buckets.ts';

export type NodeType = 'person' | 'business' | 'license' | 'phone' | 'place' | 'permit' | 'sos_entity' | 'npi';
export const NODE_TYPES: readonly NodeType[] = ['person', 'business', 'license', 'phone', 'place', 'permit', 'sos_entity', 'npi'];

export interface GraphEdge {
  from_type: NodeType; from_id: string; to_type: NodeType; to_id: string;
  relation: string;          // ^[a-z_]{1,60}$
  source: string;            // register key, 'google_maps', 'bucket', vendor name, 'delivery'
  observed_at: string;       // ISO timestamp
  payload: Record<string, unknown> | null;
}

const RELATION = /^[a-z_]{1,60}$/;
const PHONE10 = /^[2-9][0-9]{2}[2-9][0-9]{6}$/;
const ascii = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Node ids are stable text keys, never database ids, so the same person seen in two registers is one node.
export function personId(first: string | null, last: string | null): string | null {
  const name = ascii(`${first ?? ''} ${last ?? ''}`);
  return name.length >= 3 && name.includes(' ') ? name : null;
}
export function businessId(name: string, state: string | null, zip: string | null): string | null {
  // Corporate suffixes out and tokens sorted (the bucket normalizer), so "Acme Roofing LLC" on the
  // register and "Acme Roofing" on Maps are one business node.
  const base = normalizeName(name);
  if (!base) return null;
  return [base, (state ?? '').toUpperCase(), (zip ?? '').replace(/\D/g, '').slice(0, 5)].filter(Boolean).join('|').slice(0, 300);
}
export const licenseId = (source: string, sourceRowId: string): string => `${source}:${sourceRowId}`.slice(0, 300);
export const phoneId = (phone10: string): string | null => (PHONE10.test(phone10) ? phone10 : null);

export function isValidEdge(edge: GraphEdge): boolean {
  return NODE_TYPES.includes(edge.from_type) && NODE_TYPES.includes(edge.to_type) && edge.from_id.length >= 1 && edge.from_id.length <= 300
    && edge.to_id.length >= 1 && edge.to_id.length <= 300 && RELATION.test(edge.relation) && edge.source.length >= 1 && edge.source.length <= 120
    && Number.isFinite(Date.parse(edge.observed_at)) && (edge.payload === null || (typeof edge.payload === 'object' && !Array.isArray(edge.payload)));
}

function edge(from: [NodeType, string | null], to: [NodeType, string | null], relation: string, source: string, observedAt: string, payload: Record<string, unknown> | null = null): GraphEdge | null {
  if (!from[1] || !to[1]) return null;
  const built: GraphEdge = { from_type: from[0], from_id: from[1], to_type: to[0], to_id: to[1], relation, source, observed_at: observedAt, payload };
  return isValidEdge(built) ? built : null;
}
const compact = (edges: Array<GraphEdge | null>): GraphEdge[] => edges.filter((item): item is GraphEdge => item !== null);

export interface RegisterGraphRow {
  source: string; source_row_id: string; first_name: string | null; last_name: string | null; company: string | null;
  title_code: string | null; business_type: string | null; license_issue_date: string | null; state: string | null; zip: string | null; phone10: string | null;
  npi?: string | null; sos_entity_id?: string | null;
}
// A register name row: the person holds the licence, the licence is attached to the business, and the
// phone the register printed belongs to the person (or to the business when no person is named).
export function edgesFromRegisterRow(row: RegisterGraphRow, observedAt = new Date().toISOString()): GraphEdge[] {
  const person = personId(row.first_name, row.last_name);
  const license = licenseId(row.source, row.source_row_id);
  const business = row.company ? businessId(row.company, row.state, row.zip) : null;
  const phone = row.phone10 ? phoneId(row.phone10) : null;
  const meta = { title_code: row.title_code, business_type: row.business_type, license_issue_date: row.license_issue_date, state: row.state };
  return compact([
    edge(['person', person], ['license', license], 'holds_license', row.source, observedAt, meta),
    edge(['license', license], ['business', business], 'licenses_business', row.source, observedAt, meta),
    edge(['person', person], ['phone', phone], 'register_phone', row.source, observedAt, { title_code: row.title_code }),
    person ? null : edge(['business', business], ['phone', phone], 'register_phone', row.source, observedAt, null),
    edge(['person', person], ['npi', row.npi ?? null], 'has_npi', row.source, observedAt, null),
    edge(['business', business], ['sos_entity', row.sos_entity_id ?? null], 'registered_as', row.source, observedAt, null),
  ]);
}

export interface MapsGraphRow { place_id: string | null; name: string; state: string | null; zip: string | null; phone10: string | null; website?: string | null; reviews?: number | null; rating?: number | null }
// A Maps place: the listing advertises a phone, and the business appears at the place.
export function edgesFromMapsRow(row: MapsGraphRow, observedAt = new Date().toISOString()): GraphEdge[] {
  const business = businessId(row.name, row.state, row.zip);
  const phone = row.phone10 ? phoneId(row.phone10) : null;
  const meta = { website: row.website ?? null, reviews: row.reviews ?? null, rating: row.rating ?? null };
  return compact([
    edge(['place', row.place_id], ['phone', phone], 'maps_phone', 'google_maps', observedAt, meta),
    edge(['business', business], ['place', row.place_id], 'listed_at', 'google_maps', observedAt, null),
    row.place_id ? null : edge(['business', business], ['phone', phone], 'maps_phone', 'google_maps', observedAt, meta),
  ]);
}

export interface BucketMatchInput {
  register: Pick<RegisterGraphRow, 'source' | 'source_row_id' | 'first_name' | 'last_name' | 'company' | 'state' | 'zip' | 'phone10'>;
  place_id: string | null; maps_name: string; maps_phone10: string | null; bucket: 1 | 2 | 3; nameScore: number; addressScore: number;
}
// A bucket assignment: the licensee is tied to the Maps business, with the contrast recorded on the edge
// (register_eq_maps for bucket 3, phones_differ for bucket 2). Bucket 1 has no place to attach.
export function edgesFromBucketMatch(input: BucketMatchInput, observedAt = new Date().toISOString()): GraphEdge[] {
  if (input.bucket === 1) return [];
  const person = personId(input.register.first_name, input.register.last_name);
  const business = businessId(input.maps_name, input.register.state, input.register.zip);
  const relation = input.bucket === 3 ? 'owns_business_register_eq_maps' : 'owns_business_phones_differ';
  const payload = { bucket: input.bucket, name_score: input.nameScore, address_score: input.addressScore, register_phone: input.register.phone10, maps_phone: input.maps_phone10, license: licenseId(input.register.source, input.register.source_row_id) };
  return compact([
    edge(['person', person], ['business', business], relation, 'bucket', observedAt, payload),
    person ? null : edge(['license', licenseId(input.register.source, input.register.source_row_id)], ['business', business], relation, 'bucket', observedAt, payload),
    edge(['business', business], ['place', input.place_id], 'listed_at', 'bucket', observedAt, null),
    input.bucket === 3 ? edge(['phone', input.register.phone10 ? phoneId(input.register.phone10) : null], ['place', input.place_id], 'same_phone_as_listing', 'bucket', observedAt, null) : null,
  ]);
}

export interface VerificationInput { phone10: string; vendor: string; line_type: string | null; carrier?: string | null; caller_type?: string | null; dnc?: boolean | null; verified_at: string }
// A verification: the phone observed with its line type at that moment (a self edge; the payload is the
// observation). Line type changes over time are exactly what the history is for.
export function edgesFromVerification(input: VerificationInput): GraphEdge[] {
  const phone = phoneId(input.phone10);
  return compact([edge(['phone', phone], ['phone', phone], 'verified_line_type', input.vendor, input.verified_at, { line_type: input.line_type, carrier: input.carrier ?? null, caller_type: input.caller_type ?? null, dnc: input.dnc ?? null })]);
}

export interface DeliveryInput { phone10: string; ledger_id: string; batch_id: string; recipe: string; bucket: number | null; source_register: string; source_row_id: string | null; place_id: string | null; owner_first?: string | null; owner_last?: string | null; business_name?: string | null; state: string | null; zip?: string | null; delivered_at: string }
// A delivery: the phone was handed to a caller as this business's (and, when named, this person's) line.
export function edgesFromDelivery(input: DeliveryInput): GraphEdge[] {
  const phone = phoneId(input.phone10);
  const person = personId(input.owner_first ?? null, input.owner_last ?? null);
  const business = input.business_name ? businessId(input.business_name, input.state, input.zip ?? null) : null;
  const payload = { ledger_id: input.ledger_id, batch_id: input.batch_id, recipe: input.recipe, bucket: input.bucket };
  return compact([
    edge(['phone', phone], ['business', business], 'delivered_for_business', 'delivery', input.delivered_at, payload),
    edge(['phone', phone], ['person', person], 'delivered_as_owner_line', 'delivery', input.delivered_at, payload),
    input.source_row_id ? edge(['phone', phone], ['license', licenseId(input.source_register, input.source_row_id)], 'delivered_from_register', 'delivery', input.delivered_at, payload) : null,
    edge(['phone', phone], ['place', input.place_id], 'delivered_from_listing', 'delivery', input.delivered_at, payload),
  ]);
}

// The neighborhood a caller wants to see for one phone: grouped by node type, edges kept for evidence.
export interface PhoneNeighborhood { phone10: string; persons: string[]; businesses: string[]; licenses: string[]; places: string[]; npis: string[]; sos_entities: string[]; edges: GraphEdge[] }
export function neighborhoodFromEdges(phone10: string, edges: readonly GraphEdge[]): PhoneNeighborhood {
  const sets: Record<Exclude<NodeType, 'phone' | 'permit'>, Set<string>> = { person: new Set(), business: new Set(), license: new Set(), place: new Set(), npi: new Set(), sos_entity: new Set() };
  for (const item of edges) for (const [type, id] of [[item.from_type, item.from_id], [item.to_type, item.to_id]] as Array<[NodeType, string]>) {
    if (type !== 'phone' && type !== 'permit') sets[type].add(id);
  }
  const sorted = (set: Set<string>) => [...set].sort();
  return { phone10, persons: sorted(sets.person), businesses: sorted(sets.business), licenses: sorted(sets.license), places: sorted(sets.place), npis: sorted(sets.npi), sos_entities: sorted(sets.sos_entity), edges: [...edges] };
}
