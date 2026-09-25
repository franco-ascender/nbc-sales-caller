import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PARCEL_SOURCES, PARCEL_STATES, parcelSourceFor, streetOk, ownerMatches, resolveHome, homeStreetSource, registerCarriesHomeStreet, addressLine, sqlName, PARCEL_HIT_RATE, IL_ASSESSMENT_YEAR,
} from '../src/lib/lead-engine-parcel.ts';
import type { ParcelHit } from '../src/lib/lead-engine-parcel.ts';

function fixture(state: string): unknown { return (JSON.parse(readFileSync(new URL(`./fixtures/parcel/${state}.json`, import.meta.url), 'utf8')) as { body: unknown }).body; }
const hit = (owner: string, street = '12 Oak St', city = 'Tampa', zip = '33601'): ParcelHit => ({ owner, street, city, zip });

test('street_ok: number + street required; suite, unit, apartment, floor, PMB, # and PO box are never traced', () => {
  for (const good of ['7104 JEFFERSON ST', '12 Oak St', '16330 N STATE RD 121', '5716 NW 127TH TERRACE']) assert.equal(streetOk(good), true, good);
  for (const bad of ['', null, undefined, 'PO BOX 157', 'P.O. Box 474', '3123 HWY 83 SUITE A', '870 VILLAGE LAKE TERRACE UNIT 203', '19101 MYSTIC POINT DR #1101', '201 CRANDON BLVD APT 4', '500 MAIN ST FL 3', '1 PMB 22 BROAD', 'JEFFERSON ST', '  ']) assert.equal(streetOk(bad), false, String(bad));
});

test('owner matching: LAST FIRST, LAST, FIRST M, FIRST M LAST and couples match; a different first name or a substring does not', () => {
  assert.equal(ownerMatches('John', 'Smith', 'SMITH JOHN D'), true);
  assert.equal(ownerMatches('John', 'Smith', 'SMITH, JOHN J'), true);
  assert.equal(ownerMatches('John', 'Smith', 'SMITH JOHN GABRIEL & VANNA ASHLYN'), true);
  assert.equal(ownerMatches('John', 'Smith', 'JOHN & ADRIENNE SMITH'), false, "engine.py's FIRST ... LAST form allows letters and spaces between, not an ampersand (Cook County couples are skipped, as measured)");
  assert.equal(ownerMatches('John', 'Smith', 'JOHN M SMITH'), true);
  assert.equal(ownerMatches('John', 'Smith', 'SMITH JOHNNY R'), true, 'engine.py allows a longer first name (JOHNNY for JOHN); the uniqueness rule handles the rest');
  assert.equal(ownerMatches('John', 'Smith', 'SMITH ROBERT LEWIS'), false);
  assert.equal(ownerMatches('John', 'Smith', 'GOLDSMITH JOHN'), false, 'surname must be a whole word');
  assert.equal(ownerMatches('Ann', 'Lee', 'LEE ANNE MARIE'), true);
  assert.equal(ownerMatches('Kathy', "O'Brien", "O'BRIEN KATHY DANELLE"), true, 'apostrophes survive the regex escape');
  assert.equal(ownerMatches('John', 'Smith', 'SMITHSON JOHN'), false);
});

test('resolve: exactly one owner is kept; two different owners skip; trusts and LLCs are excluded at parse; suite or PO box drops the address', () => {
  const one = resolveHome('John', 'Smith', [hit('SMITH JOHN D'), hit('SMITH JOHN D', '12 Oak St')]);
  assert.equal(one.status, 'matched'); assert.equal(one.owners, 1); assert.equal(one.hit?.street, '12 Oak St');
  const two = resolveHome('John', 'Smith', [hit('SMITH JOHN D', '1 A St'), hit('SMITH JOHN ZACHARY', '2 B St')]);
  assert.equal(two.status, 'ambiguous'); assert.equal(two.owners, 2); assert.equal(two.hit, null);
  const none = resolveHome('John', 'Smith', [hit('SMITH ROBERT'), hit('JONES JOHN')]);
  assert.equal(none.status, 'none');
  const poBox = resolveHome('John', 'Smith', [hit('SMITH JOHN', 'PO BOX 157'), hit('SMITH JOHN', '99 MAIN ST STE 4')]);
  assert.equal(poBox.status, 'street_not_ok'); assert.equal(poBox.owners, 1);
  const failed = resolveHome('John', 'Smith', null);
  assert.equal(failed.status, 'failed');
  // Entity words never reach resolve: the state parsers drop them (checked per state below).
  const parsed = PARCEL_SOURCES.FL.parse({ features: [{ attributes: { OWN_NAME: 'SMITH JOHN TRUST', PHY_ADDR1: '1 A ST', PHY_CITY: 'TAMPA', PHY_ZIPCD: 33601 } }, { attributes: { OWN_NAME: 'SMITH JOHN LLC', PHY_ADDR1: '2 B ST', PHY_CITY: 'TAMPA', PHY_ZIPCD: 33601 } }, { attributes: { OWN_NAME: 'SMITH JOHN', PHY_ADDR1: '3 C ST', PHY_CITY: 'TAMPA', PHY_ZIPCD: 33601 } }] });
  assert.deepEqual(parsed?.map(item => item.owner), ['SMITH JOHN']);
  // A middle initial between LAST and FIRST is the same person; an FID-style couple string is one owner.
  const couple = resolveHome('John', 'Smith', [hit('SMITH JOHN GABRIEL & VANNA ASHLYN', '10604 LAKE BEACH DR')]);
  assert.equal(couple.status, 'matched');
});

test('PARCEL table: nine states, engine.py where clauses (TN comma and IL year verified live), names sanitised for SQL, entity owners removed', () => {
  assert.deepEqual([...PARCEL_STATES].sort(), ['AZ', 'FL', 'GA', 'IL', 'NC', 'PA', 'TN', 'TX', 'WA']);
  assert.equal(parcelSourceFor('OH'), null); assert.equal(parcelSourceFor('fl')?.state, 'FL');
  assert.equal(sqlName("O'Brien"), "O''BRIEN"); assert.equal(sqlName('Smith; DROP TABLE x--'), 'SMITH DROP TABLE X--'.replace('--', '--'));
  assert.equal(sqlName('José Nuñez'), 'JOS NUEZ', 'non-ASCII letters are dropped rather than sent into a LIKE');
  const nc = PARCEL_SOURCES.NC.url('John', 'Smith');
  assert.ok(nc.includes("ownname%20LIKE%20%27%25SMITH%25%27%20AND%20ownname%20LIKE%20%27%25JOHN%25%27") && nc.includes('resultRecordCount=5') && nc.includes('returnGeometry=false'), nc);
  assert.ok(PARCEL_SOURCES.FL.url('John', 'Smith').includes("OWN_NAME%20LIKE%20%27SMITH%20JOHN%25%27"));
  assert.ok(PARCEL_SOURCES.AZ.url('John', 'Smith').includes("PropertyUseDescription%20LIKE%20%27SFR%25%27"));
  assert.ok(PARCEL_SOURCES.TN.url('John', 'Smith').includes("Owner%20LIKE%20%27SMITH%25JOHN%25%27"), 'TN owners are LAST, FIRST');
  assert.ok(PARCEL_SOURCES.IL.url('John', 'Smith').includes(`year%3D%27${IL_ASSESSMENT_YEAR}%27`) && PARCEL_SOURCES.IL.url('John', 'Smith').includes("like%20%27JOHN%25SMITH%27"));
  assert.ok(PARCEL_SOURCES.PA.url('John', 'Smith').includes("owner_1%20LIKE%20%27SMITH%20JOHN%25%27") && PARCEL_SOURCES.PA.url('John', 'Smith').includes('mailing_street%3Dlocation'));
  assert.equal(PARCEL_SOURCES.TX.county, 'Travis'); assert.equal(PARCEL_SOURCES.FL.county, null); assert.equal(PARCEL_SOURCES.NC.county, null); assert.equal(PARCEL_SOURCES.IL.county, 'Cook');
  assert.equal(PARCEL_HIT_RATE, 0.25);
  // A layer error or a non-JSON body is a failure (null), never an empty match.
  assert.equal(PARCEL_SOURCES.FL.parse({ error: { code: 400 } }), null); assert.equal(PARCEL_SOURCES.FL.parse('oops'), null); assert.equal(PARCEL_SOURCES.IL.parse({ rows: [] }), null); assert.equal(PARCEL_SOURCES.PA.parse([]), null);
});

test('each state parser reads its live sample (2026-09-21) into owner, street, city, zip, and resolve applies the uniqueness rule', () => {
  const fl = PARCEL_SOURCES.FL.parse(fixture('FL'))!;
  assert.ok(fl.length >= 3); assert.equal(fl[0].owner, 'SMITH JOHN D'); assert.equal(fl[0].street, '16330 N STATE RD 121'); assert.equal(fl[0].city, 'Gainesville'); assert.equal(fl[0].zip, '32653', 'double ZIP becomes five digits');
  assert.equal(resolveHome('John', 'Smith', fl).status, 'ambiguous', 'a common name matches several Florida owners: never traced');
  assert.equal(resolveHome('John', 'Smith', fl.slice(0, 1)).status, 'matched');
  const nc = PARCEL_SOURCES.NC.parse(fixture('NC'))!;
  assert.equal(nc[0].owner, 'SMITH, JOHN J'); assert.equal(nc[0].street, '106 WILSON ST');
  const johnny = resolveHome('Johnny', 'Smith', nc);
  assert.equal(johnny.status, 'matched', 'SMITH, JOHNNY W and SMITH, JOHNNY WAYNE JR share the first twelve letters: one owner (engine.py rule); the rows without a site address are not traced');
  assert.equal(johnny.hit?.street, '1117 NCHS RD');
  const az = PARCEL_SOURCES.AZ.parse(fixture('AZ'))!;
  assert.equal(az[0].owner, 'SMITH JOHNNY R'); assert.equal(az[0].street, '4327 N 108TH AVE'); assert.equal(az[0].city, 'Phoenix'); assert.equal(az[0].zip, '85037');
  const tx = PARCEL_SOURCES.TX.parse(fixture('TX'))!;
  assert.equal(tx[0].owner, 'SMITH JOHN GABRIEL & VANNA ASHLYN'); assert.equal(tx[0].city, 'Dripping Springs');
  assert.equal(resolveHome('Johnny', 'Smith', tx).status, 'street_not_ok', 'the only JOHNNY R rows are a PO box');
  const ga = PARCEL_SOURCES.GA.parse(fixture('GA'))!;
  assert.equal(ga[0].street, '1260 BUCKINGHAM DR'); assert.equal(ga[0].city, 'Fairburn'); assert.equal(ga[0].zip, '30213', 'OwnerAddr2 "FAIRBURN GA 30213" split into city and zip');
  const tn = PARCEL_SOURCES.TN.parse(fixture('TN'))!;
  assert.equal(tn[0].owner, 'SMITH, TYLER J'); assert.equal(tn[1].street, '8673 LAWSON DR'); assert.equal(tn[1].city, 'Antioch');
  assert.equal(resolveHome('Robert', 'Smith', tn).status, 'matched');
  assert.equal(resolveHome('Tyler', 'Smith', tn).status, 'street_not_ok', '#202 is a unit');
  const wa = PARCEL_SOURCES.WA.parse(fixture('WA'))!;
  assert.equal(wa[1].owner, 'SMITH JOHN L'); assert.equal(wa[1].zip, '98037', 'ZIP+4 trimmed'); assert.equal(wa[1].city, 'Lynnwood');
  const il = PARCEL_SOURCES.IL.parse(fixture('IL'))!;
  assert.equal(il.length, 3, 'owner-occupied rows only (mailing house number equals property house number)');
  assert.equal(il[0].owner, 'JOHN SMITH'); assert.equal(il[0].street, '1035 W 107TH ST'); assert.equal(il[0].city, 'Chicago'); assert.equal(il[0].zip, '60643');
  assert.equal(resolveHome('John', 'Smith', il).status, 'matched', 'only "JOHN SMITH" names him in engine.py\'s two forms; the "JOHN & ..." couples do not match');
  assert.equal(resolveHome('John', 'Smith', il).hit?.street, '1035 W 107TH ST');
  const pa = PARCEL_SOURCES.PA.parse(fixture('PA'))!;
  assert.equal(pa[2].owner, 'SMITH JOHN'); assert.equal(pa[2].street, '5207 LOCUST ST'); assert.equal(pa[2].city, 'Philadelphia'); assert.equal(pa[2].zip, '19139');
  assert.equal(resolveHome('Johnnie', 'Smith', pa).status, 'matched');
  // Same-person spelling variants (SMITH JOHNNIE, SMITH JOHN FRED, SMITH JOHN) are three owner strings: skip.
  assert.equal(resolveHome('John', 'Smith', pa).status, 'ambiguous');
});

test('home street origin per register (brain skip_if): FL RE and FL CPA always, FL barbers practitioner rows, a TABC mailing address; everyone else needs the parcel step', () => {
  assert.equal(homeStreetSource('fl_re', 'Broker', '7104 JEFFERSON ST'), 'register');
  assert.equal(homeStreetSource('fl_re:property_management', 'Sole Broker', '7104 JEFFERSON ST'), 'register');
  assert.equal(homeStreetSource('fl_cpa', 'CPA', '244 ATLANTIC ISLE'), 'register');
  assert.equal(homeStreetSource('fl_dbpr_barbers', 'Barber', '5716 NW 127TH TERRACE'), 'register');
  assert.equal(homeStreetSource('fl_dbpr_barbers', 'Owner', null), 'parcel', 'a shop row names the owner but not the home');
  assert.equal(homeStreetSource('tx_tabc', 'Owner', '5011 AVE O'), 'register_mailing');
  assert.equal(homeStreetSource('tx_tabc', 'Owner', null), 'parcel');
  for (const source of ['tx_trec', 'az_adre', 'il_idfpr:cpa', 'nppes:dentist', 'nppes_medspa', 'tx_tdi', 'ny_salons', 'co_sos_agents', 'pa_pals:accountancy']) assert.equal(homeStreetSource(source, 'Owner', '1 MAIN ST'), 'parcel', source);
  assert.equal(registerCarriesHomeStreet('fl_cpa'), true); assert.equal(registerCarriesHomeStreet('fl_re:property_management'), true); assert.equal(registerCarriesHomeStreet('fl_dbpr_barbers'), false); assert.equal(registerCarriesHomeStreet('tx_tabc'), false);
  assert.equal(addressLine({ first: 'Victoria', last: 'Aaron', street: '7104 JEFFERSON ST', city: 'Navarre', state: 'FL', zip: '32566' }), 'Victoria Aaron | 7104 JEFFERSON ST | Navarre FL 32566');
});
