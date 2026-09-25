import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNppesDiscoveryProvider } from '../src/services/lead-engine-nppes.ts';

const query = { taxonomyDescription: 'Chiropractor', state: 'NC', limit: 3, skip: 0 };

// Shape captured from a live GET to npiregistry.cms.hhs.gov on 2026-09-17 (see artifacts/lanes/L03/nppes-live-check.json).
const liveRow = {
  addresses: [
    { address_1: '2728 W MALLARD CREEK CHURCH RD STE 330', address_purpose: 'MAILING', city: 'CHARLOTTE', state: 'NC', postal_code: '282622309', telephone_number: '980-585-4005' },
    { address_1: '2728 W MALLARD CREEK CHURCH RD STE 330', address_purpose: 'LOCATION', city: 'CHARLOTTE', state: 'NC', postal_code: '282622309', telephone_number: '980-585-4005' },
  ],
  basic: {
    authorized_official_first_name: 'STEVE', authorized_official_last_name: 'NUTTY', authorized_official_title_or_position: 'Owner',
    authorized_official_telephone_number: '3155258770', organization_name: '100 CHIRO CHARLOTTE LLC', status: 'A',
  },
  enumeration_type: 'NPI-2', number: '1386352672',
  taxonomies: [{ code: '111N00000X', desc: 'Chiropractor', primary: true }],
};

test('search calls the free, keyless NPPES endpoint with the documented params', async () => {
  const calls: URL[] = [];
  const provider = createNppesDiscoveryProvider(async input => { calls.push(new URL(String(input))); return Response.json({ result_count: 1, results: [liveRow] }); });
  const page = await provider.search(query);
  assert.equal(calls.length, 1);
  const url = calls[0];
  assert.equal(url.origin, 'https://npiregistry.cms.hhs.gov'); assert.equal(url.pathname, '/api/');
  assert.equal(url.searchParams.get('version'), '2.1'); assert.equal(url.searchParams.get('taxonomy_description'), 'Chiropractor');
  assert.equal(url.searchParams.get('state'), 'NC'); assert.equal(url.searchParams.get('limit'), '3'); assert.equal(url.searchParams.get('skip'), '0');
  assert.equal(url.searchParams.get('enumeration_type'), 'NPI-2');
  assert.equal(page.resultCount, 1); assert.equal(page.rows.length, 1);
});

test('parses the live shape: organization, authorized official, location, taxonomy and the AO/front-desk mismatch signal', async () => {
  const provider = createNppesDiscoveryProvider(async () => Response.json({ result_count: 1, results: [liveRow] }));
  const [row] = (await provider.search(query)).rows;
  assert.deepEqual(row, {
    npi: '1386352672', organizationName: '100 CHIRO CHARLOTTE LLC', soleProprietor: null, status: 'A',
    authorizedOfficialFirstName: 'STEVE', authorizedOfficialLastName: 'NUTTY', authorizedOfficialTitle: 'Owner',
    authorizedOfficialPhone10: '3155258770', locationPhone10: '9805854005',
    street: '2728 W MALLARD CREEK CHURCH RD STE 330', city: 'CHARLOTTE', state: 'NC', postalCode: '282622309',
    taxonomyCode: '111N00000X', taxonomyDescription: 'Chiropractor', ownerPhoneDiffersFromFrontDesk: true,
  });
});

test('matching AO and location phone report no mismatch, and a missing NPI/basic record fails closed', async () => {
  const matched = { ...liveRow, basic: { ...liveRow.basic, authorized_official_telephone_number: '9805854005' } };
  const provider = createNppesDiscoveryProvider(async () => Response.json({ result_count: 1, results: [matched] }));
  assert.equal((await provider.search(query)).rows[0].ownerPhoneDiffersFromFrontDesk, false);
  const broken = createNppesDiscoveryProvider(async () => Response.json({ result_count: 1, results: [{ ...liveRow, number: 'not-an-npi' }] }));
  await assert.rejects(broken.search(query));
});

test('rejects an invalid state, empty/oversized taxonomy text, control characters and out-of-range paging', async () => {
  const provider = createNppesDiscoveryProvider(async () => Response.json({ result_count: 0, results: [] }));
  for (const change of [{ state: 'ZZ' }, { taxonomyDescription: '' }, { taxonomyDescription: 'a\nb' }, { taxonomyDescription: 'x'.repeat(101) }, { limit: 0 }, { limit: 201 }, { skip: -1 }]) {
    await assert.rejects(provider.search({ ...query, ...change }));
  }
});

test('fails closed on non-OK, malformed, oversized or overflowing responses', async () => {
  const bad = [new Response('private', { status: 500 }), new Response('{'), new Response('x'.repeat(2097153)),
    Response.json({ result_count: 1, results: [liveRow, liveRow, liveRow, liveRow] })];
  for (const response of bad) {
    let count = 0;
    const provider = createNppesDiscoveryProvider(async () => { count++; return response; });
    await assert.rejects(provider.search({ ...query, limit: 3 }), error => error instanceof Error && !error.message.includes('private'));
    assert.equal(count, 1);
  }
});
