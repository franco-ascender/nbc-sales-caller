import assert from "node:assert/strict";
import test from "node:test";
import { parseConversationScenario } from "../src/lib/caller-knowledge.ts";
import { retainFinalResult } from "../src/lib/caller-insights.ts";
import { parseSessionPage } from "../src/lib/caller-pagination.ts";
import { parseElevenLabsPostCallEvent } from "../src/lib/caller-telephony-validation.ts";
import { normalizeConversation, parseAnalysisReview } from "../src/lib/caller-validation.ts";
import type { CallSession, CallSessionStatus } from "../src/lib/caller-types.ts";

let state = 0x6e626343;
const random = (): number => ((state = Math.imul(state ^ state >>> 15, 1 | state), state ^= state + Math.imul(state ^ state >>> 7, 61 | state), ((state ^ state >>> 14) >>> 0) / 4294967296));
const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)];
const weird = (depth = 0): unknown => {
  const scalars: unknown[] = [null, undefined, true, false, 0, -1, NaN, Infinity, "", "x", "\0", "../", "😀".repeat(30)];
  if (depth > 2 || random() < .55) return pick(scalars);
  if (random() < .5) return Array.from({ length: Math.floor(random() * 6) }, () => weird(depth + 1));
  return Object.fromEntries(Array.from({ length: Math.floor(random() * 6) }, (_, index) => [`k${index}_${Math.floor(random() * 20)}`, weird(depth + 1)]));
};

test("20,000 malformed review, scenario, cursor and webhook inputs fail closed", () => {
  const parsers = [
    (value: unknown) => parseAnalysisReview(value),
    (value: unknown) => parseConversationScenario(value),
    (value: unknown) => parseSessionPage(value, value, 30),
    (value: unknown) => parseElevenLabsPostCallEvent(value, new Set(["agent_owned"])),
  ];
  for (let index = 0; index < 20_000; index += 1) {
    const parser = parsers[index % parsers.length], value = weird();
    try {
      const parsed = parser(value);
      assert.ok(parsed && typeof parsed === "object");
      if ("note" in parsed) assert.ok(typeof parsed.note === "string" && parsed.note.length <= 500);
      if ("limit" in parsed) assert.ok(typeof parsed.limit === "number" && parsed.limit >= 1 && parsed.limit <= 30);
      if ("conversationId" in parsed) assert.match(String(parsed.conversationId), /^[A-Za-z0-9_-]{8,100}$/);
    } catch (error) { assert.ok(error instanceof Error); }
  }
});

test("provider transcript normalization remains bounded under 5,000 hostile payload mutations", () => {
  for (let index = 0; index < 5_000; index += 1) {
    const count = Math.floor(random() * 500);
    const payload = {
      agent_id: "agent_owned", conversation_id: "conv_owned", status: pick(["initiated", "in-progress", "processing", "done", "failed"]),
      metadata: { start_time_unix_secs: pick([1_800_000_000, -1, Infinity, 1e308, weird()]), call_duration_secs: pick([0, 12.4, -1, Infinity, 1e308, weird()]) },
      transcript: Array.from({ length: count }, () => ({ role: pick(["agent", "user", "system", weird()]), message: pick(["hello", "x".repeat(8_000), weird()]), time_in_call_secs: pick([0, 4.2, -9, Infinity, 1e308, weird()]) })),
      analysis: weird(),
    };
    const result = normalizeConversation(payload, { agentId: "agent_owned", conversationId: "conv_owned" });
    assert.ok(result.transcript.length <= 300);
    assert.ok(result.transcript.every(turn => ["agent", "user"].includes(turn.role) && turn.message.length <= 6_000 && Number.isFinite(turn.time_in_call_secs) && turn.time_in_call_secs >= 0));
    assert.ok(result.duration_seconds === null || Number.isInteger(result.duration_seconds) && result.duration_seconds >= 0);
  }
});

test("10,000 out-of-order session updates never regress a terminal result", () => {
  const statuses: CallSessionStatus[] = ["preparing", "ready", "active", "processing", "expired", "completed", "failed"];
  const base: CallSession = {
    id: "9ac3ece1-c7be-4c58-9114-ea368a40d4a6", provider: "elevenlabs", provider_call_id: "conv_owned", channel: "web",
    status: "completed", created_at: "2026-09-21T10:00:00Z", started_at: "2026-09-21T10:00:01Z", ended_at: "2026-09-21T10:01:01Z",
    duration_seconds: 60, synced_at: "2026-09-21T10:02:00Z", summary: "Verified final summary", failure_code: null,
    transcript: [{ role: "user", message: "Verified final transcript", time_in_call_secs: 1 }],
  };
  for (let index = 0; index < 10_000; index += 1) {
    const terminal = { ...base, status: pick(["completed", "failed"] as const) };
    const incoming = { ...base, status: pick(statuses), transcript: random() < .5 ? [] : base.transcript, summary: random() < .5 ? null : base.summary };
    const result = retainFinalResult(terminal, incoming);
    assert.equal(result.status, terminal.status);
    assert.equal(result.summary, terminal.summary);
    assert.deepEqual(result.transcript, terminal.transcript);
  }
});
