import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadPlan, dollarsToCents, evaluateBatchGuard, routeIndustry, type BatchGuardInput } from "../src/lib/lead-engine-plan.ts";

const input = { industry: "Roofing", metro: "Charlotte, NC", target: 1000, hardBudgetCents: 10000, exclusions: [] };
const batch: BatchGuardInput = { lane: "A", stage: "pilot", businesses: 300, estimatedCents: 1000, hardBudgetCents: 10000, spentCents: 0, reservedCents: 0, pilotMeasured: false, pilotApproved: false, largeBatchApproved: false, balancesVerified: true, ledgerLoaded: true };

test("routing asks on unknown or mixed industries and uses complete phrases", () => {
  assert.equal(routeIndustry("Roofing").lane, "A");
  assert.equal(routeIndustry("Dental clinic").lane, "B");
  assert.equal(routeIndustry("AI development agency").lane, "C");
  assert.equal(routeIndustry("roofing marketing agency").needsClarification, true);
  assert.equal(routeIndustry("unclassified").lane, null);
  assert.equal(routeIndustry("treehouse software").lane, null);
  assert.equal(routeIndustry("roofing marketing agency", "C").lane, "C");
});

test("money parser rejects exponent, negative, excess precision and invalid plans", () => {
  assert.equal(dollarsToCents("10.01"), 1001);
  for (const text of ["1e3", "-10", "10.001", "Infinity", "", " 100 ", "99999999"]) assert.equal(dollarsToCents(text), null);
  for (const target of [0, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.ok(buildLeadPlan({ ...input, target }).errors.length > 0);
  for (const metro of ["London", "Paris, FR", "Charlotte, ZZ", "NC"]) assert.ok(buildLeadPlan({ ...input, metro }).errors.length > 0);
});

test("planning uses the upper benchmark for budget blocking and never enables execution", () => {
  const plan = buildLeadPlan({ ...input, hardBudgetCents: 5000 });
  assert.equal(plan.estimate?.minCents, 4000);
  assert.equal(plan.estimate?.maxCents, 6000);
  assert.equal(plan.estimate?.businesses, 5348);
  assert.equal(plan.estimate?.affordableTarget, 833);
  assert.equal(plan.overBudget, true);
  assert.equal(plan.executionEnabled, false);
  assert.match(plan.benchmarkVersion, /unverified/);
});

test("pilot caps, reserved budget and measured approval are blocking decisions", () => {
  assert.deepEqual(evaluateBatchGuard(batch), []);
  assert.ok(evaluateBatchGuard({ ...batch, businesses: 301 }).includes("pilot_cap_exceeded"));
  assert.ok(evaluateBatchGuard({ ...batch, estimatedCents: 1001 }).includes("pilot_cap_exceeded"));
  assert.ok(evaluateBatchGuard({ ...batch, spentCents: 8500, reservedCents: 1000 }).includes("hard_budget_exceeded"));
  assert.ok(evaluateBatchGuard({ ...batch, stage: "scale", pilotApproved: true }).includes("approved_measured_pilot_required"));
  assert.ok(evaluateBatchGuard({ ...batch, stage: "scale", pilotApproved: true, pilotMeasured: true, estimatedCents: 15001, hardBudgetCents: 20000 }).includes("large_batch_confirmation_required"));
  assert.ok(evaluateBatchGuard({ ...batch, estimatedCents: NaN }).includes("invalid_amounts"));
});

test("lane pauses and stop-loss cannot be bypassed by a large-batch confirmation", () => {
  assert.ok(evaluateBatchGuard({ ...batch, lane: "B", largeBatchApproved: true }).includes("lane_paused"));
  assert.ok(evaluateBatchGuard({ ...batch, lane: "C" }).includes("lane_paused"));
  assert.ok(evaluateBatchGuard({ ...batch, lastBatch: { costCents: 151, delivered: 10 }, largeBatchApproved: true }).includes("stop_loss_triggered"));
  assert.ok(evaluateBatchGuard({ ...batch, lastBatch: { costCents: 1, delivered: 0 } }).includes("stop_loss_triggered"));
  assert.ok(!evaluateBatchGuard({ ...batch, lastBatch: { costCents: 150, delivered: 10 } }).includes("stop_loss_triggered"));
});

test("truthy strings and null are not approvals or loaded ledger evidence", () => {
  for (const falseSignal of ["true", "false", 1, null, undefined]) {
    const candidate = { ...batch, stage: "scale", estimatedCents: 15001, hardBudgetCents: 20000, ledgerLoaded: falseSignal, balancesVerified: falseSignal, pilotMeasured: falseSignal, pilotApproved: falseSignal, largeBatchApproved: falseSignal } as unknown as BatchGuardInput;
    const blocked = evaluateBatchGuard(candidate);
    for (const reason of ["global_ledger_required", "balance_check_required", "approved_measured_pilot_required", "large_batch_confirmation_required"]) assert.ok(blocked.includes(reason));
  }
});
