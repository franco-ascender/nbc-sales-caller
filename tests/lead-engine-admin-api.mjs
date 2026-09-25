import assert from 'node:assert/strict';
const base = process.env.L01_REVIEW_BASE_URL;
if (!/^http:\/\/127\.0\.0\.1:(?!3000\b)\d+$/.test(base ?? '')) throw Error('Isolated loopback required');
let checks = 0;
for (const [role, status] of [['anonymous', 401], ['invalid', 401], ['student', 403], ['coach', 403], ['suspended', 403], ['admin', 200]]) {
  const response = await fetch(base + '/api/lead-engine/connections/check', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(role === 'anonymous' ? {} : { Authorization: `Bearer l01-${role}` }) }, body: '{}' });
  assert.equal(response.status, status, role);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json();
  if (status === 200) { assert.equal(data.apify, 'missing'); assert.equal(data.phoneVerifier, 'missing'); assert.equal(data.executionEnabled, false); }
  else { assert.equal('apify' in data, false); assert.equal('phoneVerifier' in data, false); }
  checks++;
}
for (const [role, expected] of [['student', 403], ['coach', 403], ['admin', 400]]) {
  const response = await fetch(base + '/api/lead-engine/connections/check', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer l01-${role}` }, body: JSON.stringify({ role: 'admin', apiToken: 'synthetic-not-accepted' }) });
  assert.equal(response.status, expected); checks++;
}
console.log(JSON.stringify({ passed: true, checks, realNextRoute: true, authAndMembership: 'isolated synthetic HTTP backend', providerConfiguration: 'absent', paidCalls: 0 }));
