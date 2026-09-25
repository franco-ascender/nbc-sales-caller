import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nppesMedspaOrganization, txChildcareRow, fmcsaRow, nyAttorneyRow, txTabcRow } from '../src/lib/lead-engine-registers.ts';
import { classifyRelevance } from '../src/lib/lead-engine-industries.ts';
import { parseDiscoveryCandidate } from '../src/lib/lead-engine-scrape.ts';
import { contactEvidenceStatus } from '../src/lib/lead-engine-jobs.ts';

test('med spa clinical authority alone is not an owner candidate; explicit owner survives', () => {
  const row = { number: '1234567890', enumeration_type: 'NPI-2', basic: { status: 'A', organization_name: 'Example Aesthetics LLC', authorized_official_first_name: 'Alex', authorized_official_last_name: 'Example', authorized_official_title_or_position: '' }, addresses: [{address_purpose: 'LOCATION', state: 'FL'}], taxonomies: [] };
  for (const title of ['MEDICAL DIRECTOR', 'DIRECTOR', 'PHYSICIAN', 'DDS', 'DMD', 'CHIROPRACTOR', 'DOCTOR', 'PARTNERSHIP COORDINATOR']) {
    const result = nppesMedspaOrganization({...row, basic: {...row.basic, authorized_official_title_or_position: title}});
    assert.equal(result?.name, null, title);
  }
  for (const title of ['OWNER', 'CO-OWNER / NURSE PRACTITIONER', 'FOUNDER', 'PRESIDENT/OWNER']) {
    assert.ok(nppesMedspaOrganization({...row, basic: {...row.basic, authorized_official_title_or_position: title}})?.name, title);
  }
});

test('childcare employees cannot substitute for an unresolved provider identity', () => {
  const source = { operation_id: 'test-1', operation_name: 'Example Learning LLC', administrator_director_name: 'Alex Example', operation_status: 'Y', operation_type: 'Licensed Child-Care Home' };
  assert.equal(txChildcareRow(source)?.skipReason, 'owner_identity_unresolved');
  assert.equal(txChildcareRow({...source, operation_name: 'Alex Example'})?.name?.titleCode, 'Provider');
  assert.equal(txChildcareRow({...source, operation_name: 'Alex Example', temporarily_closed: 'YES'})?.skipReason, 'closed');
});

test('pool discovery rejects wellness spas while preserving pool businesses', () => {
  for (const label of ['Serene medical spa', 'Day spa and massage', 'Beauty spa']) assert.equal(classifyRelevance(label, 'pool'), null);
  assert.equal(classifyRelevance('Swimming pool maintenance', 'pool'), 'core');
  assert.equal(classifyRelevance('Pool construction', 'pool'), 'core');
  assert.equal(classifyRelevance('Hot tub showroom', 'pool'), 'adjacent');
});

test('narrow industry cohorts admit valid singular/category synonyms and reject adjacent businesses before verification', () => {
  const cases: Array<[string, string[], string[]]> = [
    ['car_detailing', ['Auto Detailing', 'Ceramic Coating', 'Car Wash and Detailing'], ['Neighborhood Car Wash', 'Tint Center', 'Auto Repair']],
    ['auto_body', ['Precision Auto Body', 'Independent Collision Center', 'Body Shop'], ['Auto Glass', 'Auto Repair', 'Auto Parts']],
    ['jewelers', ['Jewelry Store', 'Jeweler', 'Jewelers', 'Jewellery'], ['Watch Repair', 'Pawn Shop', 'Antique Store']],
    ['exotic_car_dealers', ['Exotic Car Dealer', 'Luxury Auto Sales', 'Classic Cars'], ['Used Car Dealer', 'Ford Car Dealer', 'Luxury Spa']],
  ];
  for (const [industry, accepted, rejected] of cases) for (const [expected, labels] of [[true, accepted], [false, rejected]] as const) for (const title of labels) {
    const candidate = parseDiscoveryCandidate({ title, categoryName: title, phone: '3055550101', city: 'Miami', state: 'FL', countryCode: 'US', permanentlyClosed: false, temporarilyClosed: false, placeId: 'synthetic-industry-place', url: 'https://maps.google.com/?cid=synthetic' }, { industry, metro: 'Miami, FL', target: 5, hardBudgetCents: 100, exclusions: [] });
    assert.equal(candidate.rejection === null, expected, `${industry}: ${title} (${candidate.rejection})`);
  }
});

test('contact export never invents tracing or ownership from a recipe or phone mismatch', () => {
  assert.equal(contactEvidenceStatus('delivered', null, { lineType: 'Mobile' }), 'Callable mobile · business-contact candidate · ownership unconfirmed');
  assert.match(contactEvidenceStatus('delivered', null, {trace_status:'matched'}), /identity match recorded.*ownership unconfirmed/);
  assert.match(contactEvidenceStatus('delivered', 2, {}), /register differs from Maps.*ownership unconfirmed/);
  assert.match(contactEvidenceStatus('verified', null, {}), /do not call/);
  assert.doesNotMatch(contactEvidenceStatus('delivered', null, {}), /home|skip traced/);
});

test('FMCSA name equality cannot convert a company officer into a sole proprietor', () => {
  const row = { dot_number: 'synthetic', legal_name: 'Alex Example', company_officer_1: 'Alex Example' };
  for (const type of [undefined, '', 'CORPORATION', 'PARTNERSHIP']) assert.equal(fmcsaRow({...row,business_org_desc:type})?.payload.soleProprietor, false);
  assert.equal(fmcsaRow({...row,business_org_desc:'INDIVIDUAL'})?.payload.soleProprietor, true);
});

test('structural pest scope rejects crop-only work and preserves explicitly mixed structural services', () => {
  for (const label of ['Acme Crop Pest Management', 'Agricultural Pest Service', 'Crop Protection and Pest']) assert.equal(classifyRelevance(label,'pest_control'), null);
  for (const label of ['Residential Pest Control', 'Termite Exterminator', 'Residential Pest and Crop Pest Services']) assert.equal(classifyRelevance(label,'pest_control'), 'core');
});

test('NY attorney parser repeats the source address-state gate for cached or malformed input', () => {
  const row = {registration_number:'synthetic',first_name:'Alex',last_name:'Example',status:'Currently registered',state:'NY'};
  assert.ok(nyAttorneyRow(row)?.name);
  for (const state of ['NJ','',null,undefined]) assert.equal(nyAttorneyRow({...row,state})?.skipReason,'state_out_of_scope');
});

test('TABC license-holder evidence is not labelled restaurant ownership', () => {
  const row = txTabcRow({license_id:'synthetic',license_status:'Active',license_type:'MB',owner:'Alex Example',trade_name:'Example Restaurant'});
  assert.equal(row?.name?.titleCode,'License Holder');
});
