import assert from "node:assert/strict";
import test from "node:test";
import { beginRecovery, finishRecovery } from "../src/lib/caller-recovery.ts";

test("a recovery requested during a locked token refresh is retained and runs once after release", () => {
  const lock = { busy: false, queued: null };
  assert.equal(beginRecovery(lock), "started");
  assert.equal(beginRecovery(lock), "queued");
  assert.deepEqual(finishRecovery(lock), {});
  assert.equal(lock.busy, false);
  assert.equal(beginRecovery(lock), "started");
  assert.equal(finishRecovery(lock), null);
});

test("the latest queued recovery replaces an older page request", () => {
  const lock = { busy: true, queued: null as { cursor?: string } | null };
  assert.equal(beginRecovery(lock, "older"), "queued");
  assert.equal(beginRecovery(lock), "queued");
  assert.deepEqual(finishRecovery(lock), {});
});
