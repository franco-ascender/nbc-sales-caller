import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseClinician, matchClinicianToSpa, clinicianContact, suiteOf, rolesOf, directorCounts, directorOnlyContacts, directorKey, parseTnRegistryText, tnDirectorCounts, tnRegistrySummary, medSpaFranchise, registeredAgentService, resolveMedSpaOwner } from '../src/lib/lead-engine-medspa.ts';
import type { Clinician } from '../src/lib/lead-engine-medspa.ts';
import { createNpiRoster, parseTxPirHtml, createTxComptrollerAdapter, resolveMedSpaOwnerLive, NPPES_LIMIT } from '../src/services/lead-engine-medspa.service.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/lead-engine/nppes-npi1-33609.json', import.meta.url), 'utf8')) as { results: unknown[]; counts: Record<string, { result_count: number }> };
const registry = JSON.parse(readFileSync(new URL('./fixtures/lead-engine/tn-medspa-registry-sample.json', import.meta.url), 'utf8')) as { rows: Array<{ facility: string; address: string | null; directors: string[] }> };
const clinicians = fixture.results.map(parseClinician).filter((c): c is Clinician => c !== null);

test('nppes npi-1 fixture (Tampa 33609, live 2026-09-21): rows parse with roles, licenses, location and mailing', () => {
  assert.equal(clinicians.length, fixture.results.length);
  assert.equal(fixture.counts['Nurse Practitioner'].result_count, 167); assert.equal(fixture.counts['Physician Assistant'].result_count, 56); assert.equal(fixture.counts['Registered Nurse'].result_count, 3);
  const np = clinicians.find(c => c.npi === '1710847587'); assert.ok(np);
  assert.deepEqual(np.roles, ['NP']); assert.equal(np.location.zip, '33609'); assert.equal(np.location.phone10, '8138767073'); assert.equal(np.mailing?.phone10, '8136192222');
  assert.deepEqual(np.licenses[0], { number: 'APRN1104376', state: 'FL' });
  const contact = clinicianContact(np);
  assert.equal(contact.mailing, 'residential_candidate'); assert.equal(contact.mailingPhoneDiffers, true); assert.equal(contact.mailingPhone10, '8136192222');
  const sole = clinicians.find(c => c.soleProprietor === true); assert.ok(sole, 'the fixture carries a sole_proprietor YES row (Watt Plastic Surgery & Medspa PA)');
  assert.deepEqual(rolesOf(['363LP0808X', '163WG0000X', '207Q00000X']), ['NP', 'RN']);
  assert.equal(parseClinician({ number: '123', basic: {} }), null); assert.equal(parseClinician({ number: '1234567890', enumeration_type: 'NPI-2', basic: { first_name: 'a', last_name: 'b' }, addresses: [] }), null);
});

test('address roster match: street plus zip at threshold, suite compared separately', () => {
  const spa = { street: '2605 W Swann Ave Ste 600', zip: '33609' };
  const hits = clinicians.map(c => matchClinicianToSpa(spa, c)).filter(m => m.matched);
  assert.ok(hits.length >= 2, `${hits.length} clinicians at 2605 W Swann Ave Ste 600`);
  assert.ok(hits.every(m => m.suite === 'match' || m.suite === 'unknown'));
  const other = clinicians.map(c => matchClinicianToSpa({ street: '2605 W Swann Ave Ste 100', zip: '33609' }, c)).filter(m => m.matched);
  assert.deepEqual(other.map(m => [m.clinician.npi, m.suite]), [['1407501752', 'match']], 'same building, different suite: only the Ste 100 clinician, the two Ste 600 rows differ');
  const swann600 = clinicians.find(c => c.npi === '1710847587'); assert.ok(swann600);
  assert.equal(matchClinicianToSpa({ street: '2615 W Swann Ave Ste 600', zip: '33609' }, swann600).matched, false, 'house number exact: 2615 never matches a 2605 row however close the rest is');
  assert.equal(matchClinicianToSpa({ street: '2605 West Swann Avenue, Suite 600', zip: '33609-4044' }, swann600).matched, true, 'spelling and zip+4 do not matter');
  assert.equal(clinicians.map(c => matchClinicianToSpa({ street: '2605 W Swann Ave', zip: '33602' }, c)).filter(m => m.matched).length, 0, 'zip must match');
  assert.equal(suiteOf('4830 W KENNEDY BLVD STE 600', null), '600'); assert.equal(suiteOf('123 Main St #4B', null), '4b'); assert.equal(suiteOf('123 Main St', 'Suite 12'), '12'); assert.equal(suiteOf('123 Main St', null), null);
});

test('medical director graph: TN registry text parses; directors on 3 or more spas are director_only_contact', () => {
  const counts = directorCounts(registry.rows);
  assert.equal(counts.get('james wendel'), 2, 'Wendel supervises Salon J and Skin MB in the sample');
  assert.equal(directorKey('Thomas Klinner Jr., MD'), 'thomas klinner'); assert.equal(directorKey('Volker G Winkler'), 'volker winkler');
  const shipped = tnDirectorCounts();
  const summary = tnRegistrySummary();
  assert.equal(summary.rows, 588); assert.equal(summary.distinctDirectors, 622); assert.equal(summary.directorOnly, 46);
  assert.ok((shipped.get('brian biesman') ?? 0) >= 3); assert.ok(directorOnlyContacts(shipped).has('brian biesman'));
  assert.equal(directorOnlyContacts(new Map([['a b', 2], ['c d', 3]])).has('a b'), false);
  const parsed = parseTnRegistryText('Header\n6 1/1/2016 3/31/2017 Salon J & Day Spa 315 Deaderick St., Nashville, TN  37238 James J Wendel, MD 36486 MD Plastic Surgery\n13 1/1/2016 3/31/2017 New Age Skin Care Spa & Salon 62 Hospital Dr., McKenzie, TN  38201\nVolker G Winkler, MD     \nBryan Hale Merrick, MD\n11366');
  assert.equal(parsed.length, 2); assert.deepEqual(parsed[0].directors, ['James J Wendel']); assert.equal(parsed[0].address, '315 Deaderick St., Nashville, TN  37238'); assert.deepEqual(parsed[1].directors, ['Volker G Winkler', 'Bryan Hale Merrick']);
});

test('blocklists: franchise and telehealth spas drop; registered agent services are never owners; independents pass', () => {
  assert.equal(medSpaFranchise('Ideal Image Tampa'), 'ideal image'); assert.equal(medSpaFranchise('Milan Laser Hair Removal'), 'milan laser'); assert.match(medSpaFranchise('Prime IV Hydration & Wellness') ?? '', /^prime iv/);
  assert.equal(medSpaFranchise('The DRIPBaR Westchase'), 'the dripbar'); assert.equal(medSpaFranchise('LaserAway'), 'laseraway'); assert.equal(medSpaFranchise('Sono Bello Body Contouring'), 'sono bello'); assert.equal(medSpaFranchise('Restore Hyper Wellness'), 'restore hyper wellness');
  assert.equal(medSpaFranchise('Henry Meds'), 'henry meds', 'GLP-1 telehealth');
  assert.equal(medSpaFranchise('Swann Avenue Aesthetics'), null); assert.equal(medSpaFranchise('Restore Skin Studio'), null, 'a short generic token alone never drops a row');
  assert.equal(registeredAgentService('Northwest Registered Agent LLC'), 'northwest registered agent'); assert.match(registeredAgentService('CT Corporation System') ?? '', /^ct corporation/); assert.match(registeredAgentService('LegalZoom.com, Inc.') ?? '', /^legalzoom/);
  assert.match(registeredAgentService('ZenBusiness Inc') ?? '', /^zenbusiness/); assert.equal(registeredAgentService('InCorp Services, Inc.'), 'incorp services'); assert.equal(registeredAgentService('Registered Agents Inc'), 'registered agents inc');
  assert.equal(registeredAgentService('Jane Acme'), null);
});

test('resolveMedSpaOwner: (d) block, (a) roster candidates with evidence, (b) Texas officers, (c) director_only never wins', () => {
  const blocked = resolveMedSpaOwner({ id: 's0', name: 'Ideal Image Tampa', street: '2605 W Swann Ave Ste 600', zip: '33609', state: 'FL', phone10: null }, { clinicians, txOfficers: null });
  assert.equal(blocked.status, 'blocked_franchise'); assert.equal(blocked.blockedBy, 'ideal image'); assert.deepEqual(blocked.candidates, []);
  const spa = resolveMedSpaOwner({ id: 's1', name: 'Swann Avenue Aesthetics', street: '2605 W Swann Ave Ste 600', zip: '33609', state: 'FL', phone10: '8138767073' }, { clinicians, txOfficers: null });
  assert.equal(spa.status, 'owner_candidate'); assert.ok(spa.candidates.length >= 2); assert.ok(spa.candidates.every(c => c.source === 'nppes_npi1' && c.npi && c.license));
  assert.ok(spa.evidence.some(line => /NPI location phone equals the Maps phone/.test(line)));
  const withMailing = spa.candidates.find(c => c.name === 'MARIA TERESA AGUILAR'); assert.ok(withMailing); assert.equal(withMailing.residentialMailing, true); assert.equal(withMailing.phone10, '8136192222');
  assert.ok(spa.candidates[0].confidence >= spa.candidates[spa.candidates.length - 1].confidence);
  const tx = resolveMedSpaOwner({ id: 's2', name: 'Serenity Creek Med Spa', street: '1 Nowhere Rd', zip: '78701', state: 'TX', phone10: null }, { clinicians: [], txOfficers: [
    { name: 'Northwest Registered Agent LLC', title: 'Registered Agent', address: null }, { name: 'Brian Biesman', title: 'Director', address: null }, { name: 'Ana Lopez', title: 'Managing Member', address: 'Austin TX' }, { name: 'Sam Clerk', title: 'Bookkeeper', address: null }] });
  assert.equal(tx.status, 'owner_candidate'); assert.equal(tx.candidates[0].name, 'Ana Lopez'); assert.equal(tx.candidates[0].confidence, 0.7);
  const director = tx.candidates.find(c => c.name === 'Brian Biesman'); assert.ok(director); assert.equal(director.directorOnly, true); assert.equal(director.confidence, 0.2);
  assert.ok(tx.evidence.some(line => /registered agent service/.test(line)));
  const onlyDirector = resolveMedSpaOwner({ id: 's3', name: 'Spa X', street: '1 Nowhere Rd', zip: '78701', state: 'TX', phone10: null }, { clinicians: [], txOfficers: [{ name: 'Brian Biesman', title: 'President', address: null }] });
  assert.equal(onlyDirector.status, 'director_only');
  assert.equal(resolveMedSpaOwner({ id: 's4', name: 'Spa Y', street: '9 Elsewhere', zip: '33609', state: 'FL', phone10: null }, { clinicians, txOfficers: null }).status, 'unresolved');
});

test('npi roster service: three taxonomy queries per zip, pagination honours the 1,200 row ceiling and reports truncation', async () => {
  const urls: string[] = [];
  const page = (count: number) => Array.from({ length: count }, (_, i) => ({ number: String(1000000000 + i + urls.length * 1000), enumeration_type: 'NPI-1', basic: { first_name: 'A', last_name: `B${i}` }, addresses: [{ address_purpose: 'LOCATION', address_1: '1 Main St', postal_code: '336090000', state: 'FL' }], taxonomies: [{ code: '363L00000X' }] }));
  const request: typeof fetch = async input => {
    const url = new URL(String(input)); urls.push(url.toString());
    const tax = url.searchParams.get('taxonomy_description'), skip = Number(url.searchParams.get('skip'));
    assert.equal(url.searchParams.get('enumeration_type'), 'NPI-1'); assert.equal(url.searchParams.get('address_purpose'), 'LOCATION'); assert.equal(url.searchParams.get('limit'), String(NPPES_LIMIT));
    const rows = tax === 'Nurse Practitioner' ? page(NPPES_LIMIT) : tax === 'Physician Assistant' ? (skip === 0 ? page(NPPES_LIMIT) : page(5)) : page(2);
    return new Response(JSON.stringify({ result_count: rows.length, results: rows }), { headers: { 'content-type': 'application/json' } });
  };
  const roster = await createNpiRoster(request).zip('33609');
  assert.equal(roster.perRole.NP.truncated, true, 'always a full page: stopped at skip 1000');
  assert.equal(urls.filter(url => url.includes('Nurse+Practitioner')).length, 6, 'skip 0,200,...,1000');
  assert.equal(roster.perRole.PA.truncated, false); assert.equal(roster.perRole.PA.fetched, 205); assert.equal(roster.perRole.RN.fetched, 2);
  await assert.rejects(createNpiRoster(request).role('3360', 'NP'), /five digit zip/);
  await assert.rejects(createNpiRoster(async () => new Response('oops', { status: 500 })).role('33609', 'NP'), /NPPES registry could not be read/);
});

test('tx comptroller adapter: UNVERIFIED, parses a REPORTED officers table from a fixture and never claims more', async () => {
  const html = '<table><tr><th>Name</th><th>Title</th><th>Address</th></tr><tr><td>ANA LOPEZ</td><td>MANAGING MEMBER</td><td>AUSTIN, TX</td></tr><tr><td>NORTHWEST REGISTERED AGENT LLC</td><td>REGISTERED AGENT</td><td></td></tr></table>';
  assert.deepEqual(parseTxPirHtml(html), [{ name: 'ANA LOPEZ', title: 'MANAGING MEMBER', address: 'AUSTIN, TX' }, { name: 'NORTHWEST REGISTERED AGENT LLC', title: 'REGISTERED AGENT', address: '' }]);
  const adapter = createTxComptrollerAdapter(async () => new Response(html, { headers: { 'content-type': 'text/html' } }));
  const result = await adapter.officers('Serenity Creek Med Spa');
  assert.equal(result.verified, false); assert.equal(result.officers.length, 2); assert.match(result.note, /REPORTED, not verified/);
  const down = await createTxComptrollerAdapter(async () => new Response('', { status: 503 })).officers('X');
  assert.equal(down.officers.length, 0); assert.match(down.note, /HTTP 503/);
  const live = await resolveMedSpaOwnerLive({ id: 'l1', name: 'Swann Avenue Aesthetics', street: '2605 W Swann Ave Ste 600', zip: '33609', state: 'FL', phone10: null }, async () => new Response(JSON.stringify({ result_count: fixture.results.length, results: fixture.results }), { headers: { 'content-type': 'application/json' } }));
  assert.equal(live.status, 'owner_candidate'); assert.equal(live.txNote, null); assert.ok(live.roster && live.roster.NP.fetched > 0);
});
