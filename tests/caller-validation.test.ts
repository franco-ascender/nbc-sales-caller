import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConversation, parseAnalysisReview, parseSignedSession, validSessionId } from "../src/lib/caller-validation.ts";

test("voice authorization binds to one provider conversation and rejects foreign hosts", () => {
  const url = "wss://api.elevenlabs.io/v1/convai/conversation?conversation_id=conv_test123&conversation_signature=example";
  assert.equal(parseSignedSession({ signed_url: url }).conversationId, "conv_test123");
  assert.throws(() => parseSignedSession({ signed_url: url.replace("api.elevenlabs.io", "attacker.example") }));
  assert.throws(() => parseSignedSession({ signed_url: "wss://api.elevenlabs.io/v1/convai/conversation?conversation_signature=example" }));
  assert.equal(validSessionId("../../other-session"), false);
  assert.equal(validSessionId("9ac3ece1-c7be-4c58-9114-ea368a40d4a6"), true);
});

test("saved results reject another agent or conversation and retain only supported transcript fields", () => {
  const expected = { agentId: "agent_nbc", conversationId: "conv_nbc" };
  const response = { agent_id: expected.agentId, conversation_id: expected.conversationId, status: "done", metadata: { start_time_unix_secs: 1_800_000_000, call_duration_secs: 30 }, analysis: { transcript_summary: "Asked about lead follow-up." }, transcript: [{ role: "user", message: "Hello", time_in_call_secs: 2, private_metadata: "omit" }, { role: "system", message: "omit" }, { role: "agent", message: "How can I help?", time_in_call_secs: 3 }] };
  assert.throws(() => normalizeConversation({ ...response, agent_id: "other_agent" }, expected));
  assert.throws(() => normalizeConversation({ ...response, conversation_id: "other_call" }, expected));
  const normalized = normalizeConversation(response, expected);
  assert.equal(normalized.status, "completed");
  assert.equal(normalized.duration_seconds, 30);
  assert.equal(normalized.transcript.length, 2);
  assert.deepEqual(normalized.transcript[0], { role: "user", message: "Hello", time_in_call_secs: 2 });
  assert.equal(Date.parse(normalized.ended_at!) - Date.parse(normalized.started_at!), 30000);
});

test("processing is not reported as completed and malformed metrics are not invented", () => {
  const normalized = normalizeConversation({ agent_id: "a", conversation_id: "c", status: "processing", metadata: { call_duration_secs: -1 }, transcript: [] }, { agentId: "a", conversationId: "c" });
  assert.equal(normalized.status, "processing");
  assert.equal(normalized.duration_seconds, null);
  assert.equal(normalized.summary, null);
  assert.equal(normalized.ended_at, null);
});

test("provider time fields cannot overflow date conversion or transcript rendering", () => {
  const normalized = normalizeConversation({ agent_id: "a", conversation_id: "c", status: "done", metadata: { start_time_unix_secs: 1_800_000_000, call_duration_secs: 1e308 }, transcript: [{ role: "user", message: "hello", time_in_call_secs: 1e308 }] }, { agentId: "a", conversationId: "c" });
  assert.equal(normalized.duration_seconds, null);
  assert.equal(normalized.ended_at, null);
  assert.equal(normalized.transcript[0].time_in_call_secs, 86_400);
});

test("post-call analysis retains only NBC fields and bounded evaluation results", () => {
  const normalized = normalizeConversation({ agent_id: "a", conversation_id: "c", status: "done", metadata: {}, transcript: [], analysis: {
    data_collection_results: { primary_objection: { value: "budget_or_price", rationale: "omit" }, unsafe_extra: { value: "secret" } },
    evaluation_criteria_results: { objection_handling: { result: "success", rationale: "Clarified before answering.", score: 90, max_score: 100 }, foreign: { result: "success", rationale: "omit" } },
    sentiment_analysis: { overall_label: "positive", overall_sentiment_score: .4, overall_frustration_score: .1 }
  } }, { agentId: "a", conversationId: "c" });
  assert.deepEqual(normalized.post_call_analysis?.data, { primary_objection: "budget_or_price" });
  assert.deepEqual(Object.keys(normalized.post_call_analysis?.evaluations ?? {}), ["objection_handling"]);
  assert.equal(normalized.post_call_analysis?.sentiment?.label, "positive");
});

test("analysis reviews accept only bounded NBC classifications", () => {
  assert.deepEqual(parseAnalysisReview({ primary_objection: "budget_or_price", customer_issue_category: "none", next_step: "follow_up_requested", note: "  Confirm pricing context.  " }), {
    primary_objection: "budget_or_price", customer_issue_category: "none", next_step: "follow_up_requested", note: "Confirm pricing context."
  });
  assert.throws(() => parseAnalysisReview({ primary_objection: "invented", customer_issue_category: "none", next_step: "no_next_step", note: "" }));
  assert.throws(() => parseAnalysisReview({ primary_objection: "none", customer_issue_category: "none", next_step: "no_next_step", note: "", operator_id: "foreign" }));
  assert.throws(() => parseAnalysisReview({ primary_objection: "none", customer_issue_category: "none", next_step: "no_next_step", note: "x".repeat(501) }));
});
