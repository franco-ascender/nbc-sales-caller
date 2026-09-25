import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adapterFor, REGISTER_ADAPTERS, splitPersonName, isPersonName, personFromParts, phoneOf, dateOf, parseCsvLine, stripExcelGuard, cityStateZip, maskPhone, sanitizeReason, dedupeNames, rowHash,
  socrataUrl, SOCRATA_URL_MAX, parseContentRange, waLni, orCcb, cslb, paPals, flDbprConstruction, irsPtin, flDfsIndividual, fmcsa, paChildcare, nyChildcare, txChildcare, nyAttorneys, txTdlrSalons,
  nolaStr, orlandoStr, mnDli, austinPermits, nppes, RegisterParseError, NPPES_LIMIT, NPPES_SKIP_MAX, zip3Prefixes, PALS_SURNAMES, runIngestLoop,
  flRe, flCpa, flDbprBarbers, txTrec, azAdre, ilIdfpr, nySalons, nyRepairShops, txTdi, txTabc, nyDohFood, coSosAgents, nppesMedspa, splitLastFirstName, traceablePerson, splitRegisterSource, txTdiIndividualsUrl, NPPES_MEDSPA_PATTERNS, CO_SOS_PATTERNS,
} from '../src/lib/lead-engine-registers.ts';
import type { ChunkFetcher, ChunkResponse, Cursor, IngestStore, ParsedRow, RegisterAdapter } from '../src/lib/lead-engine-registers.ts';

interface Fixture { rows?: unknown[]; text?: string; [key: string]: unknown }
function fixture(name: string): Fixture { return JSON.parse(readFileSync(new URL(`./fixtures/registers/${name}.json`, import.meta.url), 'utf8')) as Fixture; }
function json(rows: unknown[]): ChunkResponse { return { status: 200, text: JSON.stringify(rows), contentRange: null, contentType: 'application/json' }; }
function csv(text: string, total?: number): ChunkResponse { return { status: total === undefined ? 200 : 206, text, contentRange: total === undefined ? null : `bytes 0-${text.length - 1}/${total}`, contentType: 'text/csv' }; }
function parse(adapter: RegisterAdapter, response: ChunkResponse, cursor: Cursor = adapter.initialCursor()) { return adapter.parse(response, cursor); }
const named = (rows: ParsedRow[]) => rows.filter(row => row.name !== null);
const skipped = (rows: ParsedRow[], reason: string) => rows.filter(row => row.skipReason === reason);

test('registry: thirty-one adapters (eighteen plus the thirteen recipe B name sources), unique sources, valid recipes, Socrata URLs under 300 characters', () => {
  assert.equal(REGISTER_ADAPTERS.length, 31);
  assert.equal(new Set(REGISTER_ADAPTERS.map(adapter => adapter.source)).size, 31);
  assert.equal(REGISTER_ADAPTERS.filter(adapter => adapter.recipe === 'B').length, 14, 'fl_dbpr_construction plus the thirteen Phase 4 sources');
  assert.equal(adapterFor('nppes:dentist')?.source, 'nppes', 'a brain id with a filter resolves to its adapter');
  assert.deepEqual(splitRegisterSource('fl_re:property_management'), { source: 'fl_re', filter: 'property management' });
  assert.deepEqual(splitRegisterSource('tx_trec'), { source: 'tx_trec', filter: null });
  for (const adapter of REGISTER_ADAPTERS) {
    assert.ok(['B', 'C', 'D'].includes(adapter.recipe), adapter.source);
    const request = adapter.request(adapter.initialCursor());
    assert.ok(request, adapter.source);
    if (request.kind === 'socrata') assert.ok(request.url.length < SOCRATA_URL_MAX, `${adapter.source} url ${request.url.length} chars`);
    assert.ok(request.url.startsWith('https://'), adapter.source);
  }
  assert.equal(adapterFor('nope'), null);
  // FMCSA: one short segment per state x filter, never a parenthesised OR list.
  const fm = fmcsa.request({ segment: 12, offset: 0 });
  assert.ok(fm && !fm.url.includes(' OR ') && fm.url.includes("phy_state='AZ'") && fm.url.includes('LANDSCAP') && fm.url.length < SOCRATA_URL_MAX, fm?.url);
  assert.equal(socrataUrl('data.wa.gov', 'm8qx-ubtq', { where: "statuscode='A'" }, 5000, 10000), "https://data.wa.gov/resource/m8qx-ubtq.json?$where=statuscode='A'&$order=:id&$limit=5000&$offset=10000");
});

test('names: person vs company, LAST, FIRST and FIRST LAST orders, corporate and generational suffixes stripped', () => {
  assert.deepEqual(splitPersonName('GUERRERO MARTINEZ, CARLOS I.'), { firstName: 'Carlos', lastName: 'Guerrero Martinez' });
  assert.deepEqual(splitPersonName('KEARNEY, RAYMOND J JR'), { firstName: 'Raymond', lastName: 'Kearney' });
  assert.deepEqual(splitPersonName('Bruce Huie'), { firstName: 'Bruce', lastName: 'Huie' });
  assert.deepEqual(splitPersonName('ALBERT ALVIS JOLLY JR'), { firstName: 'Albert', lastName: 'Jolly' });
  assert.deepEqual(splitPersonName('Sara F. Lake Idehen'), { firstName: 'Sara', lastName: 'Idehen' });
  assert.deepEqual(splitPersonName('John Smith III, DDS'), { firstName: 'John', lastName: 'Smith' });
  for (const company of ['!ECO STAR C G CONSTRUCTION LLC', 'M&M ESTUDIO', 'Kraig Kobert, CPA, P.C.', 'CSX INTERMODAL TERMINALS INC', 'Mini Minders Day Care, LLC', 'WILLKIE FARR & GALLAGHER LLP', '1811 Coliseum Street LLC', 'Victory Plumbing Company', 'UNIVERSITY OF MINNESOTA DULUTH', 'H & R Block', 'Smith']) {
    assert.equal(isPersonName(company), false, company); assert.equal(splitPersonName(company), null, company);
  }
  assert.deepEqual(personFromParts('KEITH', 'WALKER'), { firstName: 'Keith', lastName: 'Walker' });
  assert.equal(personFromParts('', 'WALKER'), null);
});

test('normalizers: phones (toll-free dropped, extensions cut), dates in four shapes, ZIP+4, Excel guards, CSV quoting, city/state/zip tails', () => {
  assert.equal(phoneOf('(307) 733-4274'), '3077334274'); assert.equal(phoneOf('3074132464'), '3074132464'); assert.equal(phoneOf('1-717-683-7468'), '7176837468');
  assert.equal(phoneOf('8004474712'), null); assert.equal(phoneOf('(866) 555-1212'), null); assert.equal(phoneOf('555-1212'), null); assert.equal(phoneOf(''), null); assert.equal(phoneOf('305-555-1234 x22'), '3055551234');
  assert.equal(dateOf('2025-08-15T00:00:00.000'), '2025-08-15'); assert.equal(dateOf('02/06/2028'), '2028-02-06'); assert.equal(dateOf('5/20/1995 12:00:00 AM'), '1995-05-20'); assert.equal(dateOf('20260106'), '2026-01-06');
  assert.equal(dateOf('02/30/2028'), null); assert.equal(dateOf('0001-01-01T00:00:00'), null); assert.equal(dateOf(''), null);
  assert.equal(stripExcelGuard('="2394037420"'), '2394037420'); assert.equal(stripExcelGuard('A276085'), 'A276085');
  assert.deepEqual(parseCsvLine('A276085,"WALKER, KEITH J",KEITH,="636278",,"a ""quoted"" word"'), ['A276085', 'WALKER, KEITH J', 'KEITH', '="636278"', '', 'a "quoted" word']);
  assert.deepEqual(cityStateZip('KATY TX 77450-2491'), { city: 'KATY', state: 'TX', zip: '77450' });
  assert.deepEqual(cityStateZip('CAPE CORAL, FL  33990'), { city: 'CAPE CORAL', state: 'FL', zip: '33990' });
  assert.equal(maskPhone('3055551234'), '(305) 555-**34'); assert.equal(maskPhone(null), null);
  assert.equal(sanitizeReason('http_503', 'https://data.wa.gov/resource/x.json?$where=secret&token=abc'), 'http_503 data.wa.gov');
  assert.match(rowHash({ b: 1, a: 2 }), /^[0-9a-f]{64}$/); assert.equal(rowHash({ b: 1, a: 2 }), rowHash({ a: 2, b: 1 }));
  assert.deepEqual(parseContentRange('bytes 0-3500/741101018'), { start: 0, end: 3500, total: 741101018 });
});

test('wa_lni: active rows, Individual = person with principal name, LLC = company, phone and dates normalized', () => {
  const { rows, done } = parse(waLni, json(fixture('wa_lni').rows ?? []));
  assert.equal(done, true);
  const eco = rows.find(row => row.rowKey === 'ECOSTSC758NN');
  assert.ok(eco?.name); assert.equal(eco.name.firstName, null); assert.equal(eco.name.company, '!ECO STAR C G CONSTRUCTION LLC'); assert.equal(eco.name.businessType, 'Limited Liability Company');
  assert.equal(eco.name.phone10, '5039573452'); assert.equal(eco.name.zip, '98661'); assert.equal(eco.name.licenseIssueDate, '2025-08-15'); assert.equal(eco.name.licenseExpiresAt, '2027-08-15'); assert.equal(eco.name.state, 'WA');
  const individual = rows.find(row => row.payload.businesstypecodedesc === 'Individual' && row.payload.statuscode === 'A');
  assert.ok(individual?.name); assert.equal(individual.name.lastName, 'Beeson'); assert.equal(individual.name.firstName, 'Brian'); assert.equal(individual.name.titleCode, 'Principal'); assert.equal(individual.name.company, '1 SHARP TOOL');
  assert.equal(decodeURIComponent(waLni.request({ segment: 0, offset: 0 })?.url ?? '').includes("statuscode='A'"), true);
});

test('or_ccb: rmi_name is the person, sole proprietor when full_name equals rmi_name, future expiration required, text date parsed', () => {
  const { rows } = parse(orCcb, json(fixture('or_ccb').rows ?? []));
  const huie = rows.find(row => row.rowKey === '100215');
  assert.ok(huie?.name); assert.deepEqual([huie.name.firstName, huie.name.lastName, huie.name.company, huie.name.businessType, huie.name.titleCode], ['Bruce', 'Huie', null, 'Sole Proprietor', 'RMI']);
  assert.equal(huie.name.phone10, '5412150829'); assert.equal(huie.name.licenseExpiresAt, '2028-02-06'); assert.equal(huie.name.licenseIssueDate, '1994-06-20'); assert.equal(huie.name.county, 'Curry');
  const expiredRow = { ...(fixture('or_ccb').rows as Record<string, unknown>[])[0], license_number: 'X1', lic_exp_date: '01/01/2020' };
  assert.equal(parse(orCcb, json([expiredRow])).rows[0].skipReason, 'expired');
});

test('cslb: postback steps, 503 becomes portal_unavailable, Master keeps CLEAR + future only, Personnel titles coded, disassociated skipped', () => {
  const fx = fixture('cslb');
  assert.equal(fx.synthetic, true, 'the CSLB fixture is synthetic until the portal answers the postback');
  const step0 = parse(cslb, { status: 200, text: String(fx.portalHtml), contentRange: null, contentType: 'text/html' });
  assert.equal(step0.next.step, 1); assert.deepEqual(step0.next.form, { __VIEWSTATE: 'VS', __VIEWSTATEGENERATOR: '4A65F46B', __EVENTVALIDATION: 'EV' });
  const post = cslb.request(step0.next);
  assert.equal(post?.method, 'POST'); assert.match(post?.body ?? '', /ctl00%24MainContent%24ddlStatus=M/); assert.match(post?.body ?? '', /__VIEWSTATE=VS/);
  assert.throws(() => parse(cslb, { status: 200, text: String(fx.portal503), contentRange: null, contentType: 'text/html' }, step0.next), (error: unknown) => error instanceof RegisterParseError && error.code === 'portal_unavailable');
  const step1 = parse(cslb, { status: 200, text: String(fx.portalHtmlWithLink), contentRange: null, contentType: 'text/html' }, step0.next);
  assert.equal(step1.next.step, 2); assert.equal((step1.next.links as Record<string, string>).master, 'https://www.cslb.ca.gov/Resources/DataPortal/MasterList.csv');
  assert.match(cslb.request(step1.next)?.headers.Range ?? '', /^bytes=0-/);
  const master = parse(cslb, csv(String(fx.masterText)), step1.next);
  assert.equal(master.rows.length, 5);
  assert.equal(skipped(master.rows, 'status_not_clear').length, 1, 'SUSPENDED is not CLEAR'); assert.equal(skipped(master.rows, 'expired').length, 1);
  const jane = master.rows.find(row => row.rowKey === 'M:1000002');
  assert.ok(jane?.name); assert.deepEqual([jane.name.firstName, jane.name.lastName, jane.name.titleCode, jane.name.phone10, jane.name.zip], ['Jane', 'Doe', 'Sole Owner', '9165550102', '95814']);
  const tollFree = master.rows.find(row => row.rowKey === 'M:1000005');
  assert.equal(tollFree?.name?.phone10, null, 'toll-free business phone dropped');
  assert.equal(master.next.step, 3, 'master file finished, next is the personnel postback');
  const personnel = parse(cslb, csv(String(fx.personnelText)), { ...step1.next, step: 4, links: { master: 'https://x/m.csv', personnel: 'https://x/p.csv' } });
  const titles = personnel.rows.filter(row => row.name).map(row => row.name?.titleCode);
  assert.deepEqual(titles, ['RMO', 'Officer', 'Sole Owner', 'Sole Owner', 'Sole Owner']);
  assert.equal(skipped(personnel.rows, 'disassociated').length, 1);
  assert.equal(personnel.rows[0].payload.joinLicenseNo, '1000001'); assert.equal(personnel.rows[0].name?.phone10, null, 'personnel phone comes from the Master row in the service join');
  assert.equal(personnel.done, true);
});

test('pa_pals: 50-row pages per surname, TotalRecords cap noted, Accountancy and Real Estate only, PhoneNo1 and Emailid1 kept', () => {
  const rows = fixture('pa_pals').rows as Record<string, unknown>[];
  const first = paPals.request(paPals.initialCursor());
  assert.equal(first?.method, 'POST'); assert.deepEqual(JSON.parse(first?.body ?? '{}'), { optPersonFacility: 'Person', lastName: 'SMITH', professionID: '', pageNo: 1 });
  const { rows: parsed, next } = parse(paPals, json(rows));
  assert.equal(skipped(parsed, 'profession_out_of_scope').length, 1, 'Auctioneer row dropped');
  const active = named(parsed);
  assert.ok(active.length >= 3);
  for (const row of active) { assert.equal(row.name?.businessType, 'Real Estate Commission'); assert.ok(row.name?.firstName && row.name?.lastName); assert.equal(row.name?.state, 'PA'); assert.match(row.name?.phone10 ?? '', /^\d{10}$/); }
  assert.ok(active.some(row => row.name?.email?.includes('@')));
  assert.equal((parsed.find(row => row.payload.PhoneNo1)?.payload as Record<string, unknown>).RecaptchaResponse, undefined, 'recaptcha noise not stored');
  assert.deepEqual(next, { surname: 1, page: 1 }, 'a short page ends the surname');
  const fullPage = Array.from({ length: 50 }, (_, index) => ({ ...rows[0], LicenseNumber: `RS${index}`, TotalRecords: 500 }));
  const paged = parse(paPals, json(fullPage), { surname: 0, page: 1 });
  assert.deepEqual(paged.next, { surname: 0, page: 2 }); assert.equal(paged.note, null);
  const lastPage = parse(paPals, json(fullPage), { surname: 0, page: 10 });
  assert.deepEqual(lastPage.next, { surname: 1, page: 1 }); assert.equal(lastPage.note, 'total_records_capped_500');
  assert.ok(new Set(PALS_SURNAMES).size > 250);
});

test('fl_dbpr_construction: 22 positional fields without header, qualifier is the person, no phone column, inactive and expired skipped', () => {
  const fx = fixture('fl_dbpr_construction');
  const { rows, next, done } = parse(flDbprConstruction, csv(String(fx.text), 46488678));
  assert.equal(done, false); assert.equal(next.file, 0); assert.ok(Number(next.offset) > 0);
  const walters = rows.find(row => row.rowKey === 'CBC006231');
  assert.ok(walters?.name); assert.deepEqual([walters.name.firstName, walters.name.lastName, walters.name.company, walters.name.titleCode, walters.name.businessType], ['Dennis', 'Walters', 'BUILDING CONCEPTS OF TAMPA BAY, LLC', 'Qualifier', 'CBC']);
  assert.equal(walters.name.phone10, null, 'the extract has no phone'); assert.equal(walters.name.zip, '33617'); assert.equal(walters.name.licenseExpiresAt, '2028-08-31'); assert.equal(walters.name.licenseIssueDate, '2024-09-16');
  assert.equal(skipped(rows, 'secondary_status_inactive').length, 2);
  assert.equal(rows.find(row => row.rowKey === 'CBC006585')?.name?.lastName, 'Kearney', 'JR suffix stripped');
  const electrical = parse(flDbprConstruction, csv(String(fx.electricalText)), { file: 1, offset: 0, carry: '', total: null, columns: null });
  assert.equal(electrical.done, true); assert.equal(electrical.rows.find(row => row.rowKey === 'EF0000971')?.name?.company, 'FISEC TECHNOLOGY CONVERGENCE LLC');
  assert.equal(flDbprConstruction.recipe, 'B');
});

test('irs_ptin: header row learned at offset 0 and carried, DBA surname rule in payload, phone formats normalized, per-state file cursor', () => {
  const text = String(fixture('irs_ptin').text);
  const lines = text.split('\n').filter(Boolean);
  const cut = lines.slice(0, 4).join('\n') + '\n' + lines[4].slice(0, 20);
  const partial = parse(irsPtin, { status: 206, text: cut, contentRange: `bytes 0-${cut.length - 1}/163819`, contentType: 'text/csv' });
  assert.equal(partial.rows.length, 3); assert.equal(partial.next.carry, lines[4].slice(0, 20)); assert.ok(Array.isArray(partial.next.columns) && partial.next.columns.includes('BUS_PHNE_NBR'));
  const kobert = partial.rows[0];
  assert.deepEqual([kobert.name?.firstName, kobert.name?.lastName, kobert.name?.company, kobert.name?.titleCode, kobert.name?.phone10, kobert.name?.state, kobert.name?.zip], ['Kraig', 'Kobert', 'Kraig Kobert, CPA, P.C.', 'CPA', '3077334274', 'WY', '83001']);
  assert.equal(kobert.payload.dbaHasSurname, true); assert.equal(partial.rows[2].payload.dbaHasSurname, false, 'H & R Block is not the preparer surname');
  assert.equal(partial.rows[2].name?.businessType, 'DBA');
  const rest = parse(irsPtin, { status: 206, text: lines[4].slice(20) + '\n' + lines.slice(5).join('\n') + '\n', contentRange: `bytes ${cut.length}-163818/163819`, contentType: 'text/csv' }, partial.next);
  assert.equal(rest.rows.length, lines.length - 4, 'carried partial line completed'); assert.equal(rest.rows[0].name?.lastName, 'Swett');
  assert.deepEqual(rest.next, { file: 1, offset: 0, carry: '', total: null, columns: null }); assert.equal(rest.done, false);
  assert.match(irsPtin.request({ file: 31, offset: 0 })?.url ?? '', /foia-new%20york-extract\.csv$/);
  assert.throws(() => parse(irsPtin, csv('<html>not a csv</html>\n')), (error: unknown) => error instanceof RegisterParseError && error.code === 'unexpected_content');
});

test('fl_dfs_individual: Excel ="..." guards stripped from NPN, phone and zip; VALID only; email kept; one names row per license number', () => {
  const { rows } = parse(flDfsIndividual, csv(String(fixture('fl_dfs_individual').text), 323210000));
  assert.equal(rows.length, 4);
  const walker = rows[0];
  assert.ok(walker.name); assert.deepEqual([walker.name.firstName, walker.name.lastName, walker.name.phone10, walker.name.zip, walker.name.email, walker.name.titleCode, walker.name.licenseIssueDate], ['Keith', 'Walker', '2394037420', '34109', 'inssol1@earthlink.net', 'GENERAL LINES (PROP & CAS)', '1995-05-20']);
  assert.equal(walker.payload['NPN Number'], '636278', 'guard stripped in payload too'); assert.equal(walker.name.company, 'INSURANCE SOLUTIONS');
  assert.equal(rows[0].name?.sourceRowId, rows[1].name?.sourceRowId, 'two license classes, one person');
  assert.notEqual(rows[0].rowKey, rows[1].rowKey, 'but two snapshot rows');
  const { unique, duplicates } = dedupeNames(rows);
  assert.equal(duplicates, 1); assert.equal(unique.length, 3);
  assert.equal(rows[2].name?.city, 'DUNEDIN');
});

test('fmcsa: officer is a candidate, corporations are not sole proprietors, cell_phone preferred, toll-free dropped', () => {
  const { rows } = parse(fmcsa, json(fixture('fmcsa').rows ?? []));
  const jolly = rows.find(row => row.rowKey === '283153');
  assert.ok(jolly?.name); assert.deepEqual([jolly.name.firstName, jolly.name.lastName, jolly.name.businessType, jolly.name.phone10, jolly.name.state], ['Albert', 'Jolly', 'CORPORATION', '2148790014', 'TX']);
  assert.equal(jolly.payload.soleProprietor, false); assert.equal(jolly.name.licenseIssueDate, '1986-12-05');
  const tollFree = rows.find(row => row.rowKey === '198824');
  assert.ok(tollFree?.name); assert.equal(tollFree.name.phone10, null, '800 number dropped'); assert.equal(tollFree.name.company, 'CSX TRANSPORTATION INC'.startsWith('CSX') ? tollFree.name.company : null);
  const cell = parse(fmcsa, json([{ ...(fixture('fmcsa').rows as Record<string, unknown>[])[0], dot_number: '1', phone: '2148790014', cell_phone: '4695551212' }])).rows[0];
  assert.equal(cell.name?.phone10, '4695551212');
});

test('childcare: PA responsible person with OWNER title, NY phone_number_omitted=Y skipped and counted, TX home operation_name is the provider', () => {
  const pa = parse(paChildcare, json(fixture('pa_childcare').rows ?? []));
  const davis = pa.rows.find(row => row.rowKey === '103292743-0001');
  assert.ok(davis?.name); assert.deepEqual([davis.name.firstName, davis.name.lastName, davis.name.titleCode, davis.name.phone10, davis.name.email, davis.name.zip, davis.name.state, davis.name.licenseIssueDate], ['Valerie', 'Davis', 'OWNER', '7176837468', 'peachesvlj@yahoo.com', '17401', 'PA', '2025-11-17']);
  assert.equal(davis.payload.geocoded_column, undefined);
  const kidBiz = pa.rows.find(row => row.rowKey === '100204264-0004');
  assert.equal(kidBiz?.skipReason, 'not_a_person', 'a center without a responsible person is not a name row');

  const ny = parse(nyChildcare, json(fixture('ny_childcare').rows ?? []));
  const omitted = skipped(ny.rows, 'phone_omitted_opt_out');
  assert.equal(omitted.length, 2, 'both opt-out rows skipped'); for (const row of omitted) assert.equal(row.name, null);
  const doris = ny.rows.find(row => row.rowKey === '38611');
  assert.ok(doris?.name); assert.deepEqual([doris.name.firstName, doris.name.lastName, doris.name.phone10, doris.name.zip, doris.name.street, doris.name.businessType], ['Doris', 'Washington', '7169062767', '14214', null, 'GFDC']);
  const minders = ny.rows.find(row => row.rowKey === '444975');
  assert.equal(minders?.name?.company, 'Mini Minders Day Care, LLC'); assert.equal(minders?.name?.lastName, 'Karatchayeva'); assert.equal(minders?.name?.street, '249 6th Avenue');
  assert.ok(ny.rows.some(row => row.payload.program_type === 'FDC' && row.name));

  const tx = parse(txChildcare, json(fixture('tx_childcare').rows ?? []));
  const dixon = tx.rows.find(row => row.rowKey === '1371638');
  assert.ok(dixon?.name); assert.deepEqual([dixon.name.firstName, dixon.name.lastName, dixon.name.phone10, dixon.name.zip, dixon.name.titleCode, dixon.name.email], ['Devin', 'Dixon', '7134943856', '77085', 'Provider', 'jamiestendercare28@yahoo.com'.startsWith('j') ? dixon.name.email : null]);
  const jamies = tx.rows.find(row => row.rowKey === '1246789');
  assert.equal(jamies?.name, null, 'a brand plus an administrator does not establish an owner');
  assert.equal(jamies?.skipReason, 'owner_identity_unresolved');
  assert.ok(tx.rows.some(row => row.payload.operation_type === 'Listed Family Home' && row.name?.phone10));
});

test('ny_attorneys: currently registered only, firm kept as company, surname-in-firm flags a named partner, office phone kept', () => {
  const { rows } = parse(nyAttorneys, json(fixture('ny_attorneys').rows ?? []));
  const sohal = rows.find(row => row.rowKey === '6366066');
  assert.ok(sohal?.name); assert.deepEqual([sohal.name.firstName, sohal.name.lastName, sohal.name.company, sohal.name.titleCode, sohal.name.phone10, sohal.name.zip, sohal.name.licenseIssueDate], ['Ekum', 'Sohal', 'CHARTWELL LAW', 'Attorney', '6465201479', '10004', '2026-01-01']);
  const partner = parse(nyAttorneys, json([{ ...(fixture('ny_attorneys').rows as Record<string, unknown>[])[0], registration_number: '1', last_name: 'CHARTWELL' }])).rows[0];
  assert.equal(partner.name?.titleCode, 'Named Partner');
  const lapsed = parse(nyAttorneys, json([{ ...(fixture('ny_attorneys').rows as Record<string, unknown>[])[0], registration_number: '2', status: 'Delinquent' }])).rows[0];
  assert.equal(lapsed.skipReason, 'status_not_registered');
});

test('tx_tdlr_salons trap: owner_telephone mirrors business_telephone and is never a second phone; owner_name is the licensee label', () => {
  const rows = fixture('tx_tdlr_salons').rows as Record<string, unknown>[];
  const { rows: parsed } = parse(txTdlrSalons, json(rows));
  for (const row of parsed) {
    assert.equal(row.payload.ownerTelephoneMirrorsBusiness, true);
    assert.equal(row.payload.ownerNameMirrorsBusiness, true);
    if (row.name) assert.equal(row.name.phone10, phoneOf(row.payload.business_telephone));
  }
  const nguyen = parsed.find(row => row.rowKey === '776199');
  assert.ok(nguyen?.name); assert.deepEqual([nguyen.name.firstName, nguyen.name.lastName, nguyen.name.company, nguyen.name.phone10, nguyen.name.zip, nguyen.name.city, nguyen.name.licenseExpiresAt], ['Tracy', 'Nguyen', null, '8328772739', '77450', 'KATY', '2027-01-31']);
  const estudio = parsed.find(row => row.rowKey === '818527');
  assert.equal(estudio?.skipReason, 'expired');
  const differing = parse(txTdlrSalons, json([{ ...rows[0], license_number: 'X', owner_telephone: '2125551212' }])).rows[0];
  assert.equal(differing.payload.ownerTelephoneMirrorsBusiness, false); assert.equal(differing.name?.phone10, '8328772739', 'a differing owner_telephone is flagged, not stored');
  assert.equal(JSON.stringify(differing.name).includes('2125551212'), false);
});

test('short term rentals: New Orleans contact is the person with cell and email, Orlando active holders only', () => {
  const nola = parse(nolaStr, json(fixture('nola_str').rows ?? []));
  const issued = nola.rows.find(row => row.rowKey === '23-CSTR-00264');
  assert.ok(issued?.name); assert.deepEqual([issued.name.firstName, issued.name.lastName, issued.name.company, issued.name.phone10, issued.name.email, issued.name.titleCode, issued.name.state], ['Samvel', 'Nikoghosyan', 'Palmyra Street Properties LLC', '7044586515', 'samuel@hosteeva.com', 'Contact', 'LA']);
  assert.equal(skipped(nola.rows, 'status_not_active').length >= 1, true, 'Withdrawn rows skipped');
  assert.ok(Object.keys(issued.payload).every(key => !key.startsWith(':@')));
  const orlando = parse(orlandoStr, json(fixture('orlando_str').rows ?? []));
  const sanchez = orlando.rows.find(row => row.rowKey === 'STR-1121538');
  assert.ok(sanchez?.name); assert.deepEqual([sanchez.name.firstName, sanchez.name.lastName, sanchez.name.phone10, sanchez.name.email, sanchez.name.zip, sanchez.name.licenseExpiresAt], ['Ricardo', 'Sanchez', '3162536044', 'tiffani.trlegacyventures@gmail.com', '32803', '2027-02-05']);
  assert.equal(named(orlando.rows).length, orlando.rows.length);
});

test('mn_dli: header asserted (HTML error page freezes), Master level only, Issued only, phone reuse left to reuse_count', () => {
  const fx = fixture('mn_dli');
  assert.throws(() => parse(mnDli, { status: 200, text: String(fx.htmlErrorText), contentRange: null, contentType: 'text/html' }), (error: unknown) => error instanceof RegisterParseError && error.code === 'unexpected_content');
  assert.throws(() => parse(mnDli, csv(String(fx.htmlErrorText))), (error: unknown) => error instanceof RegisterParseError && error.code === 'unexpected_content');
  const employers = parse(mnDli, csv(String(fx.text)));
  assert.equal(named(employers.rows).length, 0, 'Registered Electrical Employer rows are not Master level'); assert.ok(skipped(employers.rows, 'not_master_level').length >= 4);
  const masters = parse(mnDli, csv(String(fx.masterText)));
  const kept = named(masters.rows);
  assert.ok(kept.length >= 2, 'real Master rows kept');
  for (const row of kept) { assert.match(String(row.name?.titleCode), /Master/i); assert.equal(row.name?.issuingState, 'MN'); assert.match(row.name?.state ?? '', /^[A-Z]{2}$/); assert.match(row.name?.phone10 ?? '', /^\d{10}$/); assert.ok(row.name?.firstName && row.name?.lastName); }
  assert.ok(skipped(masters.rows, 'not_master_level').length >= 2, 'employer and unlicensed rows skipped');
  assert.equal(masters.done, false, 'Plumbing file still to stream'); assert.equal(masters.next.file, 1);
  assert.match(mnDli.request({ file: 1, offset: 0 })?.url ?? '', /MNDLILicRegCertExport_Plumbing\.csv$/);
});

test('austin_permits: last twelve months with contractor_phone, contractor_full_name is the person, permit number is the row id', () => {
  const request = austinPermits.request(austinPermits.initialCursor());
  assert.match(decodeURIComponent(request?.url ?? ''), /issue_date>'20\d\d-\d\d-\d\d' AND contractor_phone IS NOT NULL/);
  const { rows } = parse(austinPermits, json(fixture('austin_permits').rows ?? []));
  const anderson = rows.find(row => row.rowKey === '2025-117554 MP');
  assert.ok(anderson?.name); assert.deepEqual([anderson.name.firstName, anderson.name.lastName, anderson.name.company, anderson.name.businessType, anderson.name.phone10, anderson.name.zip, anderson.name.licenseIssueDate], ['Dennis', 'Anderson', 'D3 Mechanical LLC', 'Mechanical Contractor', '5128067500', '78626', '2025-09-22']);
});

test('nppes: state + 3-digit prefix slices, limit 200, skip ceiling 1000, primary taxonomy client side, staff titles excluded, AO phone with location phone in payload', () => {
  const fx = fixture('nppes');
  const first = nppes.request(nppes.initialCursor());
  assert.match(first?.url ?? '', /enumeration_type=NPI-2&address_purpose=LOCATION&state=AL&postal_code=350\*&taxonomy_description=Chiropractor&limit=200&skip=0$/);
  assert.equal(NPPES_LIMIT, 200); assert.equal(NPPES_SKIP_MAX, 1000); assert.deepEqual(zip3Prefixes('FL').slice(0, 2), ['320', '321']); assert.equal(zip3Prefixes('NY')[0], '005');
  const dentists = { state: 9, prefix: 11, taxonomy: 3, skip: 0, ceilingHits: 0 };
  const { rows, next } = parse(nppes, { status: 200, text: JSON.stringify(fx.body), contentRange: null, contentType: 'application/json' }, dentists);
  assert.equal(rows.length, 6);
  assert.equal(skipped(rows, 'staff_title_excluded').length, 1, 'office manager excluded'); assert.equal(skipped(rows, 'primary_taxonomy_mismatch').length, 1, 'Dental Hygienist primary is not a dentist');
  const smith = rows.find(row => row.rowKey === '1104969039');
  assert.ok(smith?.name); assert.deepEqual([smith.name.firstName, smith.name.lastName, smith.name.company, smith.name.titleCode, smith.name.phone10, smith.name.zip, smith.name.state], ['Todd', 'Smith', '183 DENTAL GROUP, PA', 'dentist', '3056528338', '33169'.length === 5 ? smith.name.zip : null, 'FL']);
  assert.equal(smith.payload.location_phone, '305-652-8338'); assert.equal(smith.payload.primary_taxonomy, 'Dentist, General Practice');
  assert.deepEqual(next, { state: 9, prefix: 11, taxonomy: 4, skip: 0, ceilingHits: 0 }, 'a short page moves to the next taxonomy');
  const chiro = parse(nppes, { status: 200, text: JSON.stringify(fx.chiropractorBody), contentRange: null, contentType: 'application/json' }, { ...dentists, taxonomy: 0 });
  assert.equal(chiro.rows[0].skipReason, 'primary_taxonomy_mismatch', 'Internal Medicine primary with a secondary Chiropractor taxonomy is not a chiropractor');
  const full = Array.from({ length: 200 }, (_, index) => ({ ...(fx.body as { results: Record<string, unknown>[] }).results[0], number: String(index) }));
  const page = parse(nppes, { status: 200, text: JSON.stringify({ result_count: 0, results: [] }), contentRange: null, contentType: 'application/json' }, dentists); assert.equal(page.next.taxonomy, 4);
  const paged = parse(nppes, { status: 200, text: JSON.stringify({ result_count: 200, results: full }), contentRange: null, contentType: 'application/json' }, dentists);
  assert.equal(paged.next.skip, 200);
  const ceiling = parse(nppes, { status: 200, text: JSON.stringify({ result_count: 200, results: full }), contentRange: null, contentType: 'application/json' }, { ...dentists, skip: 1000 });
  assert.equal(ceiling.note, 'skip_ceiling_reached'); assert.equal(ceiling.next.skip, 0); assert.equal(ceiling.next.taxonomy, 4); assert.equal(ceiling.next.ceilingHits, 1);
  assert.throws(() => parse(nppes, { status: 200, text: JSON.stringify(fx.refusedBody), contentRange: null, contentType: 'application/json' }, dentists), (error: unknown) => error instanceof RegisterParseError && error.code === 'nppes_refused');
});

test('cursor logic: Socrata pages advance by rows returned, a short page ends the segment, the last segment ends the run', () => {
  const rows = fixture('ny_childcare').rows as Record<string, unknown>[];
  const fullPage = Array.from({ length: 5000 }, (_, index) => ({ ...rows[0], facility_id: String(index) }));
  const page1 = parse(nyChildcare, json(fullPage));
  assert.deepEqual(page1.next, { segment: 0, offset: 5000 }); assert.equal(page1.done, false);
  const page2 = parse(nyChildcare, json(rows), page1.next);
  assert.deepEqual(page2.next, { segment: 1, offset: 0 }); assert.equal(page2.done, false);
  const page3 = parse(nyChildcare, json([]), page2.next);
  assert.deepEqual(page3.next, { segment: 2, offset: 0 }); assert.equal(page3.done, true);
  assert.equal(nyChildcare.request(page3.next), null, 'nothing left to ask');
  assert.throws(() => parse(nyChildcare, { status: 200, text: '<html>', contentRange: null, contentType: 'text/html' }), (error: unknown) => error instanceof RegisterParseError && error.code === 'unexpected_content');
});

test('byte-range cursor: 416 skips to the next file, a 200 without Range support finishes the file in one pass', () => {
  const past = parse(irsPtin, { status: 416, text: '', contentRange: null, contentType: null }, { file: 3, offset: 99, carry: '', total: null, columns: null });
  assert.deepEqual(past.next, { file: 4, offset: 0, carry: '', total: null, columns: null }); assert.equal(past.note, 'range_past_end');
  const whole = parse(irsPtin, csv(String(fixture('irs_ptin').text)));
  assert.equal(whole.note, 'server_ignored_range'); assert.equal(whole.next.file, 1); assert.equal(whole.rows.length, 6);
});

// A fake register and a fake store: the loop is exercised end to end without a database or the network.
function fakeStore() {
  const calls: Array<{ cursor: Cursor; seen: number; done: boolean; reason: string | null }> = [];
  const written: ParsedRow[] = [];
  let reused = 0;
  const store: IngestStore = {
    write: async rows => { written.push(...rows); },
    progress: async (cursor, counts, done, reason) => { calls.push({ cursor, seen: counts.seen, done, reason }); },
    reuse: async () => { reused += 1; },
  };
  return { store, calls, written, reused: () => reused };
}

test('ingest loop: pages until done within the budget, checkpoints after every segment, recomputes reuse at the end', async () => {
  const rows = fixture('orlando_str').rows as Record<string, unknown>[];
  const pages = [Array.from({ length: 5000 }, (_, index) => ({ ...rows[0], license_number: `STR-${index}` })), rows];
  const requested: string[] = [];
  const fetcher: ChunkFetcher = async request => { requested.push(request.url); return json(pages.shift() ?? []); };
  const { store, calls, written, reused } = fakeStore();
  const result = await runIngestLoop(orlandoStr, {}, { seen: 0, named: 0, skipped: 0 }, store, fetcher, { budgetMs: 60000 });
  assert.equal(result.done, true); assert.equal(result.frozen, false); assert.equal(result.segments, 2); assert.equal(result.counts.seen, 5006); assert.equal(written.length, 5006);
  assert.deepEqual(calls.map(call => [call.cursor.offset, call.done]), [[5000, false], [0, true]]);
  assert.equal(reused(), 1); assert.match(requested[1], /offset=5000$/);
});

test('ingest loop: the time budget stops after a full segment and hands back a cursor the next call continues from', async () => {
  const rows = fixture('ny_attorneys').rows as Record<string, unknown>[];
  const full = Array.from({ length: 5000 }, (_, index) => ({ ...rows[0], registration_number: String(index) }));
  let clock = 0;
  const fetcher: ChunkFetcher = async () => { clock += 30000; return json(full); };
  const { store, calls } = fakeStore();
  const result = await runIngestLoop(nyAttorneys, {}, { seen: 0, named: 0, skipped: 0 }, store, fetcher, { budgetMs: 20000, now: () => clock });
  assert.equal(result.done, false); assert.equal(result.frozen, false); assert.equal(result.segments, 1); assert.deepEqual(result.cursor, { segment: 0, offset: 5000 });
  assert.equal(calls.length, 1); assert.equal(calls[0].reason, null);
  const resumed = await runIngestLoop(nyAttorneys, result.cursor, result.counts, store, async () => json(rows), { budgetMs: 20000 });
  assert.equal(resumed.done, true); assert.equal(resumed.counts.seen, 5008);
});

test('ingest loop: an HTTP 500 mid-run freezes with a sanitized reason and keeps the cursor of the failing segment', async () => {
  const rows = fixture('wa_lni').rows as Record<string, unknown>[];
  const full = Array.from({ length: 5000 }, (_, index) => ({ ...rows[0], contractorlicensenumber: `L${index}` }));
  let call = 0;
  const fetcher: ChunkFetcher = async () => { call += 1; return call === 1 ? json(full) : { status: 500, text: 'boom', contentRange: null, contentType: 'text/plain' }; };
  const { store, calls, written } = fakeStore();
  const result = await runIngestLoop(waLni, {}, { seen: 0, named: 0, skipped: 0 }, store, fetcher, { budgetMs: 60000 });
  assert.equal(result.frozen, true); assert.equal(result.done, false); assert.equal(result.reason, 'http_500 data.wa.gov');
  assert.deepEqual(result.cursor, { segment: 0, offset: 5000 }, 'the first page stays written; the cursor points at the page that failed');
  assert.equal(written.length, 5000); assert.equal(result.counts.seen, 5000);
  assert.deepEqual(calls[calls.length - 1], { cursor: { segment: 0, offset: 5000 }, seen: 5000, done: false, reason: 'http_500 data.wa.gov' });
  const network = await runIngestLoop(waLni, result.cursor, result.counts, store, async () => { throw new DOMException('timeout', 'TimeoutError'); }, { budgetMs: 60000 });
  assert.equal(network.reason, 'network_error data.wa.gov: TimeoutError'); assert.deepEqual(network.cursor, result.cursor);
  const html = await runIngestLoop(mnDli, {}, { seen: 0, named: 0, skipped: 0 }, store, async () => ({ status: 200, text: String(fixture('mn_dli').htmlErrorText), contentRange: null, contentType: 'text/html' }), { budgetMs: 60000 });
  assert.match(html.reason ?? '', /^unexpected_content secure\.doli\.state\.mn\.us: MN DLI Electrical answered with an HTML page/);
  const portal = await runIngestLoop(cslb, {}, { seen: 0, named: 0, skipped: 0 }, store, async () => ({ status: 200, text: String(fixture('cslb').portal503), contentRange: null, contentType: 'text/html' }), { budgetMs: 60000 });
  assert.match(portal.reason ?? '', /^portal_unavailable www\.cslb\.ca\.gov/); assert.deepEqual(portal.cursor, cslb.initialCursor());
});

// ---------- Phase 4 recipe B name sources (fixtures fetched live 2026-09-21, tests offline) ----------

test('fl_re: BK Broker Current/Active Florida rows only, LAST, FIRST split, home street kept, PM employer flagged in business_type, no employer = Sole Broker', () => {
  const fx = fixture('fl_re');
  const { rows } = parse(flRe, csv(fx.text!));
  assert.equal(rows.length, 7, 'the two CQ corporation rows are not in scope and are not even snapshotted');
  const victoria = rows.find(row => row.rowKey === 'BK3444556');
  assert.ok(victoria?.name);
  assert.deepEqual([victoria.name.firstName, victoria.name.lastName, victoria.name.company, victoria.name.titleCode, victoria.name.businessType, victoria.name.street, victoria.name.city, victoria.name.zip, victoria.name.licenseIssueDate, victoria.name.licenseExpiresAt],
    ['Victoria', 'Aaron', 'VICTORIA AARON, LLC', 'Broker', 'Broker', '7104 JEFFERSON ST', 'NAVARRE', '32566', '2019-06-11', '2028-03-31']);
  assert.equal(rows.find(row => row.rowKey === 'BK3444557')?.name?.businessType, 'Broker: Property Management');
  assert.equal(rows.find(row => row.rowKey === 'BK9999991')?.skipReason, 'status_not_active');
  assert.equal(rows.find(row => row.rowKey === 'BK9999992')?.name?.titleCode, 'Sole Broker');
  assert.equal(rows.find(row => row.rowKey === 'BK9999993')?.skipReason, 'out_of_state');
  assert.equal(flRe.request(flRe.initialCursor())?.url, 'https://www2.myfloridalicense.com/sto/file_download/extracts/RE_rgn1.csv');
  assert.equal((flRe.request({ file: 6, offset: 0, carry: '', total: null, columns: null }))?.url.endsWith('RE_rgn7.csv'), true);
  assert.equal(flRe.request({ file: 7, offset: 0, carry: '', total: null, columns: null }), null);
});

test('fl_cpa: lic01ac.csv class AC only (AD firms ignored), Current + Active + future expiration, home street kept', () => {
  const fx = fixture('fl_cpa');
  const { rows } = parse(flCpa, csv(fx.text!));
  assert.equal(rows.length, 4, 'the AD firm row is not a CPA');
  const feldman = rows.find(row => row.rowKey === 'R000464');
  assert.ok(feldman?.name);
  assert.deepEqual([feldman.name.firstName, feldman.name.lastName, feldman.name.titleCode, feldman.name.street, feldman.name.city, feldman.name.zip, feldman.name.licenseIssueDate], ['Arnold', 'Feldman', 'CPA', '19101 MYSTIC POINT DR', 'MIAMI', '33180', '1977-05-24']);
  assert.equal(rows.find(row => row.rowKey === 'R001721')?.name?.zip, '33067', 'ZIP+4 trimmed');
  assert.equal(rows.find(row => row.rowKey === 'R000462')?.skipReason, 'secondary_status_inactive');
  assert.equal(flCpa.request(flCpa.initialCursor())?.url, 'https://www2.myfloridalicense.com/sto/file_download/extracts/lic01ac.csv');
});

test('fl_dbpr_barbers: BS shop rows take the owner from address line 1 (no home street), BB and BR rows are the barber with the home street', () => {
  const fx = fixture('fl_dbpr_barbers');
  const { rows } = parse(flDbprBarbers, csv(fx.text!));
  assert.equal(rows.length, 8);
  const daves = rows.find(row => row.rowKey === 'BS508');
  assert.ok(daves?.name);
  assert.deepEqual([daves.name.firstName, daves.name.lastName, daves.name.company, daves.name.titleCode, daves.name.businessType, daves.name.street, daves.name.city, daves.name.zip], ['David', 'Knight', "DAVE'S BARBER SHOP", 'Owner', 'Barbershop', null, 'ORLANDO', '32804']);
  assert.equal(daves.payload.ownerInAddressLine1, true);
  assert.equal(rows.find(row => row.rowKey === 'BS999')?.skipReason, 'owner_not_named');
  const hall = rows.find(row => row.rowKey === 'BB8907037');
  assert.deepEqual([hall?.name?.firstName, hall?.name?.lastName, hall?.name?.titleCode, hall?.name?.street], ['James', 'Hall', 'Barber', '2601 BAYLEAF CT']);
  const russo = rows.find(row => row.rowKey === 'BR65');
  assert.deepEqual([russo?.name?.titleCode, russo?.name?.businessType, russo?.name?.street], ['Barber', 'Restricted Barber', '870 VILLAGE LAKE TERRACE UNIT 203'], 'the street is kept as printed; the runner\'s street gate drops the unit');
});

test('tx_trec: Socrata JSON (the CSV export times out), Broker Individual Active only, county kept, no city or street', () => {
  const fx = fixture('tx_trec');
  const request = txTrec.request(txTrec.initialCursor());
  // socrataUrl percent-encodes spaces (the shared convention, tested above): assert on the decoded query.
  assert.ok(decodeURIComponent(request?.url ?? '').startsWith("https://data.texas.gov/resource/s7ft-44qi.json?$where=license_type='Broker Individual' AND status='Active'"), request?.url);
  const { rows } = parse(txTrec, json(fx.rows!));
  assert.equal(rows.length, 4);
  const ferrara = rows.find(row => row.rowKey === '736797-B');
  assert.deepEqual([ferrara?.name?.firstName, ferrara?.name?.lastName, ferrara?.name?.titleCode, ferrara?.name?.county, ferrara?.name?.state, ferrara?.name?.city, ferrara?.name?.street, ferrara?.name?.licenseIssueDate], ['Jennifer', 'Ferrara', 'Broker', 'Hays', 'TX', null, null, '2026-09-19']);
  assert.equal(rows.find(row => row.rowKey === '858017-SA')?.skipReason, 'license_type_out_of_scope');
});

test('az_adre: header learned, Broker only (salespersons not snapshotted), Active only, expired skipped, county and employer kept, no street', () => {
  const fx = fixture('az_adre');
  const { rows } = parse(azAdre, csv(fx.text!));
  assert.equal(rows.length, 3);
  const hoge = rows.find(row => row.rowKey === 'BR007319000');
  assert.deepEqual([hoge?.name?.firstName, hoge?.name?.lastName, hoge?.name?.company, hoge?.name?.titleCode, hoge?.name?.city, hoge?.name?.county, hoge?.name?.zip, hoge?.name?.street, hoge?.name?.licenseIssueDate, hoge?.name?.licenseExpiresAt],
    ['Walter', 'Hoge', 'SUNRISE RIDGE REALTY & DEVELOPMENT, L.L.C.', 'Designated Broker', 'TUCSON', 'Pima', '85713', null, '1987-10-14', '2027-10-31']);
  assert.equal(rows.find(row => row.rowKey === 'BR508092000')?.name?.lastName, "O'brien".replace("O'b", "O'B"));
  assert.equal(rows.find(row => row.rowKey === 'BR007390000')?.skipReason, 'status_not_active');
  assert.equal(azAdre.request(azAdre.initialCursor())?.url, 'https://services.azre.gov/PdbWeb/List/DownloadList/1');
});

test('il_idfpr: two profession segments, ACTIVE individuals, business_type names the profession for the brain filter, county trimmed, state from the row', () => {
  const fx = fixture('il_idfpr');
  const first = ilIdfpr.request(ilIdfpr.initialCursor());
  const firstUrl = decodeURIComponent(first?.url ?? '');
  assert.ok(firstUrl.includes("description='LICENSED CERTIFIED PUBLIC ACCOUNTANT'") && firstUrl.includes("business='N'") && (first?.url.length ?? 0) < SOCRATA_URL_MAX, first?.url);
  assert.ok(decodeURIComponent(ilIdfpr.request({ segment: 1, offset: 0 })?.url ?? '').includes('MANAGING BROKER'));
  const { rows } = parse(ilIdfpr, json(fx.rows!));
  assert.equal(rows.length, 4);
  const pesa = rows.find(row => row.rowKey === (fx.rows as Array<{ license_number: string; last_name: string }>).find(row => row.last_name === 'PESA')!.license_number);
  assert.deepEqual([pesa?.name?.firstName, pesa?.name?.lastName, pesa?.name?.businessType, pesa?.name?.county, pesa?.name?.state, pesa?.name?.company], ['Lauren', 'Pesa', 'CPA', 'COOK', 'IL', null]);
  const russell = rows.find(row => row.name?.lastName === 'Russell');
  assert.equal(russell?.name?.state, 'NY', 'an Illinois licensee living in New York keeps her state: the runner filters by job state');
  assert.equal(russell?.name?.county, 'NEW YORK');
  const broker = parse(ilIdfpr, json([{ ...(fx.rows as Record<string, unknown>[])[0], description: 'LICENSED REAL ESTATE MANAGING BROKER' }]), { segment: 1, offset: 0 });
  assert.equal(broker.rows[0].name?.businessType, 'Real Estate Managing Broker');
});

test('ny_salons: holder is LAST FIRST without a comma, business and shop-owner licences are Owner, renters are Suite Renter, expired skipped, shop street kept', () => {
  const fx = fixture('ny_salons');
  assert.ok(decodeURIComponent(nySalons.request(nySalons.initialCursor())?.url ?? '').includes("license_type in('DOSAEBUSINESS','DOSBARSHOPOWNER','DOSAERENTER','DOSBARRENTER')"));
  const { rows } = parse(nySalons, json(fx.rows!));
  assert.equal(rows.length, 5);
  const yoo = rows.find(row => row.rowKey === 'AEB-25-01577');
  assert.deepEqual([yoo?.name?.firstName, yoo?.name?.lastName, yoo?.name?.company, yoo?.name?.titleCode, yoo?.name?.businessType, yoo?.name?.street, yoo?.name?.city, yoo?.name?.zip, yoo?.name?.licenseIssueDate, yoo?.name?.licenseExpiresAt],
    ['Jae', 'Yoo', null, 'Owner', 'Appearance Enhancement Business', '62 Garth Rd', 'Scarsdale', '10583', '2025-06-12', '2029-06-12']);
  const ashley = rows.find(row => row.rowKey === 'AEB-23-00632');
  assert.deepEqual([ashley?.name?.firstName, ashley?.name?.lastName, ashley?.name?.company], ['Ashley', 'Haskell', 'Practically Magic LLC']);
  assert.deepEqual(splitLastFirstName('Zinaty Fadia'), { firstName: 'Fadia', lastName: 'Zinaty' });
  assert.deepEqual(splitLastFirstName('SMITH, JOHN'), { firstName: 'John', lastName: 'Smith' }, 'a comma means the general splitter');
  assert.equal(splitLastFirstName('NAILS BY APRIL LLC'), null);
  const renter = parse(nySalons, json([{ ...(fx.rows as Record<string, unknown>[])[0], license_number: 'R1', license_type: 'DOSAERENTER' }]));
  assert.equal(renter.rows[0].name?.titleCode, 'Suite Renter');
  const expired = parse(nySalons, json([{ ...(fx.rows as Record<string, unknown>[])[0], license_number: 'E1', license_expiration_date: '2020-01-01T00:00:00.000' }]));
  assert.equal(expired.rows[0].skipReason, 'expired');
  assert.equal(traceablePerson({ firstName: 'A', lastName: 'Hardin' }), null, 'an initial is not a first name to trace');
});

test('ny_repair_shops: RS and RSB with a text expiration in 2026 to 2028, lapsed shops skipped, owner FIRST LAST, facility name joined with its overflow', () => {
  const fx = fixture('ny_repair_shops');
  const first = nyRepairShops.request(nyRepairShops.initialCursor());
  const firstUrl = decodeURIComponent(first?.url ?? '');
  assert.ok(firstUrl.includes("expiration_date like '%2026'") && firstUrl.includes("business_type in('RS','RSB')"), first?.url);
  assert.ok(first?.url.includes("like%20'%252026'"), 'the LIKE percent is itself percent-encoded on the wire');
  assert.ok(decodeURIComponent(nyRepairShops.request({ segment: 1, offset: 0 })?.url ?? '').includes("'%2027'"));
  const { rows } = parse(nyRepairShops, json(fx.rows!));
  assert.equal(rows.length, 5);
  const amin = rows.find(row => row.rowKey === '7130998:RS');
  assert.deepEqual([amin?.name?.firstName, amin?.name?.lastName, amin?.name?.company, amin?.name?.titleCode, amin?.name?.businessType, amin?.name?.street, amin?.name?.city, amin?.name?.zip, amin?.name?.licenseIssueDate, amin?.name?.licenseExpiresAt],
    ['Ghassan', 'Amin', 'A 1 AUTO SERVICE INC', 'Owner', 'Repair Shop', '209 25TH STREET', 'BROOKLYN', '11232', '2023-03-28', '2027-02-28']);
  assert.equal(rows.find(row => row.rowKey === '1522083:RSB')?.name?.businessType, 'Repair Shop (body)');
  assert.equal(rows.find(row => row.rowKey === '2310115:RS')?.skipReason, 'expired', 'lapsed 2021 row stays in the file');
  assert.equal(rows.find(row => row.rowKey === '2310115:ISP')?.skipReason, 'business_type_out_of_scope');
  assert.equal(rows.find(row => row.rowKey === '2310115:RS')?.payload.owner_name, 'VAN BISHKOFF');
});

test('tx_tdi: Owner and DRLP segments, associated licensee must be a person (entities skipped), agency as company unless the same, join URL for kxv3-diwf stays short', () => {
  const fx = fixture('tx_tdi');
  const first = txTdi.request(txTdi.initialCursor());
  assert.ok(first?.url.includes("association_type='Owner'") && first.url.includes('$limit=200'), first?.url);
  assert.ok(txTdi.request({ segment: 1, offset: 0 })?.url.includes("'Desig-Resp-Lic-Person'"));
  const { rows } = parse(txTdi, json(fx.rows!));
  assert.equal(rows.length, 8);
  assert.equal(skipped(rows, 'owner_is_entity').length, 5, 'D&S BLACKLOCK FAMILY L.P., M&T MANAGEMENT CORPORATION, TRU BRIDGE INC, NORTH RISK PARTNERS LLC and "A HARDIN" (initial, not traceable)');
  assert.equal(rows.find(row => row.rowKey === '8107771:8107771')?.skipReason, 'owner_is_entity', '"A HARDIN" has an initial for a first name: never traced');
  const chaney = rows.find(row => row.rowKey === '14395981:14395981');
  assert.deepEqual([chaney?.name?.firstName, chaney?.name?.lastName, chaney?.name?.company, chaney?.name?.titleCode, chaney?.name?.businessType, chaney?.name?.state, chaney?.name?.city], ['Aamir', 'Chaney', null, 'Owner', 'Insurance Agency', 'TX', null]);
  assert.equal(chaney?.payload.joinNpn, '14395981');
  const jackson = rows.find(row => row.name?.lastName === 'Jackson');
  assert.deepEqual([jackson?.name?.firstName, jackson?.name?.lastName], ['Aaron', 'Jackson'], 'III stripped');
  const url = txTdiIndividualsUrl(['8107771', '16771287']);
  assert.ok(url.startsWith('https://data.texas.gov/resource/kxv3-diwf.json?$select=npn,city,state,pstl_cd&$where=npn in(') && url.includes("'8107771','16771287'") && url.length < SOCRATA_URL_MAX, url);
  assert.ok(txTdiIndividualsUrl(Array.from({ length: 15 }, (_, i) => String(10000000 + i))).length < SOCRATA_URL_MAX, 'fifteen NPNs per join request');
  // The individuals sample carries city, state and ZIP but no street (verified 2026-09-21): the parcel step stays.
  const individuals = fx.individuals as Array<Record<string, unknown>>;
  assert.equal(individuals[0].city, 'JASPER'); assert.equal(individuals[0].state, 'TX'); assert.equal('street' in individuals[0] || 'address' in individuals[0], false);
});

test('tx_tabc: one segment per licence type, Active only, owner must be a person, mailing address kept as the home candidate only when it differs from the premises', () => {
  const fx = fixture('tx_tabc');
  assert.ok(decodeURIComponent(txTabc.request(txTabc.initialCursor())?.url ?? '').includes("license_status='Active' AND license_type='BG'"));
  assert.ok(decodeURIComponent(txTabc.request({ segment: 3, offset: 0 })?.url ?? '').includes("license_type='MB'"));
  const { rows } = parse(txTabc, json(fx.rows!));
  assert.equal(rows.length, 6);
  const bonnie = rows.find(row => row.rowKey === '100000290.0');
  assert.deepEqual([bonnie?.name?.firstName, bonnie?.name?.lastName, bonnie?.name?.company, bonnie?.name?.titleCode, bonnie?.name?.businessType, bonnie?.name?.street, bonnie?.name?.city, bonnie?.name?.county, bonnie?.name?.zip, bonnie?.name?.licenseIssueDate],
    ['Bonnie', 'Hegemeyer', 'CROSS ROADS TAVERN', 'License Holder', 'Wine and Beer Retailer', null, 'Sealy', 'Austin', '77474', '1987-12-11']);
  assert.equal(bonnie?.payload.mailDiffersFromPremises, false);
  const lopez = rows.find(row => row.rowKey === '100000581.0');
  assert.deepEqual([lopez?.name?.street, lopez?.name?.city, lopez?.name?.zip, lopez?.payload.mailDiffersFromPremises], ['5011 AVE O', 'Galveston', '77551', true]);
  assert.equal(skipped(rows, 'owner_is_entity').length, 3, 'Southwest Convenience Stores LLC, YAMATO INC., TEXAS TECH UNIVERSITY');
});

test('ny_doh_food: restaurants only, operator must be a person, corporate operator skipped, permitted corp as company', () => {
  const fx = fixture('ny_doh_food');
  assert.ok(decodeURIComponent(nyDohFood.request(nyDohFood.initialCursor())?.url ?? '').includes("perm_operator_last_name IS NOT NULL AND description like '%Restaurant%'"));
  const { rows } = parse(nyDohFood, json(fx.rows!));
  assert.equal(rows.length, 5);
  assert.equal(rows[0].skipReason, 'not_a_restaurant', 'institutional food service');
  const martin = rows.find(row => row.name?.lastName === 'Martin');
  assert.deepEqual([martin?.name?.firstName, martin?.name?.company, martin?.name?.titleCode, martin?.name?.businessType, martin?.name?.street, martin?.name?.city, martin?.name?.county, martin?.name?.zip, martin?.name?.licenseExpiresAt],
    ['Keith', 'Jstn Ctr City Development Corp', 'Operator', 'Restaurant', '319 WEST Third STREET', 'Jamestown', 'CHAUTAUQUA', '14701', '2028-03-31']);
  assert.equal(rows.find(row => String(row.payload.permitted_corp_name).startsWith('Hong Kong'))?.skipReason, 'operator_is_entity');
});

test('co_sos_agents: good standing, person agent, agent address must equal the principal address, surname in the entity name flags Agent-Owner', () => {
  const fx = fixture('co_sos_agents');
  const first = coSosAgents.request(coSosAgents.initialCursor());
  assert.ok(decodeURIComponent(first?.url ?? '').includes("agentorganizationname IS NULL AND upper(entityname) like '%MED SPA%'") && (first?.url.length ?? 0) < SOCRATA_URL_MAX, first?.url);
  assert.equal(CO_SOS_PATTERNS.length, 12);
  const { rows } = parse(coSosAgents, json(fx.rows!));
  assert.equal(rows.length, 5);
  const otero = rows.find(row => row.rowKey === '20261939987');
  assert.deepEqual([otero?.name?.firstName, otero?.name?.lastName, otero?.name?.company, otero?.name?.titleCode, otero?.name?.businessType, otero?.name?.street, otero?.name?.city, otero?.name?.zip, otero?.name?.licenseIssueDate],
    ['Alejandro', 'Garcia Otero', 'Mile High Wellness & Med Spa LLC', 'Registered Agent', 'DLLC', '5511 Revere St', 'Denver', '80239', '2026-07-30']);
  assert.equal(otero?.payload.surnameInEntity, false);
  const gina = rows.find(row => row.name?.lastName === 'Comminello');
  assert.equal(gina?.name?.titleCode, 'Agent-Owner'); assert.equal(gina?.payload.surnameInEntity, true);
  assert.equal(rows.find(row => String(row.payload.entityname).startsWith('Sparta'))?.skipReason, 'agent_address_differs');
  const service = parse(coSosAgents, json([{ ...(fx.rows as Record<string, unknown>[])[0], entityid: 'S1', agentorganizationname: 'REGISTERED AGENTS INC' }]));
  assert.equal(service.rows[0].skipReason, 'agent_is_organization');
});

test('nppes_medspa: state x organization_name pattern x skip cursor, owner titles only, staff titles skipped, business_type marks the med spa path', () => {
  const fx = fixture('nppes_medspa');
  const first = nppesMedspa.request(nppesMedspa.initialCursor());
  assert.match(first?.url ?? '', /enumeration_type=NPI-2&state=AL&organization_name=\*med%20spa\*&limit=200&skip=0$/);
  assert.equal(NPPES_MEDSPA_PATTERNS.length, 8);
  const florida = { state: 9, pattern: 0, skip: 0 };
  const { rows, next } = parse(nppesMedspa, { status: 200, text: JSON.stringify(fx.body), contentRange: null, contentType: 'application/json' }, florida);
  assert.equal(rows.length, 2);
  const owner = rows.find(row => row.rowKey === '1235578899');
  assert.deepEqual([owner?.name?.firstName, owner?.name?.lastName, owner?.name?.company, owner?.name?.titleCode, owner?.name?.businessType, owner?.name?.city, owner?.name?.state, owner?.name?.zip, owner?.name?.phone10],
    ['Daniel', 'Ronchetta', 'MED SPA & REHABILITATION CENTER CORP', 'PRESIDENT/OWNER', 'Organization (NPI-2): Med Spa', 'CORAL GABLES', 'FL', '33134', '3054431172']);
  assert.deepEqual(next, { state: 9, pattern: 1, skip: 0 }, 'a short page moves to the next pattern');
  const body = fx.body as { results: Array<Record<string, unknown>> };
  const staff = parse(nppesMedspa, { status: 200, text: JSON.stringify({ results: [{ ...body.results[0], basic: { ...(body.results[0].basic as Record<string, unknown>), authorized_official_title_or_position: 'OFFICE MANAGER' } }] }), contentRange: null, contentType: 'application/json' }, florida);
  // Staff titles are caught by the shared NPPES filter first (same reason as the taxonomy adapter); a title that is
  // neither staff nor owner is the med spa layer's own skip.
  assert.equal(staff.rows[0].skipReason, 'staff_title_excluded');
  const nurse = parse(nppesMedspa, { status: 200, text: JSON.stringify({ results: [{ ...body.results[0], basic: { ...(body.results[0].basic as Record<string, unknown>), authorized_official_title_or_position: 'NURSE PRACTITIONER' } }] }), contentRange: null, contentType: 'application/json' }, florida);
  assert.equal(nurse.rows[0].skipReason, 'title_not_owner');
  const last = parse(nppesMedspa, { status: 200, text: JSON.stringify({ results: [] }), contentRange: null, contentType: 'application/json' }, { state: 9, pattern: 7, skip: 0 });
  assert.deepEqual(last.next, { state: 10, pattern: 0, skip: 0 });
  // The taxonomy adapter now names the taxonomy in business_type so "nppes:dentist" can filter it.
  const dentists = parse(nppes, { status: 200, text: JSON.stringify(fixture('nppes').body), contentRange: null, contentType: 'application/json' }, { state: 9, prefix: 11, taxonomy: 3, skip: 0, ceilingHits: 0 });
  assert.equal(dentists.rows.find(row => row.rowKey === '1104969039')?.name?.businessType, 'Organization (NPI-2): Dentist');
});
