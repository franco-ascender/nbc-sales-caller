import assert from "node:assert/strict";
import test from "node:test";
import { encodeSessionCursor, parseSessionPage, sessionCursorFilter } from "../src/lib/caller-pagination.ts";
const id = "00000000-0000-4000-8000-000000000001";
test("cursor preserves Postgres microseconds and validates boundaries", () => {
  const cursor = encodeSessionCursor({ id, created_at: "2026-09-14T10:00:00.123456+00:00" });
  const parsed = parseSessionPage(cursor, "2");
  assert.equal(parsed.cursor?.createdAt, "2026-09-14T10:00:00.123456+00:00");
  assert.match(sessionCursorFilter(parsed.cursor!), /id.lt.00000000/);
  assert.equal(parseSessionPage(null, null).limit, 30);
  for (const value of [0, 31, -1, 1.1, "", "01", "1e1", "2.0", {}, NaN]) assert.throws(() => parseSessionPage(null, value));
  for (const value of ["", "?", "x".repeat(513), {}, Buffer.from(JSON.stringify({ v: 1, id, createdAt: "2026-02-30T00:00:00Z" })).toString("base64url"), Buffer.from(JSON.stringify({ v: 1, id: "bad", createdAt: "2026-09-14T00:00:00Z" })).toString("base64url")]) assert.throws(() => parseSessionPage(value, 2));
});
