import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TRACKER_LAYOUT, moveTrackerSection, parseTrackerLayout, toggleTrackerSection } from '../src/lib/tracker-workspace.ts';

test('tracker layout rejects corrupt, incomplete and duplicate saved layouts', () => {
  assert.deepEqual(parseTrackerLayout('{'), DEFAULT_TRACKER_LAYOUT);
  assert.deepEqual(parseTrackerLayout(JSON.stringify({ order: ['business'], hidden: [] })), DEFAULT_TRACKER_LAYOUT);
  assert.deepEqual(parseTrackerLayout(JSON.stringify({ order: ['business', 'business', 'sales', 'signals'], hidden: [] })), DEFAULT_TRACKER_LAYOUT);
});

test('tracker layout preserves valid ordering and hidden sections', () => {
  const layout = parseTrackerLayout(JSON.stringify({ order: ['sales', 'business', 'signals', 'acquisition'], hidden: ['signals'] }));
  assert.deepEqual(layout, { order: ['sales', 'business', 'signals', 'acquisition'], hidden: ['signals'] });
});

test('tracker sections toggle and move without mutating the prior layout', () => {
  const hidden = toggleTrackerSection(DEFAULT_TRACKER_LAYOUT, 'sales');
  assert.deepEqual(hidden.hidden, ['sales']);
  assert.deepEqual(DEFAULT_TRACKER_LAYOUT.hidden, []);
  assert.deepEqual(moveTrackerSection(hidden, 'sales', -1).order, ['business', 'sales', 'acquisition', 'signals']);
  assert.deepEqual(moveTrackerSection(hidden, 'business', -1).order, hidden.order);
});
