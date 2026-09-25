import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/202609210560_caller_webhook_finality.sql", "utf8");

test("late post-call deliveries enrich but cannot regress terminal state or transcript", () => {
  assert.match(sql, /target\.status in \('completed','failed'\).*target\.status else p_status/s);
  assert.match(sql, /jsonb_array_length\(p_transcript\) > jsonb_array_length\(transcript\)/);
  assert.match(sql, /char_length\(p_transcript::text\) >= char_length\(transcript::text\)/);
  assert.match(sql, /target\.status='completed' then null/);
});
