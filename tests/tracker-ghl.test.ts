import { test } from "node:test";
import assert from "node:assert/strict";
import { mapGhlAppointments, mapGhlOpportunities } from "../src/lib/tracker-types.ts";

test("appointments: counts by status and drops events from another location", () => {
  const payload = { events: [
    { locationId: "loc-1", appointmentStatus: "confirmed" },
    { locationId: "loc-1", appointmentStatus: "showed" },
    { locationId: "loc-1", appointmentStatus: "showed" },
    { locationId: "loc-2", appointmentStatus: "showed" },
    { locationId: "loc-1" },
  ] };
  assert.deepEqual(mapGhlAppointments(payload, "loc-1"), { total: 4, byStatus: { confirmed: 1, showed: 2, unknown: 1 } });
});

test("appointments: malformed payload returns null instead of zero", () => {
  assert.equal(mapGhlAppointments({}, "loc-1"), null);
  assert.equal(mapGhlAppointments(null, "loc-1"), null);
  assert.deepEqual(mapGhlAppointments({ events: [] }, "loc-1"), { total: 0, byStatus: {} });
});

test("opportunities: sums won value in cents and separates open from won", () => {
  const payload = { opportunities: [
    { locationId: "loc-1", status: "won", monetaryValue: 250.5 },
    { locationId: "loc-1", status: "won", monetaryValue: 100 },
    { locationId: "loc-1", status: "open" },
    { locationId: "loc-2", status: "won", monetaryValue: 999 },
  ] };
  assert.deepEqual(mapGhlOpportunities(payload, "loc-1"), { openCount: 1, wonCount: 2, wonValueCents: 35050, currency: "USD" });
});

test("opportunities: won without a numeric value stays unknown currency, not zero", () => {
  const payload = { opportunities: [{ locationId: "loc-1", status: "won" }] };
  assert.deepEqual(mapGhlOpportunities(payload, "loc-1"), { openCount: 0, wonCount: 1, wonValueCents: null, currency: "unknown" });
});

test("opportunities: malformed payload returns null instead of zero", () => {
  assert.equal(mapGhlOpportunities({}, "loc-1"), null);
  assert.equal(mapGhlOpportunities(undefined, "loc-1"), null);
});
