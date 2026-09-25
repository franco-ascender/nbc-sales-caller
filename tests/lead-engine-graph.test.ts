import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgesFromRegisterRow, edgesFromMapsRow, edgesFromBucketMatch, edgesFromVerification, edgesFromDelivery, isValidEdge, personId, businessId, neighborhoodFromEdges, NODE_TYPES } from '../src/lib/lead-engine-graph.ts';
import { writeEdges, phoneNeighborhood } from '../src/services/lead-engine-graph.service.ts';
import type { GraphEdge } from '../src/lib/lead-engine-graph.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const at = '2026-09-21T12:00:00.000Z';
const register = { source: 'fl_dbpr', source_row_id: 'CGC123', first_name: 'Jane', last_name: 'Acme', company: 'Acme Roofing LLC', title_code: 'owner', business_type: 'llc', license_issue_date: '2015-01-01', state: 'FL', zip: '33602', phone10: '8135550101', npi: null, sos_entity_id: 'L15000001' };

test('graph: node types match migration 0230 and every built edge passes the table checks', () => {
  assert.deepEqual([...NODE_TYPES], ['person', 'business', 'license', 'phone', 'place', 'permit', 'sos_entity', 'npi']);
  const edges = [
    ...edgesFromRegisterRow(register, at),
    ...edgesFromMapsRow({ place_id: 'ChIJ-acme', name: 'Acme Roofing', state: 'FL', zip: '33602', phone10: '8135550199' }, at),
    ...edgesFromBucketMatch({ register, place_id: 'ChIJ-acme', maps_name: 'Acme Roofing', maps_phone10: '8135550199', bucket: 2, nameScore: 0.95, addressScore: 0.92 }, at),
    ...edgesFromVerification({ phone10: '8135550101', vendor: 'batchdata', line_type: 'Mobile', verified_at: at }),
    ...edgesFromDelivery({ phone10: '8135550101', ledger_id: 'l1', batch_id: 'b1', recipe: 'D', bucket: 2, source_register: 'fl_dbpr', source_row_id: 'CGC123', place_id: 'ChIJ-acme', owner_first: 'Jane', owner_last: 'Acme', business_name: 'Acme Roofing', state: 'FL', zip: '33602', delivered_at: at }),
  ];
  assert.ok(edges.length >= 12, `${edges.length} edges`);
  for (const edge of edges) { assert.ok(isValidEdge(edge), JSON.stringify(edge)); assert.match(edge.relation, /^[a-z_]{1,60}$/); assert.equal(edge.observed_at, at); }
  const relations = new Set(edges.map(edge => `${edge.from_type}>${edge.relation}>${edge.to_type}`));
  for (const expected of ['person>holds_license>license', 'license>licenses_business>business', 'person>register_phone>phone', 'business>registered_as>sos_entity', 'place>maps_phone>phone', 'business>listed_at>place', 'person>owns_business_phones_differ>business', 'phone>verified_line_type>phone', 'phone>delivered_as_owner_line>person', 'phone>delivered_from_register>license']) assert.ok(relations.has(expected), expected);
});

test('graph: ids are stable text keys; missing pieces drop the edge instead of throwing', () => {
  assert.equal(personId('José', 'Núñez'), 'jose nunez'); assert.equal(personId('J', null), null);
  assert.equal(businessId("Bob's Plumbing, Inc.", 'fl', '33602-1234'), 'bobs plumbing|FL|33602'); assert.equal(businessId('Acme Roofing LLC', 'FL', '33602'), businessId('Roofing Acme', 'FL', '33602'));
  const noPerson = edgesFromRegisterRow({ ...register, first_name: null, last_name: null }, at);
  assert.ok(noPerson.some(edge => edge.from_type === 'business' && edge.relation === 'register_phone'));
  assert.ok(!noPerson.some(edge => edge.from_type === 'person'));
  assert.deepEqual(edgesFromBucketMatch({ register, place_id: null, maps_name: 'x', maps_phone10: null, bucket: 1, nameScore: 0, addressScore: 0 }, at), []);
  assert.deepEqual(edgesFromVerification({ phone10: '1234', vendor: 'batchdata', line_type: 'Mobile', verified_at: at }), []);
  assert.ok(edgesFromBucketMatch({ register, place_id: 'ChIJ-acme', maps_name: 'Acme Roofing', maps_phone10: '8135550101', bucket: 3, nameScore: 0.9, addressScore: 0.9 }, at).some(edge => edge.relation === 'same_phone_as_listing'));
});

test('graph service: writeEdges upserts in chunks with the daily conflict key; the neighborhood groups nodes', async () => {
  const calls: Array<{ rows: unknown[]; options: Record<string, unknown> }> = [];
  const edges: GraphEdge[] = [...edgesFromRegisterRow(register, at), { from_type: 'person', from_id: 'x', to_type: 'phone', to_id: 'y', relation: 'BAD RELATION', source: 's', observed_at: at, payload: null }];
  const db = {
    from: (table: string) => ({ upsert: (rows: unknown[], options: Record<string, unknown>) => { assert.equal(table, 'lead_engine_entity_graph_edges'); calls.push({ rows, options }); return Promise.resolve({ error: null }); } }),
    rpc: (name: string, args: Record<string, unknown>) => { assert.equal(name, 'lead_engine_phone_neighborhood'); assert.equal(args.p_phone, '8135550101'); return Promise.resolve({ data: edges.slice(0, -1), error: null }); },
  } as unknown as SupabaseClient;
  const written = await writeEdges(db, edges);
  assert.equal(written.skippedInvalid, 1); assert.equal(written.attempted, edges.length - 1);
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].options, { onConflict: 'from_type,from_id,to_type,to_id,relation,source,observed_day', ignoreDuplicates: true });
  const hood = await phoneNeighborhood(db, '8135550101');
  assert.deepEqual(hood.persons, ['jane acme']); assert.deepEqual(hood.licenses, ['fl_dbpr:CGC123']); assert.deepEqual(hood.businesses, ['acme roofing|FL|33602']); assert.deepEqual(hood.sos_entities, ['L15000001']);
  await assert.rejects(phoneNeighborhood(db, '123'), /ten digit/);
  assert.deepEqual(neighborhoodFromEdges('8135550101', []).edges, []);
});
