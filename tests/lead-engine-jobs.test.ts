import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJobInput, quoteJob, citiesFor, placesForNextCity, sampleGate, dialSheet, parseOutcomeRecords, parseOutcomeBody, readProgress, scrapeCents, verifyCents, MIN_PLACES_PER_RUN, MAX_PLACES_PER_RUN,
  selectRegisterNames, registerRowName, namesWanted, topRegisterCities, scrapeKeyword, initialProgress, NAMES_MAX, PHONE_REUSE_MAX } from '../src/lib/lead-engine-jobs.ts';
import type { JobRecord, RegisterNameRow } from '../src/lib/lead-engine-jobs.ts';
import { registerSourceFor, registerSources } from '../src/lib/lead-engine-brain.ts';
import { readWorkbook, writeWorkbook, sheetRecords } from '../src/lib/lead-engine-xlsx.ts';
import { LeadEngineError } from '../src/lib/lead-engine-storage.ts';

const id = 'cccccccc-cccc-4ccc-8ccc-000000000001';

test('job input: exact fields, two-letter state, 1 to 5,000 cells, strict DNC by default', () => {
  const input = parseJobInput({ id, industry: ' HVAC ', state: 'fl', targetCells: 500 });
  assert.deepEqual(input, { id, industry: 'HVAC', state: 'FL', targetCells: 500, dncMode: 'strict', useFallback: false });
  for (const bad of [{ id, industry: 'H', state: 'FL', targetCells: 5 }, { id, industry: 'HVAC', state: 'Florida', targetCells: 5 }, { id, industry: 'HVAC', state: 'FL', targetCells: 0 },
    { id, industry: 'HVAC', state: 'FL', targetCells: 5001 }, { id, industry: 'HVAC', state: 'FL', targetCells: 5, dncMode: 'loose' }, { id: 'x', industry: 'HVAC', state: 'FL', targetCells: 5 }, { id, industry: 'HVAC', state: 'FL', targetCells: 5, extra: 1 }]) {
    assert.throws(() => parseJobInput(bad), LeadEngineError);
  }
});

test('quote: HVAC Florida is recipe A, 2 credits per cell, cap = credits x $0.10 x 0.6, 12 Florida cities, no blockers', () => {
  const quote = quoteJob({ industry: 'hvac', state: 'FL', targetCells: 500, useFallback: false });
  assert.equal(quote.recipe, 'A'); assert.equal(quote.credits, 1000); assert.equal(quote.capCents, 6000); assert.equal(quote.creditCents, 10);
  assert.equal(quote.expectedClean, 0.2); assert.equal(quote.expectedBusinesses, 2500);
  assert.deepEqual(quote.blockers, []);
  assert.equal(quote.cities.length, 12); assert.equal(quote.cities[0], 'Miami, FL'); assert.ok(quote.cities.includes('Tampa, FL'));
  assert.ok(quote.estimatedVendorCents > 1000 && quote.estimatedVendorCents < 3000, `vendor estimate ${quote.estimatedVendorCents}`);
});

test('quote: every industry runs in every state; prohibited or register-less states fall to recipe A automatically', () => {
  const sc = quoteJob({ industry: 'contractors', state: 'SC', targetCells: 50, useFallback: false });
  assert.equal(sc.recipe, 'A'); assert.equal(sc.legalStatus, 'ok'); assert.deepEqual(sc.blockers, []); assert.equal(sc.credits, 100);
  assert.match(sc.pathNote ?? '', /LLR/); assert.match(sc.pathNote ?? '', /Nationwide path/);
  // Phase 4: recipe B is wired. FL CPAs read fl_cpa, whose file carries the licensee's own street, so the parcel step is skipped.
  const cpa = quoteJob({ industry: 'cpa', state: 'FL', targetCells: 50, useFallback: false });
  assert.equal(cpa.recipe, 'B'); assert.deepEqual(cpa.blockers, []); assert.equal(cpa.registerSource, 'fl_cpa'); assert.equal(cpa.skipParcel, true); assert.equal(cpa.parcelSource, null);
  assert.equal(cpa.traces, cpa.expectedBusinesses, 'every name is traced when the file carries the home street'); assert.equal(cpa.estimatedVendorCents, cpa.traces * 7);
  const ohio = quoteJob({ industry: 'contractors', state: 'OH', targetCells: 50, useFallback: false });
  assert.equal(ohio.recipe, 'A'); assert.deepEqual(ohio.blockers, []); assert.match(ohio.pathNote ?? '', /No register for contractor registry in OH/);
  assert.throws(() => quoteJob({ industry: 'alpaca farm', state: 'FL', targetCells: 5, useFallback: false }), (error: unknown) => error instanceof LeadEngineError && error.code === 'unknown_industry');
});

test('cities and places: provider minimum 125, our maximum 500, sized to what is still missing', () => {
  assert.equal(citiesFor('TX')[0], 'Houston, TX'); assert.deepEqual(citiesFor('ZZ'), []);
  assert.equal(placesForNextCity(500, 0, 0.2), MAX_PLACES_PER_RUN);
  assert.equal(placesForNextCity(20, 0, 0.2), 130);
  assert.equal(placesForNextCity(5, 4, 0.2), MIN_PLACES_PER_RUN);
  assert.equal(scrapeCents(125), 50); assert.equal(scrapeCents(500), 200);
  assert.equal(verifyCents(10), 7); assert.equal(verifyCents(1), 1);
});

test('small scrape quotes include the provider minimum instead of understating cost', () => {
  const quote = quoteJob({ industry: 'roofing', state: 'FL', targetCells: 10, useFallback: false });
  assert.equal(quote.expectedBusinesses, 50);
  assert.equal(quote.estimatedVendorCents, 75, 'USD 0.50 minimum scrape plus estimated phone verification');
  assert.ok(quote.capCents >= quote.estimatedVendorCents);
});

test('sample gate: under half the expected clean rate stops the job with the numbers in the reason', () => {
  const fail = sampleGate(40, 2, 0.2, 0.5);
  assert.equal(fail.pass, false); assert.match(fail.reason ?? '', /5% clean on 40 verified vs 20% expected/);
  const pass = sampleGate(40, 5, 0.2, 0.5);
  assert.equal(pass.pass, true); assert.equal(pass.reason, null); assert.equal(pass.cleanRate, 0.125);
  assert.equal(sampleGate(0, 0, 0.2, 0.5).pass, false);
});

test('progress defaults come from the state city list and merge with what the job stored', () => {
  const progress = readProgress({ progress: { cityIndex: 2, delivered: 7 }, state: 'FL' });
  assert.equal(progress.cityIndex, 2); assert.equal(progress.delivered, 7); assert.equal(progress.phase, 'scrape'); assert.equal(progress.cities.length, 12);
});

const job = {
  id, operator_id: 'o', industry: 'HVAC', industry_key: 'hvac', state: 'FL', target_cells: 2, dnc_mode: 'strict', recipe: 'A', recipe_version: 'A', brain_version: '2026-09-21.1',
  legal_status: 'ok', legal_note: null, expected_clean: '0.2000', credits_per_cell: 2, credit_cents: 10, cap_ratio: '0.600', credits_quoted: 4, credits_held: 0, credits_settled: 4,
  cap_cents: 24, spent_cents: 9, status: 'delivered', resume_from: null, attention_reason: null, sample: {}, progress: {}, delivered_count: 2, plan_id: null, batch_id: null,
  created_at: '2026-09-21T00:00:00Z', updated_at: '2026-09-21T00:00:00Z', quoted_at: null, delivered_at: '2026-09-21T01:00:00Z',
} satisfies JobRecord;

test('dial sheet: the 20 brain columns in order, 8pm in the legal notes, and the outcome round trip keyed by Ledger Id', () => {
  const rows = [
    { position: 1, phone10: '7045551234', company: 'Acme HVAC', mapsUrl: 'https://www.google.com/maps/place/?q=place_id:x', rating: 4.8, reviews: 120, city: 'Tampa', state: 'FL', timeZone: 'America/New_York', ownerName: null, email: null, status: 'Callable mobile', bucket: null, source: 'google_maps', sourceRowId: 'x', licenseIssueDate: null, ledgerId: 'dddddddd-dddd-4ddd-8ddd-000000000001' },
    { position: 2, phone10: '8135551234', company: 'Bay Cooling', mapsUrl: null, rating: null, reviews: null, city: 'Tampa', state: 'FL', timeZone: 'America/New_York', ownerName: null, email: null, status: 'Callable mobile', bucket: null, source: 'google_maps', sourceRowId: null, licenseIssueDate: null, ledgerId: 'dddddddd-dddd-4ddd-8ddd-000000000002' },
  ];
  const sheets = dialSheet(job, rows, { Delivered: 2, 'Spent (USD)': 0.09 });
  assert.deepEqual(sheets.map(sheet => sheet.name), ['List', 'Summary', 'Legal Notes']);
  assert.equal(sheets[0].rows[0].length, 20); assert.equal(sheets[0].rows[0][1], 'Cell Phone'); assert.equal(sheets[0].rows[0][19], 'Ledger Id');
  assert.equal(sheets[0].rows[1][1], '(704) 555-1234'); assert.equal(sheets[0].rows[1][12], null); assert.equal(sheets[0].rows[1][19], rows[0].ledgerId);
  const notes = sheets[2].rows.map(row => String(row[0])).join(' ');
  assert.match(notes, /8:00am to 8:00pm/); assert.doesNotMatch(notes, /9pm|9:00pm/); assert.match(notes, /3 calls per 24 hours/);
  // The caller fills Called/Outcome/Notes and sends the file back.
  const filled = sheets[0].rows.map((row, index) => index === 0 ? row : [...row.slice(0, 12), 'yes', index === 1 ? 'Reached owner' : 'opt_out', index === 2 ? 'do not call again' : null, ...row.slice(15)]);
  const back = sheetRecords(readWorkbook(writeWorkbook([{ name: 'List', rows: filled }]))[0]);
  const parsed = parseOutcomeRecords(back);
  assert.deepEqual(parsed.errors, []); assert.equal(parsed.skipped, 0);
  assert.deepEqual(parsed.rows, [
    { ledgerId: rows[0].ledgerId, outcome: 'reached_owner', notes: null, row: 2 },
    { ledgerId: rows[1].ledgerId, outcome: 'opt_out', notes: 'do not call again', row: 3 },
  ]);
});

test('outcome sheet: empty outcomes are skipped, unknown words and bad ids are reported with their row', () => {
  const parsed = parseOutcomeRecords([
    { 'Ledger Id': 'dddddddd-dddd-4ddd-8ddd-000000000001', Outcome: null },
    { 'Ledger Id': 'dddddddd-dddd-4ddd-8ddd-000000000001', Outcome: 'answered' },
    { 'Ledger Id': 'nope', Outcome: 'voicemail' },
    { 'Ledger Id': 'dddddddd-dddd-4ddd-8ddd-000000000003', Outcome: 'No Answer' },
  ]);
  assert.equal(parsed.skipped, 1); assert.equal(parsed.rows.length, 1); assert.equal(parsed.rows[0].outcome, 'no_answer');
  assert.equal(parsed.errors.length, 2); assert.match(parsed.errors[0], /Row 3.*answered/); assert.match(parsed.errors[1], /Row 4.*Ledger Id/);
});

test('single outcome body: exact fields, valid outcome, ISO time, notes trimmed', () => {
  const body = parseOutcomeBody({ ledgerId: 'DDDDDDDD-dddd-4ddd-8ddd-000000000001', outcome: 'gatekeeper', dialedAt: '2026-09-21T15:00:00.000Z', notes: ' spoke to Ana ' });
  assert.deepEqual(body, { ledgerId: 'dddddddd-dddd-4ddd-8ddd-000000000001', outcome: 'gatekeeper', dialedAt: '2026-09-21T15:00:00.000Z', notes: 'spoke to Ana' });
  assert.throws(() => parseOutcomeBody({ ledgerId: body.ledgerId, outcome: 'answered' }), LeadEngineError);
  assert.throws(() => parseOutcomeBody({ ledgerId: body.ledgerId, outcome: 'voicemail', dialedAt: 'yesterday' }), LeadEngineError);
  assert.throws(() => parseOutcomeBody({ ledgerId: body.ledgerId, outcome: 'voicemail', extra: 1 }), LeadEngineError);
});

// Phase 2 task 2 and Phase 3 task 2: the register recipes quote once a lead_engine_names source is mapped.
test('quote: recipe C and D route to the mapped register, cost verify only (C) or verify plus one scrape (D), and are no longer "not wired"', () => {
  const wa = quoteJob({ industry: 'contractors', state: 'WA', targetCells: 100, useFallback: false });
  assert.equal(wa.recipe, 'C'); assert.equal(wa.registerSource, 'wa_lni'); assert.equal(wa.legalStatus, 'restricted'); assert.deepEqual(wa.blockers, []);
  assert.equal(wa.credits, 200); assert.equal(wa.expectedBusinesses, Math.ceil(100 / wa.expectedClean));
  assert.equal(wa.estimatedVendorCents, Math.ceil(wa.expectedBusinesses * 0.7), 'C pays for verify only');
  const ca = quoteJob({ industry: 'contractors', state: 'CA', targetCells: 100, useFallback: false });
  assert.equal(ca.recipe, 'C'); assert.equal(ca.registerSource, 'cslb'); assert.equal(ca.legalStatus, 'restricted'); assert.deepEqual(ca.blockers, []);
  const tx = quoteJob({ industry: 'tax preparer', state: 'TX', targetCells: 100, useFallback: false });
  assert.equal(tx.recipe, 'C'); assert.equal(tx.registerSource, 'irs_ptin'); assert.equal(tx.legalStatus, 'ok'); assert.deepEqual(tx.blockers, []);
  const pa = quoteJob({ industry: 'daycare', state: 'PA', targetCells: 100, useFallback: false });
  assert.equal(pa.recipe, 'C'); assert.equal(pa.registerSource, 'pa_childcare'); assert.deepEqual(pa.blockers, []);
  const fl = quoteJob({ industry: 'florida contractors', state: 'FL', targetCells: 100, useFallback: false });
  assert.equal(fl.recipe, 'D'); assert.equal(fl.registerSource, 'fl_dbpr_construction'); assert.deepEqual(fl.blockers, []);
  assert.equal(fl.estimatedVendorCents, Math.ceil(fl.expectedBusinesses * 0.7 + scrapeCents(fl.expectedBusinesses)), 'D pays verify plus the Maps scrape');
  assert.ok(fl.cities.length > 0);
  // Recipe D over the national NPPES register: mapped under *, no blocker.
  const chiro = quoteJob({ industry: 'chiropractor direct line', state: 'FL', targetCells: 100, useFallback: false });
  assert.equal(chiro.recipe, 'D'); assert.equal(chiro.registerSource, 'nppes'); assert.deepEqual(chiro.blockers, []);
  // A recipe C industry in a state with no register source is still the no-source case.
  const or = quoteJob({ industry: 'tax preparer', state: 'OR', targetCells: 50, useFallback: false });
  assert.equal(or.recipe, 'C'); assert.equal(or.registerSource, 'irs_ptin');
});

test('quote guardrail: Google Maps is never the deliverable for attorneys, CPAs or med spas; every other register industry runs nationwide via recipe A where no register exists', () => {
  const nyAttorney = quoteJob({ industry: 'attorney_ny', state: 'TX', targetCells: 10, useFallback: true });
  assert.equal(nyAttorney.fallbackAvailable, false);
  assert.ok(nyAttorney.blockers.length > 0);
  const cpa = quoteJob({ industry: 'cpa', state: 'FL', targetCells: 50, useFallback: true });
  assert.equal(cpa.recipe, 'B'); assert.equal(cpa.fallbackAvailable, false); assert.ok(cpa.blockers.some(item => /never the deliverable/.test(item)));
  const attorney = quoteJob({ industry: 'attorney', state: 'TX', targetCells: 50, useFallback: false });
  assert.equal(attorney.recipe, 'B'); assert.ok(attorney.blockers.some(item => /never the deliverable/.test(item)));
  // Med spas in FL: NPPES NPI-2 names plus the Florida statewide parcel layer; never Maps, no blocker.
  const spa = quoteJob({ industry: 'med spa', state: 'FL', targetCells: 50, useFallback: false });
  assert.equal(spa.recipe, 'B'); assert.equal(spa.fallbackAvailable, false); assert.deepEqual(spa.blockers, []); assert.equal(spa.registerSource, 'nppes_medspa'); assert.equal(spa.skipParcel, false); assert.match(spa.parcelSource ?? '', /Florida statewide/);
  assert.ok(spa.traces < spa.expectedBusinesses, 'only the parcel hit rate of the names is traced');
  // Attorneys in TX: never Maps and no B name source in TX, so the quote stays blocked (the guardrail, not a Phase note).
  assert.equal(attorney.fallbackAvailable, false); assert.equal(attorney.registerSource, null); assert.ok(attorney.blockers.some(item => /has no mapped register/.test(item)));
  // Dentists in NC: the NPPES taxonomy filter plus NC OneMap. Realtors in TX: TREC plus the Travis County parcels.
  const dentist = quoteJob({ industry: 'dentist', state: 'NC', targetCells: 50, useFallback: false });
  assert.equal(dentist.recipe, 'B'); assert.deepEqual(dentist.blockers, []); assert.equal(dentist.registerSource, 'nppes:dentist'); assert.match(dentist.parcelSource ?? '', /NC OneMap/);
  const trec = quoteJob({ industry: 'realtor', state: 'TX', targetCells: 50, useFallback: false });
  assert.equal(trec.recipe, 'B'); assert.deepEqual(trec.blockers, []); assert.equal(trec.registerSource, 'tx_trec'); assert.match(trec.parcelSource ?? '', /Travis/); assert.equal(trec.fallbackAvailable, true);
  // Realtors in FL read fl_re, whose file carries the broker's own street (parcel skipped).
  const flRealtor = quoteJob({ industry: 'realtor', state: 'FL', targetCells: 50, useFallback: false });
  assert.equal(flRealtor.recipe, 'B'); assert.equal(flRealtor.registerSource, 'fl_re'); assert.equal(flRealtor.skipParcel, true); assert.deepEqual(flRealtor.blockers, []);
  // Realtors in a state with no register run nationwide on recipe A automatically, with the reason recorded.
  const realtor = quoteJob({ industry: 'realtor', state: 'OH', targetCells: 50, useFallback: false });
  assert.equal(realtor.recipe, 'A'); assert.deepEqual(realtor.blockers, []); assert.equal(realtor.expectedClean, 0.2); assert.match(realtor.pathNote ?? '', /No register for realtor in OH/);
  assert.equal(realtor.fallbackAvailable, true);
  // A mapped register is used where it exists; the operator can still force Maps.
  const or = quoteJob({ industry: 'contractors', state: 'OR', targetCells: 50, useFallback: false });
  assert.equal(or.recipe, 'C'); assert.equal(or.registerSource, 'or_ccb');
  const orMaps = quoteJob({ industry: 'contractors', state: 'OR', targetCells: 50, useFallback: true });
  assert.equal(orMaps.recipe, 'A'); assert.match(orMaps.pathNote ?? '', /Operator chose/);
  const hvac = quoteJob({ industry: 'hvac', state: 'FL', targetCells: 50, useFallback: true });
  assert.equal(hvac.recipe, 'A'); assert.equal(hvac.fallbackAvailable, false); assert.equal(hvac.registerSource, null);
});

test('brain: register_source maps industry + state to a lead_engine_names source id, nationwide files under *', () => {
  assert.equal(registerSourceFor('contractor_registry', 'WA'), 'wa_lni');
  assert.equal(registerSourceFor('contractor_registry', 'or'), 'or_ccb');
  assert.equal(registerSourceFor('contractor_registry', 'FL'), null, 'Florida contractors are their own recipe D industry');
  assert.equal(registerSourceFor('tax_preparer', 'NV'), 'irs_ptin');
  assert.equal(registerSourceFor('childcare_home', 'NY'), 'ny_childcare');
  assert.equal(registerSourceFor('str_operator', 'LA'), 'nola_str');
  assert.equal(registerSourceFor('healthcare_ao_contrast', 'FL'), 'nppes');
  assert.equal(registerSourceFor('movers_tree_haulers', 'TX'), 'fmcsa');
  const ids = new Set(registerSources().map(item => item.source));
  for (const id of ['wa_lni', 'or_ccb', 'cslb', 'pa_pals', 'fl_dbpr_construction', 'irs_ptin', 'fl_dfs_individual', 'pa_childcare', 'ny_childcare', 'tx_childcare', 'ny_attorneys', 'nola_str', 'orlando_str', 'mn_dli', 'austin_permits', 'nppes', 'fmcsa']) assert.ok(ids.has(id), id);
});

const nameRow = (patch: Partial<RegisterNameRow> & { id: string }): RegisterNameRow => ({
  source: 'wa_lni', source_row_id: patch.id, first_name: 'Jane', last_name: 'Doe', company: null, title_code: null, business_type: 'Individual', license_issue_date: '2024-01-01',
  street: '1 Main St', city: 'Seattle', state: 'WA', zip: '98101', phone10: '2065550100', email: null, reuse_count: 1, ...patch,
});

test('names step rules: phones on more than 3 licences dropped, delivered and suppressed dropped, one row per phone, newest licence first with nulls last', () => {
  const rows = [
    nameRow({ id: 'old', license_issue_date: '2009-05-01', phone10: '2065550001' }),
    nameRow({ id: 'employer', phone10: '2065550002', reuse_count: PHONE_REUSE_MAX + 1 }),
    nameRow({ id: 'edge', phone10: '2065550003', reuse_count: PHONE_REUSE_MAX, license_issue_date: '2023-01-01' }),
    nameRow({ id: 'delivered', phone10: '2065550004' }),
    nameRow({ id: 'twin-older', phone10: '2065550005', license_issue_date: '2015-01-01' }),
    nameRow({ id: 'twin-newer', phone10: '2065550005', license_issue_date: '2025-06-01' }),
    nameRow({ id: 'undated', phone10: '2065550006', license_issue_date: null }),
    nameRow({ id: 'nophone', phone10: null, license_issue_date: '2026-01-01' }),
  ];
  const c = selectRegisterNames(rows, new Set(['2065550004']), { requirePhone: true });
  assert.deepEqual(c.kept.map(row => row.id), ['twin-newer', 'edge', 'old', 'undated']);
  assert.equal(c.droppedReuse, 1); assert.equal(c.droppedDelivered, 1); assert.equal(c.droppedDuplicate, 1); assert.equal(c.droppedNoPhone, 1);
  // Recipe D keeps the phoneless licensee (the Maps line may still be found for it).
  const d = selectRegisterNames(rows, new Set(), { requirePhone: false });
  assert.equal(d.kept[0].id, 'nophone'); assert.equal(d.droppedNoPhone, 0); assert.equal(d.kept.length, 6);
  // Phones seen in earlier pages are duplicates too.
  const seen = new Set(['2065550001']);
  assert.equal(selectRegisterNames(rows.slice(0, 1), new Set(), { requirePhone: true, seenPhones: seen }).droppedDuplicate, 1);
  assert.equal(registerRowName(nameRow({ id: 'x', company: 'Doe Roofing LLC' })), 'Doe Roofing LLC');
  assert.equal(registerRowName(nameRow({ id: 'y' })), 'Jane Doe');
  assert.equal(registerRowName(nameRow({ id: 'z', first_name: null, last_name: null })), 'Unnamed licensee');
});

test('names wanted, register cities and the recipe D keyword', () => {
  assert.equal(namesWanted(100, 0, 0.63), Math.ceil(100 / 0.63 * 1.3));
  assert.equal(namesWanted(5000, 0, 0.1), NAMES_MAX);
  assert.equal(namesWanted(10, 10, 0.5), 3);
  assert.deepEqual(topRegisterCities(['TAMPA', 'Tampa', 'tampa ', 'Orlando', 'Miami', 'Miami', null, ''], 'FL', 2), ['Tampa, FL', 'Miami, FL']);
  assert.equal(scrapeKeyword('contractor_fl', 'florida contractors'), 'contractor');
  assert.equal(scrapeKeyword('healthcare_ao_contrast', 'chiropractor direct line'), 'chiropractor');
  assert.equal(scrapeKeyword('hvac', 'hvac'), 'hvac contractor');
  assert.equal(scrapeKeyword('salon_suite_tx', 'texas salon suite'), 'salon');
});

test('progress: register recipes start in the names phase and keep their counters through a merge', () => {
  const c = initialProgress([], 'C', 'wa_lni');
  assert.equal(c.phase, 'names'); assert.equal(c.registerSource, 'wa_lni'); assert.equal(c.namesDone, false); assert.deepEqual(c.gateFailures, []);
  const merged = readProgress({ progress: { names: 250, bucket2: 7, registerSource: 'fl_dbpr_construction' }, state: 'FL', recipe: 'D' });
  assert.equal(merged.phase, 'names'); assert.equal(merged.names, 250); assert.equal(merged.bucket2, 7); assert.equal(merged.bucket1, 0); assert.equal(merged.registerSource, 'fl_dbpr_construction');
  assert.equal(readProgress({ progress: {}, state: 'FL' }).phase, 'scrape');
});

test('dial sheet: recipe D rows carry Bucket, Source, Source Row Id and License Issue Date', () => {
  const dJob = { ...job, recipe: 'D' as const, industry: 'florida contractors', industry_key: 'contractor_fl' };
  const sheets = dialSheet(dJob, [{ position: 1, phone10: '8135551234', company: 'Acme Roofing', mapsUrl: null, rating: null, reviews: null, city: 'Tampa', state: 'FL', timeZone: 'America/New_York', ownerName: 'Jane Acme', email: 'jane@acme.test',
    status: 'Callable mobile · owner direct line candidate', bucket: 2, source: 'fl_dbpr_construction', sourceRowId: 'CCC1234567', licenseIssueDate: '2024-03-01', ledgerId: 'dddddddd-dddd-4ddd-8ddd-000000000001' }], {});
  const header = sheets[0].rows[0] as string[], line = sheets[0].rows[1];
  assert.equal(line[header.indexOf('Bucket')], 2); assert.equal(line[header.indexOf('Source')], 'fl_dbpr_construction');
  assert.equal(line[header.indexOf('Source Row Id')], 'CCC1234567'); assert.equal(line[header.indexOf('License Issue Date')], '2024-03-01'); assert.equal(line[header.indexOf('Owner Name')], 'Jane Acme');
});
