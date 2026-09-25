import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorkflowEvent, isIdentifier } from "../src/lib/integration-validation.ts";
import { csvCell, summarize } from "../src/lib/metrics.ts";
import type { CallRecord } from "../src/components/dashboard/Dashboard.types.ts";

test("rejects events for a different customer and requires a stable event identifier", () => {
  const event = { eventId: "evt-1", locationId: "location-a", contactId: "contact-1", type: "integration.test" };
  assert.deepEqual(parseWorkflowEvent(event, "location-a"), event);
  assert.equal(parseWorkflowEvent(event, "location-b"), null);
  assert.equal(parseWorkflowEvent({ ...event, eventId: undefined }, "location-a"), null);
  assert.equal(parseWorkflowEvent({ ...event, type: "call.start" }, "location-a"), null);
  assert.equal(parseWorkflowEvent(event, ""), null);
  assert.equal(isIdentifier("../contacts"), false);
  assert.equal(isIdentifier("id?locationId=other"), false);
});

test("booking rate excludes unanswered calls and empty data does not produce NaN", () => {
  const records = [
    { outcome: "Booked", duration: 120, responseMs: 600 },
    { outcome: "Qualified", duration: 60, responseMs: 800 },
    { outcome: "No answer", duration: 0, responseMs: null },
  ] as CallRecord[];
  assert.deepEqual(summarize(records), { total: 3, answered: 2, booked: 1, bookingRate: 50, responseMs: 700, minutes: 3 });
  assert.deepEqual(summarize([]), { total: 0, answered: 0, booked: 0, bookingRate: 0, responseMs: null, minutes: 0 });
});

test("CSV output preserves quotes and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell('Acme, "Inc"'), '"Acme, ""Inc"""');
  assert.equal(csvCell('=HYPERLINK("example.com")'), '"\'=HYPERLINK(""example.com"")"');
  assert.equal(csvCell('  +123'), '"\'  +123"');
});
