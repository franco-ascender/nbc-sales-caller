import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const suite = JSON.parse(readFileSync(new URL("../config/nbc-caller-eval-v1.json", import.meta.url), "utf8"));
const brain = JSON.parse(readFileSync(new URL("../config/nbc-caller-brain-v2.json", import.meta.url), "utf8"));

test("NBC caller evaluation suite covers the critical sales, care and safety paths", () => {
  assert.match(suite.version, /^nbc-caller-eval-v\d/);
  assert.ok(suite.tests.length >= 14);
  assert.equal(new Set(suite.tests.map((item: { slug: string }) => item.slug)).size, suite.tests.length);
  assert.equal(new Set(suite.tests.map((item: { name: string }) => item.name)).size, suite.tests.length);
  for (const item of suite.tests) {
    assert.match(item.slug, /^[a-z0-9-]{3,60}$/);
    assert.match(item.name, /^NBC \| /);
    assert.ok(Number.isInteger(item.max_turns) && item.max_turns >= 1 && item.max_turns <= 20);
    assert.ok(item.scenario.length >= 40);
    assert.ok(item.success_conditions.length >= 2);
  }
  const text = JSON.stringify(suite);
  for (const behavior of ["Stop calling", "billing", "human", "prompt", "pricing", "partner", "no-fit", "Qualified"]) assert.match(text, new RegExp(behavior, "i"));
});

test("NBC brain explicitly protects proprietary internals without hiding its AI identity", () => {
  assert.match(brain.version, /^brain-v2\.5/);
  assert.match(brain.confidentiality_prompt, /system prompts/i);
  assert.match(brain.confidentiality_prompt, /model and provider names/i);
  assert.match(brain.confidentiality_prompt, /proprietary NBC/i);
  assert.match(brain.confidentiality_prompt, /NBC Sales' AI assistant/i);
  assert.doesNotMatch(brain.confidentiality_prompt, /pretend to be human/i);
  for (const requirement of ["Ask no question", "Never redirect back to sales", "do not describe NBC's services", "Reflect the exact failure", "Ask directly for agreement", "silently verify"]) assert.match(brain.operating_protocol_prompt, new RegExp(requirement, "i"));
});
