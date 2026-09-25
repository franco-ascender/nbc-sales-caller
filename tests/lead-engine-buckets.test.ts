import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignBuckets, normalizeName, normalizeAddress, tokenSortRatio, scorePair, NAME_THRESHOLD, NAME_BAND_LOW, ADDRESS_THRESHOLD } from '../src/lib/lead-engine-buckets.ts';
import type { RegisterRow, MapsRow } from '../src/lib/lead-engine-buckets.ts';
import { isChain, chainGroupsFor, brandGroupCounts } from '../src/lib/lead-engine-brands.ts';

const register = (patch: Partial<RegisterRow> & { id: string }): RegisterRow => ({ name: 'Acme Roofing LLC', ownerName: 'Jane Acme', street: '123 Main Street Suite 4', city: 'Tampa', zip: '33602', phone10: '8135550101', ...patch });
const maps = (patch: Partial<MapsRow> & { id: string }): MapsRow => ({ name: 'Acme Roofing', street: '123 Main St #4', city: 'Tampa', zip: '33602', phone10: '8135550101', placeId: 'ChIJ-acme', ...patch });

test('normalization strips corporate suffixes and punctuation and sorts tokens; addresses abbreviate street words and drop units', () => {
  assert.equal(normalizeName('ACME Roofing, LLC.'), normalizeName('Acme Roofing'));
  assert.equal(normalizeName("Bob's Plumbing Inc"), 'bobs plumbing');
  assert.equal(normalizeName('Roofing Acme'), normalizeName('Acme Roofing'));
  assert.equal(normalizeAddress('123 Main Street Suite 4', '33602'), normalizeAddress('123 Main St #4', '33602-1234'));
  assert.equal(normalizeAddress('456 N Dale Mabry Highway', '33609'), '456 dale hwy mabry n 33609');
  assert.equal(normalizeName('A.C.M.E. Roofing, L.L.C.'), 'acme roofing');
  assert.equal(normalizeName('J & R Plumbing'), normalizeName('J and R Plumbing'));
});

test('token sort ratio: identical is 1, disjoint is near 0, word order does not matter', () => {
  assert.equal(tokenSortRatio('acme roofing', 'roofing acme'), 1);
  assert.ok(tokenSortRatio('acme roofing', 'zzz qqq') < 0.3);
  assert.ok(tokenSortRatio('acme roofing', 'acme roofing and siding') > 0.65);
});

test('vectors: exact, punctuation, LLC/Inc stripped and address variants all match; near miss lands in the band; address mismatch does not match', () => {
  const exact = scorePair(register({ id: 'r1', name: 'Acme Roofing', phone10: null }), maps({ id: 'm1', phone10: '8135559999' }));
  assert.equal(exact.nameScore, 1); assert.ok(exact.addressScore >= ADDRESS_THRESHOLD); assert.equal(exact.matched, true);
  const punctuation = scorePair(register({ id: 'r2', name: 'A.C.M.E. Roofing, L.L.C.', phone10: null }), maps({ id: 'm2', name: 'ACME Roofing', phone10: '8135559999' }));
  assert.equal(punctuation.matched, true, `punctuation ${punctuation.nameScore}`);
  const suffix = scorePair(register({ id: 'r3', name: 'Bay Area Cooling Inc', phone10: null }), maps({ id: 'm3', name: 'Bay Area Cooling LLC', phone10: '8135559999' }));
  assert.equal(suffix.nameScore, 1); assert.equal(suffix.matched, true);
  // Near miss: one word differs, so the name lands between 0.80 and 0.87 and is logged, not matched.
  const near = scorePair(register({ id: 'r4', name: 'Sunshine State Roofing Company', phone10: null }), maps({ id: 'm4', name: 'Sunshine State Roofers', phone10: '8135559999' }));
  assert.ok(near.nameScore >= NAME_BAND_LOW && near.nameScore < NAME_THRESHOLD, `band ${near.nameScore}`);
  assert.equal(near.matched, false); assert.equal(near.band, true);
  // Same name, different street: no match (and not a band entry, the address failed).
  const elsewhere = scorePair(register({ id: 'r5', name: 'Acme Roofing', street: '900 Oak Avenue', zip: '33602', phone10: null }), maps({ id: 'm5', phone10: '8135559999' }));
  assert.equal(elsewhere.nameScore, 1); assert.ok(elsewhere.addressScore < ADDRESS_THRESHOLD); assert.equal(elsewhere.matched, false); assert.equal(elsewhere.band, false);
  // The same ten digits on both sides is a match whatever the spelling.
  const phone = scorePair(register({ id: 'r6', name: 'J Acme Enterprises', street: null, zip: null }), maps({ id: 'm6', name: 'Acme Roofing' }));
  assert.equal(phone.phoneEqual, true); assert.equal(phone.matched, true);
});

test('buckets: 1 register only, 2 phones differ, 3 phones equal (register_eq_maps), 4 Maps only, band counted, each Maps row consumed once', () => {
  const registerRows: RegisterRow[] = [
    register({ id: 'invisible', name: 'Ghost Roofing', street: '1 Nowhere Ln', zip: '33610', phone10: '8135550001' }),
    register({ id: 'direct', name: 'Acme Roofing', phone10: '8135550002' }),
    register({ id: 'business', name: 'Bay Cooling', street: '77 Bay St', zip: '33605', phone10: '8135550003' }),
    register({ id: 'band', name: 'Sunshine State Roofing Company', street: '5 Sun Ct', zip: '33611', phone10: '8135550004' }),
  ];
  const mapsRows: MapsRow[] = [
    maps({ id: 'acme', name: 'Acme Roofing LLC', phone10: '8135551111' }),
    maps({ id: 'bay', name: 'Bay Cooling Inc', street: '77 Bay Street', zip: '33605', phone10: '8135550003', placeId: 'ChIJ-bay' }),
    maps({ id: 'sun', name: 'Sunshine State Roofers', street: '5 Sun Court', zip: '33611', phone10: '8135552222', placeId: 'ChIJ-sun' }),
    maps({ id: 'other', name: 'Other Roofers', street: '9 Elm St', zip: '33602', phone10: '8135553333', placeId: 'ChIJ-other' }),
  ];
  const result = assignBuckets(registerRows, mapsRows);
  const byId = new Map(result.register.map(item => [item.registerId, item]));
  assert.equal(byId.get('invisible')?.bucket, 1); assert.equal(byId.get('invisible')?.placeId, null);
  assert.equal(byId.get('direct')?.bucket, 2); assert.equal(byId.get('direct')?.mapsPhone, '8135551111'); assert.equal(byId.get('direct')?.placeId, 'ChIJ-acme'); assert.equal(byId.get('direct')?.evidence, 'none');
  assert.equal(byId.get('business')?.bucket, 3); assert.equal(byId.get('business')?.evidence, 'register_eq_maps');
  assert.equal(byId.get('band')?.bucket, 1);
  assert.deepEqual(result.mapsOnly.sort(), ['other', 'sun']);
  assert.deepEqual(result.matchedMaps.sort(), ['acme', 'bay']);
  assert.deepEqual(result.counts, { bucket1: 2, bucket2: 1, bucket3: 1, bucket4: 2, band: 1 });
});

test('a register row without a phone that matches Maps is bucket 3 (nothing to contrast); two register rows never share one Maps place', () => {
  const result = assignBuckets(
    [register({ id: 'a', phone10: null }), register({ id: 'b', phone10: '8135550009' })],
    [maps({ id: 'm', phone10: '8135550009' })],
  );
  const byId = new Map(result.register.map(item => [item.registerId, item]));
  // The phone-equal pair wins the place; the phoneless twin is then register only.
  assert.equal(byId.get('b')?.bucket, 3); assert.equal(byId.get('a')?.bucket, 1);
  assert.equal(result.mapsOnly.length, 0);
  const alone = assignBuckets([register({ id: 'a', phone10: null })], [maps({ id: 'm', phone10: '8135550009' })]);
  assert.equal(alone.register[0].bucket, 3); assert.equal(alone.register[0].evidence, 'none');
});

test('chain filter: OSM brands and research franchise lists drop by industry group; independents and off-group brands survive', () => {
  const counts = brandGroupCounts();
  assert.ok(counts.auto > 150 && counts.food > 500, JSON.stringify(counts));
  assert.equal(isChain('Meineke Car Care Center', 'auto_repair'), 'meineke');
  assert.equal(isChain("McDonald's", 'restaurant_tx'), 'mcdonalds');
  assert.equal(isChain('Roto-Rooter Plumbing of Charlotte', 'plumbing'), 'roto rooter');
  assert.equal(isChain('Molly Maid of West Tampa', 'hvac'), 'molly maid');
  assert.equal(isChain('1-800-GOT-JUNK? Tampa', 'movers_tree_haulers'), '1 800 got junk');
  assert.equal(isChain('Ideal Image Tampa', 'med_spa'), 'ideal image');
  assert.equal(isChain('Planet Fitness', 'healthcare_ao_contrast'), 'planet fitness');
  assert.equal(isChain('Bob Smith Plumbing', 'plumbing'), null);
  assert.equal(isChain('Alpine Roofing', 'roofing'), null);
  // A food chain name never removes a roofer: the food group does not apply to trades.
  assert.equal(isChain('Subway Roofing Co', 'roofing'), null);
  assert.deepEqual(chainGroupsFor('auto_body'), ['auto']);
  // Without an industry every group applies but only distinctive tokens count.
  assert.equal(isChain('Two Men and a Truck Orlando'), 'two men and a truck');
  assert.equal(isChain('Ford Plumbing'), null);
});
