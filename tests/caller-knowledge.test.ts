import assert from "node:assert/strict";
import test from "node:test";
import { compileScenarioPrompt, knowledgeAttachmentPlan, parseConversationScenario, parseKnowledgeAudio, parseKnowledgeText } from "../src/lib/caller-knowledge.ts";

const scenario = { title: "Agency prospect", conversationType: "outbound_prospecting", agentRole: "You sell marketing services for regional banks.", objective: "Qualify the prospect and earn a discovery call.", prospectProfile: "A skeptical owner of a regional bank who has tried agencies before.", offer: "A managed acquisition system for qualified applications.", ticket: "$8k–$15k monthly", objections: "Past agency failed; compliance concerns", tone: "consultative", instructions: "Do not reveal every feature before discovery." };

test("conversation scenarios are bounded and compile into an isolated role play", () => {
  const parsed = parseConversationScenario(scenario);
  const compiled = compileScenarioPrompt(parsed);
  assert.match(compiled.prompt, /private role-play simulation/);
  assert.match(compiled.prompt, /regional bank/);
  assert.match(compiled.firstMessage, /Agency prospect/);
  assert.throws(() => parseConversationScenario({ ...scenario, objective: "x".repeat(1001) }));
});

test("knowledge text requires authorization, meaningful content and idempotency reference", () => {
  const input = { requestId: "11111111-1111-4111-8111-111111111111", title: "Anas discovery call", kind: "transcript", content: "A".repeat(100), context: "Reviewed sales call", authorizationConfirmed: true };
  assert.equal(parseKnowledgeText(input).kind, "transcript");
  assert.throws(() => parseKnowledgeText({ ...input, authorizationConfirmed: false }));
  assert.throws(() => parseKnowledgeText({ ...input, content: "short" }));
});

test("audio reservations reject unsupported or oversized files before storage", () => {
  const input = { requestId: "11111111-1111-4111-8111-111111111111", title: "Old call", fileName: "call.mp3", mimeType: "audio/mpeg", sizeBytes: 2_000_000, context: "Sales call", authorizationConfirmed: true };
  assert.equal(parseKnowledgeAudio(input).mimeType, "audio/mpeg");
  assert.throws(() => parseKnowledgeAudio({ ...input, mimeType: "application/zip" }));
  assert.throws(() => parseKnowledgeAudio({ ...input, sizeBytes: 251 * 1024 * 1024 }));
});

test("short playbooks stay in prompt context while transcripts enable retrieval", () => {
  assert.deepEqual(knowledgeAttachmentPlan("playbook", false), { usageMode: "prompt", ragEnabled: false });
  assert.deepEqual(knowledgeAttachmentPlan("transcript", false), { usageMode: "auto", ragEnabled: true });
  assert.deepEqual(knowledgeAttachmentPlan("playbook", true), { usageMode: "prompt", ragEnabled: true });
});
