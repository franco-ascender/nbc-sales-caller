import assert from "node:assert/strict";
import test from "node:test";
import config from "../next.config.ts";

test("all application routes receive browser security headers without blocking Caller audio", async () => {
  assert.equal(typeof config.headers, "function");
  const rules = await config.headers!();
  const headers = new Map(rules[0].headers.map(item => [item.key.toLowerCase(), item.value]));
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(headers.get("permissions-policy") || "", /microphone=\(self\)/);
  const csp = headers.get("content-security-policy") || "";
  for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'", "wss://api.elevenlabs.io", "https://*.supabase.co"]) assert.match(csp, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-eval/);
});
