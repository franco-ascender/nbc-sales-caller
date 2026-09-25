import assert from "node:assert/strict";
import test from "node:test";
import { scoreCallerConversation } from "../src/lib/caller-scorecard.ts";

test("scorecard rewards concise listening-led discovery with a next step", () => {
  const result = scoreCallerConversation([
    { role: "agent", message: "How are you handling lead follow-up today?", time_in_call_secs: 1 },
    { role: "user", message: "We use spreadsheets and many interested people never hear back from us.", time_in_call_secs: 5 },
    { role: "agent", message: "It sounds like the handoff is costing opportunities. What impact does that have on monthly growth?", time_in_call_secs: 7 },
    { role: "user", message: "We probably miss twenty qualified conversations each month and want a consistent process.", time_in_call_secs: 13 },
    { role: "agent", message: "Who else is involved in deciding how to improve it?", time_in_call_secs: 15 },
    { role: "user", message: "My partner and I decide together, ideally this quarter.", time_in_call_secs: 20 },
    { role: "agent", message: "You need a reliable process that recovers missed opportunities this quarter. Would a discovery call be a useful next step?", time_in_call_secs: 22 },
  ]);
  assert.equal(result.completeEnough, true);
  assert.ok(result.overall >= 80);
  assert.equal(result.averageResponseSeconds, 2);
});

test("scorecard flags monologues, stacked questions and missing discovery", () => {
  const result = scoreCallerConversation([
    { role: "agent", message: "We have many amazing solutions and capabilities that transform every part of your organization with a complete suite of powerful systems, strategy, automation, coaching, analytics and support designed to solve virtually every challenge you might have. What is your budget? Who decides? When can you buy?", time_in_call_secs: 1 },
    { role: "user", message: "I am not sure.", time_in_call_secs: 5 },
    { role: "agent", message: "Would you like to hear more?", time_in_call_secs: 7 },
  ]);
  assert.equal(result.completeEnough, false);
  assert.ok(result.overall < 65);
  assert.ok(result.coaching.length >= 2);
});

test("scorecard detects a sales question after an explicit stop request", () => {
  const result = scoreCallerConversation([
    { role: "agent", message: "What are you trying to improve?", time_in_call_secs: 1 },
    { role: "user", message: "Please stop calling me.", time_in_call_secs: 3 },
    { role: "agent", message: "Can I ask why?", time_in_call_secs: 4 },
  ]);
  assert.equal(result.metrics.find(metric => metric.id === "stop")?.score, 0);
});
