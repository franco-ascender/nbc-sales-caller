import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { parseElevenLabsPostCallEvent, validElevenLabsWebhook, validPhoneNumber, validTwilioStatus, validTwilioWebhook } from "../src/lib/caller-telephony-validation.ts";

test("telephone numbers and provider statuses fail closed", () => {
  assert.equal(validPhoneNumber("+14155550100"), true);
  for (const value of ["4155550100", "+0014155550100", "+1415", "tel:+14155550100", null]) assert.equal(validPhoneNumber(value), false);
  assert.equal(validTwilioStatus("in-progress"), true);
  assert.equal(validTwilioStatus("answered"), false);
});

test("Twilio callback signatures bind the canonical HTTPS URL and every field", () => {
  const token = "fixture-token", url = "https://caller.example.test/api/caller/phone/webhooks/twilio/status", fields = { CallSid: "CAfixture", CallStatus: "ringing", SequenceNumber: "1" };
  const signed = createHmac("sha1", token).update(url + Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + value).join("")).digest("base64");
  assert.equal(validTwilioWebhook(signed, url, fields, token), true);
  assert.equal(validTwilioWebhook(signed, url, { ...fields, CallStatus: "completed" }, token), false);
  assert.equal(validTwilioWebhook(signed, "http://caller.example.test/api", fields, token), false);
});

test("ElevenLabs webhook validation rejects stale, forged and malformed deliveries", () => {
  const now = 1_800_000_000_000, body = '{"type":"post_call_transcription"}', secret = "fixture-secret", timestamp = String(now / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  assert.equal(validElevenLabsWebhook(`t=${timestamp},v0=${signature}`, body, secret, now), true);
  assert.equal(validElevenLabsWebhook(`t=${timestamp},v0=${signature}`, body + " ", secret, now), false);
  assert.equal(validElevenLabsWebhook(`t=${timestamp},v0=${signature}`, body, secret, now + 300_001), false);
  assert.equal(validElevenLabsWebhook("t=bad,v0=abc", body, secret, now), false);
});

test("post-call events accept only transcripts from an owned agent and bounded identities", () => {
  const event = { type: "post_call_transcription", event_timestamp: 1_800_000_000, data: { agent_id: "agent_nbc", conversation_id: "conv_12345678", status: "done" } };
  assert.equal(parseElevenLabsPostCallEvent(event, new Set(["agent_nbc"])).conversationId, "conv_12345678");
  assert.throws(() => parseElevenLabsPostCallEvent({ ...event, type: "post_call_audio" }, new Set(["agent_nbc"])));
  assert.throws(() => parseElevenLabsPostCallEvent(event, new Set(["agent_other"])));
  assert.throws(() => parseElevenLabsPostCallEvent({ ...event, data: { ...event.data, conversation_id: "../other" } }, new Set(["agent_nbc"])));
  assert.throws(() => parseElevenLabsPostCallEvent({ ...event, event_timestamp: Number.MAX_SAFE_INTEGER }, new Set(["agent_nbc"])));
});
