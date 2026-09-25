import assert from "node:assert/strict";
import test from "node:test";
import { acceptDispatch, applyTwilioCallState, canRegisterElevenCall, initialPhoneAttemptState, markDispatchUnknown, requestPhoneStop } from "../src/lib/caller-phone-state.ts";

test("a phone callback can advance the state but cannot reopen a terminal call", () => {
  const accepted = acceptDispatch({ ...initialPhoneAttemptState(), dispatch: "dispatching" });
  const connected = applyTwilioCallState(accepted, "in_progress");
  const final = applyTwilioCallState(connected, "completed");
  assert.equal(final.call, "completed");
  assert.equal(applyTwilioCallState(final, "ringing"), final);
});

test("out-of-order nonterminal callbacks cannot regress an active call", () => {
  const active = applyTwilioCallState({ ...initialPhoneAttemptState(), dispatch: "accepted", call: "ringing" }, "in_progress");
  assert.equal(applyTwilioCallState(active, "queued"), active);
  assert.equal(canRegisterElevenCall(active), true);
});

test("stop is persisted before a provider stop and blocks voice registration", () => {
  const pending = { ...initialPhoneAttemptState(), dispatch: "accepted" as const, call: "ringing" as const };
  const result = requestPhoneStop(pending, null);
  assert.equal(result.state.stopRequested, true);
  assert.equal(result.requiresProviderStop, false);
  assert.equal(canRegisterElevenCall(result.state), false);
  assert.equal(requestPhoneStop(pending, "CA123").requiresProviderStop, true);
});

test("ambiguous dispatch stays recoverable and is never converted to a failed call", () => {
  const unknown = markDispatchUnknown({ ...initialPhoneAttemptState(), dispatch: "dispatching" });
  assert.equal(unknown.dispatch, "dispatch_unknown");
  assert.equal(unknown.call, null);
});
