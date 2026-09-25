import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeZoneForZip, resolveZone, withinDialWindow, dialStatus, holdBackWithoutZone, zip5, DIAL_WINDOW } from '../src/lib/lead-engine-dial-window.ts';

test('ZIP resolves the zone at county grain in the split states, from the free GeoNames table', () => {
  assert.equal(timeZoneForZip('33602'), 'America/New_York');   // Tampa
  assert.equal(timeZoneForZip('32502'), 'America/Chicago');    // Pensacola
  assert.equal(timeZoneForZip('32456'), 'America/New_York');   // Port St. Joe: south Gulf County stays Eastern
  assert.equal(timeZoneForZip('32465'), 'America/Chicago');    // Wewahitchka: north Gulf County
  assert.equal(timeZoneForZip('79901'), 'America/Denver');     // El Paso
  assert.equal(timeZoneForZip('37201'), 'America/Chicago');    // Nashville
  assert.equal(timeZoneForZip('37902'), 'America/New_York');   // Knoxville
  assert.equal(timeZoneForZip('40202'), 'America/New_York');   // Louisville
  assert.equal(timeZoneForZip('42101'), 'America/Chicago');    // Bowling Green
  assert.equal(timeZoneForZip('46320'), 'America/Chicago');    // Hammond IN
  assert.equal(timeZoneForZip('49801'), 'America/Chicago');    // Iron Mountain MI
  assert.equal(timeZoneForZip('83814'), 'America/Los_Angeles'); // Coeur d'Alene
  assert.equal(timeZoneForZip('97914'), 'America/Denver');     // Ontario OR
  assert.equal(timeZoneForZip('85001'), 'America/Phoenix');
  assert.equal(timeZoneForZip('96813'), 'Pacific/Honolulu');
  assert.equal(timeZoneForZip('99546'), 'America/Adak');
});

test('ZIP+4, numbers and junk are normalized or refused; unknown ZIPs return null, never a guess', () => {
  assert.equal(zip5('33602-1234'), '33602'); assert.equal(zip5(33602), '33602'); assert.equal(zip5(' 33602 '), '33602');
  assert.equal(zip5('3360'), null); assert.equal(zip5('abcde'), null); assert.equal(zip5(null), null);
  assert.equal(timeZoneForZip('00000'), null);
  assert.equal(timeZoneForZip(''), null);
});

test('resolveZone prefers the ZIP and falls back to state, city and area code', () => {
  assert.equal(resolveZone({ zip: '79901', state: 'TX' }), 'America/Denver');
  assert.equal(resolveZone({ state: 'TX', city: 'Dallas' }), 'America/Chicago');
  assert.equal(resolveZone({ state: 'NC' }), 'America/New_York');
  assert.equal(resolveZone({ zip: 'nope', state: 'TN' }), null);
});

test('the dial window is 08:00 to 20:00 recipient local, closed at 20:00 sharp', () => {
  assert.deepEqual(DIAL_WINDOW, { start: '08:00', end: '20:00' });
  // 2026-09-15 18:30Z = 14:30 New York, 13:30 Chicago, 11:30 Los Angeles
  const afternoon = new Date('2026-09-15T18:30:00Z');
  assert.equal(withinDialWindow(afternoon, 'America/New_York'), true);
  assert.equal(withinDialWindow(afternoon, 'America/Los_Angeles'), true);
  // 2026-09-16 00:00Z = 20:00 New York (closed), 19:00 Chicago (open), 17:00 Los Angeles
  const evening = new Date('2026-09-16T00:00:00Z');
  assert.equal(withinDialWindow(evening, 'America/New_York'), false);
  assert.equal(withinDialWindow(evening, 'America/Chicago'), true);
  // 2026-09-16 12:00Z = 08:00 New York (opens), 05:00 Los Angeles (closed)
  const morning = new Date('2026-09-16T12:00:00Z');
  assert.equal(withinDialWindow(morning, 'America/New_York'), true);
  assert.equal(withinDialWindow(morning, 'America/Los_Angeles'), false);
});

test('dialStatus tells the caller the local time and how long until the window opens', () => {
  const morning = new Date('2026-09-16T12:00:00Z');
  assert.deepEqual(dialStatus('America/Los_Angeles', morning), { timeZone: 'America/Los_Angeles', localTime: '05:00', open: false, opensInMinutes: 180 });
  assert.deepEqual(dialStatus('America/New_York', morning), { timeZone: 'America/New_York', localTime: '08:00', open: true, opensInMinutes: 0 });
  const late = new Date('2026-09-16T01:30:00Z'); // 21:30 New York
  assert.deepEqual(dialStatus('America/New_York', late), { timeZone: 'America/New_York', localTime: '21:30', open: false, opensInMinutes: 630 });
  assert.throws(() => dialStatus('Mars/Phobos'), RangeError);
});

test('rows without a zone are held back with a reason, never delivered and never dropped silently', () => {
  const rows = [{ id: 1, zip: '33602' }, { id: 2, zip: 'x' }, { id: 3, zip: '79901' }];
  const result = holdBackWithoutZone(rows, row => timeZoneForZip(row.zip));
  assert.deepEqual(result.deliverable.map(row => row.id), [1, 3]);
  assert.deepEqual(result.held, [{ row: rows[1], reason: 'time_zone_unresolved' }]);
});
