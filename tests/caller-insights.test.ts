import assert from "node:assert/strict";
import test from "node:test";
import { canExportSession, exportSessionTranscript, filterSessions, mergeSessionHistory, retainFinalResult, sessionInsights } from "../src/lib/caller-insights.ts";
import type { CallSession } from "../src/lib/caller-types.ts";

const completed: CallSession = {
  id: "9ac3ece1-c7be-4c58-9114-ea368a40d4a6", provider: "elevenlabs", provider_call_id: "provider-internal-id",
  channel: "web", status: "completed", created_at: "2026-09-14T10:00:00Z", started_at: "2026-09-14T10:00:01Z",
  ended_at: "2026-09-14T10:01:01Z", duration_seconds: 60, synced_at: "2026-09-14T10:02:00Z",
  summary: "Agency needs faster follow-up.", failure_code: null,
  transcript: [{ role: "user", message: "We get twenty leads each week.", time_in_call_secs: 2 }, { role: "agent", message: "What happens after a lead comes in?", time_in_call_secs: 65.9 }],
};

test("recent metrics separate failed, expired and pending while exposing missing durations", () => {
  const metrics = sessionInsights([completed, { ...completed, status: "failed", duration_seconds: 15 }, { ...completed, status: "expired", duration_seconds: null }, { ...completed, status: "processing", duration_seconds: null }]);
  assert.deepEqual(metrics, { total: 4, completed: 1, failed: 1, expired: 1, pending: 1, durationSeconds: 75, missingDurations: 2 });
  const limited = sessionInsights([...Array.from({ length: 30 }, () => completed), { ...completed, duration_seconds: 900 }]);
  assert.equal(limited.total, 30);
  assert.equal(limited.durationSeconds, 1800);
  assert.equal(sessionInsights([]).completed, 0);
});

test("history search uses saved content and status together without changing metric scope", () => {
  const failed = { ...completed, id: "failed-session", status: "failed" as const, summary: "Different summary", transcript: [] };
  const sessions = [completed, failed];
  assert.deepEqual(filterSessions(sessions, " TWENTY ", "completed"), [completed]);
  assert.deepEqual(filterSessions(sessions, "Agency", "failed"), []);
  assert.deepEqual(filterSessions(sessions, "failed-session", "all"), [failed]);
  assert.deepEqual(filterSessions(sessions, "provider-internal-id", "all"), []);
  assert.equal(sessionInsights(sessions).total, 2);
});

test("transcript export requires a final verified result and excludes internal identifiers", () => {
  const exported = exportSessionTranscript(completed);
  assert.equal(exported.filename, `nbc-caller-${completed.id}.txt`);
  assert.match(exported.text, /\[1:05\] NBC agent: What happens/);
  assert.match(exported.text, /SUMMARY\nAgency needs faster follow-up\./);
  assert.ok(!exported.text.includes("provider-internal-id"));
  for (const session of [{ ...completed, status: "processing" as const }, { ...completed, synced_at: null }, { ...completed, transcript: [] }]) {
    assert.equal(canExportSession(session), false);
    assert.throws(() => exportSessionTranscript(session), /finalized/);
  }
  assert.equal(canExportSession({ ...completed, status: "failed" }), true);
  assert.match(exportSessionTranscript({ ...completed, duration_seconds: null }).text, /Duration: Not provided/);
});

test("late processing responses cannot replace final results but another session can be selected", () => {
  assert.equal(retainFinalResult(completed, { ...completed, status: "processing", transcript: [] }), completed);
  const failed = { ...completed, status: "failed" as const };
  assert.equal(retainFinalResult(failed, { ...completed, status: "active" }), failed);
  const other = { ...completed, id: "another-session" };
  assert.equal(retainFinalResult(completed, other), other);
  assert.deepEqual(retainFinalResult({ ...completed, status: "expired" }, completed), completed);
  const analysis = { version: "nbc-analysis-v1" as const, data: { primary_objection: "budget_or_price" }, evaluations: {}, sentiment: null };
  assert.deepEqual(retainFinalResult(completed, { ...completed, post_call_analysis: analysis }).post_call_analysis, analysis);
  const review = { primary_objection: "value_or_roi", customer_issue_category: "none", next_step: "follow_up_requested", note: "Confirmed after review.", reviewed_at: "2026-09-21T12:00:00Z" };
  assert.deepEqual(retainFinalResult({ ...completed, analysis_review: review }, { ...completed, status: "processing", analysis_review: null }).analysis_review, review);
});


test("all loaded rows are searchable; deduplication and late refresh retain verified data", () => {
  const rows = Array.from({ length: 65 }, (_, index) => ({ ...completed, id: String(index).padStart(3, "0"), summary: index === 0 ? "Old fixture" : "Fixture" }));
  assert.equal(filterSessions(rows, "Old fixture", "all").length, 1);
  assert.equal(filterSessions(rows, "", "all").length, 65);
  const merged = mergeSessionHistory(rows, [{ ...rows[0], status: "processing", transcript: [] }]);
  assert.equal(merged.length, 65);
  assert.equal(merged.find(row => row.id === "000")?.status, "completed");
  assert.equal(sessionInsights(merged).total, 30);
  const pending = { ...completed, status: "processing" as const };
  assert.equal(retainFinalResult(pending, { ...pending, synced_at: null, transcript: [] }), pending);
  const preserved = retainFinalResult(pending, { ...pending, transcript: [], summary: null, duration_seconds: null });
  assert.deepEqual(preserved.transcript, completed.transcript);
  assert.equal(preserved.summary, completed.summary);
  assert.deepEqual(retainFinalResult(pending, { ...pending, transcript: pending.transcript.map(turn => ({ ...turn, message: "" })) }).transcript, pending.transcript);
  const sameSecond = mergeSessionHistory([], [{ ...completed, id: "1", created_at: "2026-09-14T10:00:00Z" }, { ...completed, id: "2", created_at: "2026-09-14T10:00:00.000001+00:00" }]);
  assert.equal(sameSecond[0].id, "2");
  assert.equal(retainFinalResult({ ...pending, status: "expired" }, pending).status, "expired");
});
