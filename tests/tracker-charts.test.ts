import { test } from "node:test";
import assert from "node:assert/strict";
import { smoothPath, money, pct, compact } from "../src/lib/tracker-charts.ts";

test("smoothPath: empty input produces no path, single value still draws a point", () => {
  assert.equal(smoothPath([]), "");
  assert.match(smoothPath([5]), /^M 0 0/);
});

test("money: formats under and over one thousand dollars", () => {
  assert.equal(money(50000), "$500");
  assert.equal(money(29750000), "$297.5K");
});

test("pct: formats a 0-1 ratio as a percentage with one decimal", () => {
  assert.equal(pct(0.191), "19.1%");
  assert.equal(pct(0), "0.0%");
});

test("compact: abbreviates large counts", () => {
  assert.equal(compact(575), "575");
  assert.equal(compact(82749), "82.7K");
  assert.equal(compact(1164507), "1.2M");
});
