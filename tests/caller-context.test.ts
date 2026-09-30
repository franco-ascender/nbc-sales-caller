import './caller-test-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyCallerContext, parseCallerContext } from '../src/lib/caller-context.ts';
import { parseConversationScenario, compileScenarioPrompt } from '../src/lib/caller-knowledge.ts';
import { consolidateScenario } from '../src/lib/caller-brief.ts';
import { defaultPhoneScenario } from '../src/lib/caller-default-scenario.ts';
import { phoneScenario } from '../src/lib/phone-scenario.ts';
const scenarioRoutes = await import('../src/app/api/caller/scenarios/route.ts');
const sessionRoutes = await import('../src/app/api/caller/sessions/route.ts');
const { dispatchRetell } = await import('../src/services/retell-phone.service.ts');
const { openingDisclosure } = await import('../src/lib/caller-disclosure.ts');

const context = { ...emptyCallerContext(), business: 'Fixture garage marketing business.', leadSource: 'Requested information on our website.', qualification: 'Ask about service area and current capacity.', boundaries: 'No guaranteed lead volume.', proof: 'Only approved examples.', nextStep: 'Offer a discovery meeting if a real booking tool is connected.', answers: [{ kind: 'question' as const, question: 'Is advertising included?', answer: 'Ad spend is not confirmed in the supplied offer. Confirm it before agreeing to terms.' }, { kind: 'objection' as const, question: 'My last agency failed.', answer: 'What specifically fell short? We can discuss whether this approach addresses that gap.' }] };

test('old scenario snapshots remain unchanged; additional facts and answer guidance survive compilation', () => {
  assert.deepEqual(parseConversationScenario(defaultPhoneScenario), defaultPhoneScenario);
  const parsed = parseConversationScenario({ ...defaultPhoneScenario, context });
  assert.deepEqual(parsed.context, context);
  const prompt = compileScenarioPrompt(parsed).prompt;
  for (const value of Object.values(context).filter(v => typeof v === 'string')) assert.ok(prompt.includes(value));
  for (const answer of context.answers) { assert.ok(prompt.includes(answer.question)); assert.ok(prompt.includes(answer.answer)); }
  assert.match(prompt, /same business and offer/);
  assert.match(prompt, /when interrupted/);
  assert.match(prompt, /An opt-out takes priority/);
  assert.match(prompt, /without a successful connected-tool receipt/);
  assert.ok(prompt.indexOf('RESPONSE RULES') > prompt.indexOf(context.answers[1].answer));
  assert.equal(phoneScenario(parsed).prompt, prompt);
});

test('context rejects incomplete answers, malformed shapes, controls, oversized fields and aggregate overflow', () => {
  for (const value of [null, [], 'text', { business: {} }, { answers: {} }, { answers: [null] }, { answers: [{ kind: 'override', question: 'Q', answer: 'A' }] }, { answers: [{ kind: 'question', question: ' ', answer: 'A' }] }, { answers: [{ kind: 'question', question: 'Q', answer: '' }] }, { proof: '\u0000' }, { business: 'x'.repeat(1801) }, { answers: Array(13).fill(context.answers[0]) }]) assert.throws(() => parseCallerContext(value));
  assert.throws(() => parseCallerContext({ ...context, business: 'x'.repeat(1800), answers: Array(12).fill({ kind: 'question', question: 'Q', answer: 'A'.repeat(1100) }) }), /12,000/);
  assert.deepEqual(parseCallerContext({ business: '  A\r\nB ' }), { ...emptyCallerContext(), business: 'A\nB' });
});

test('real save/browser routes and phone adapter carry a >8KB context with owner checks, no real provider calls', async () => {
  const names = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','NBC_OPERATOR_EMAIL','ELEVENLABS_API_KEY','ELEVENLABS_AGENT_ID','ELEVENLABS_WEB_AGENT_ID','RETELL_API_KEY','CALLER_WEBHOOK_ORIGIN'];
  const previous = names.map(n => process.env[n]), original = fetch;
  const values = ['https://context-fixture.supabase.co','fixture-public','fixture-secret','fixture@example.test','fixture','fixture-agent','fixture-agent','fixture','https://context.example.test'];
  names.forEach((n,i) => { process.env[n] = values[i]; });
  const owner = '11111111-1111-4111-8111-111111111111', id = '22222222-2222-4222-8222-222222222222';
  const expanded = parseConversationScenario(consolidateScenario({ ...defaultPhoneScenario, context: { ...context, answers: Array.from({ length: 8 }, (_, i) => ({ kind: 'question', question: `Fixture question ${i}`, answer: 'Specific approved business detail. '.repeat(30) + `tail-${i}` })) } }));
  const req = (path: string, body: unknown, auth = 'admin') => new Request(`https://context.example.test${path}`, { method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let role = "admin";
  let saved: Record<string, unknown> | null = null, sessionBrief: unknown, providerAuthorizations = 0;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input)), method = init?.method ?? 'GET', body = init?.body ? JSON.parse(String(init.body)) : null;
    if (u.hostname === 'context-fixture.supabase.co') {
      if (u.pathname === '/auth/v1/user') return Response.json({ id: owner, email: 'fixture@example.test', email_confirmed_at: '2026-09-30T00:00:00Z' });
      if (u.pathname === '/rest/v1/nbc_members') return Response.json([{ id: owner, role, status: 'active', display_name: 'Fixture' }]);
      if (u.pathname.endsWith('/caller_conversation_scenarios')) {
        if (method === 'POST') { assert.equal(body.created_by, owner); saved = { ...body, created_at: new Date().toISOString() }; return Response.json(saved, { status: 201 }); }
        assert.equal(u.searchParams.get('created_by'), `eq.${owner}`); return Response.json(saved ? [saved] : []);
      }
      if (u.pathname.endsWith('/call_sessions')) {
        if (method === 'POST') { assert.equal(body.operator_id, owner); sessionBrief = body.scenario_brief; return new Response(null, { status: 201 }); }
        assert.equal(u.searchParams.get('operator_id'), `eq.${owner}`);
        if (method === 'HEAD') return new Response(null, { headers: { 'content-range': '0-0/0' } });
        if (method === 'PATCH' && u.searchParams.has('select')) return Response.json({ id });
        if (method === 'PATCH') return new Response(null, { status: 204 });
        return Response.json([]);
      }
    }
    if (u.hostname === 'api.elevenlabs.io') {
      assert.equal(method, 'GET', 'No provider configuration writes');
      if (u.pathname.includes('/agents/')) return Response.json({ conversation_config: { agent: { first_message: openingDisclosure(true) }, conversation: { max_duration_seconds: 600 } }, platform_settings: { privacy: { record_voice: true } } });
      if (u.pathname.includes('get-signed-url')) { providerAuthorizations++; return Response.json({ signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?conversation_id=conv_fixture&conversation_signature=fixture' }); }
    }
    if (u.hostname === 'api.retellai.com' && u.pathname === '/v2/create-phone-call') {
      assert.equal(body.retell_llm_dynamic_variables.nbc_scenario, compileScenarioPrompt(expanded).prompt);
      assert.match(body.retell_llm_dynamic_variables.nbc_scenario, /tail-7/);
      return Response.json({ call_id: 'call_fixture', agent_id: 'agent_fixture', from_number: '+13055550123', to_number: '+13055550124' });
    }
    throw new Error(`Unexpected fixture request: ${method} ${u.pathname}`);
  };
  try {
    const body = { requestId: id, scenario: expanded };
    assert.ok(JSON.stringify(body).length > 8192);
    const save = await scenarioRoutes.POST(req('/api/caller/scenarios', body));
    assert.equal(save.status, 201, await save.clone().text());
    assert.deepEqual((await save.json()).scenario.brief, expanded);
    assert.equal((await scenarioRoutes.POST(req('/api/caller/scenarios', body))).status, 201, 'Same request is idempotent');
    assert.equal((await scenarioRoutes.POST(req('/api/caller/scenarios', { ...body, scenario: { ...expanded, title: 'Changed' } }))).status, 409);
    const result = await sessionRoutes.POST(req('/api/caller/sessions', { sessionId: id, scenario: expanded }));
    assert.equal(result.status, 201, await result.clone().text());
    assert.deepEqual(sessionBrief, expanded);
    assert.equal((await result.json()).conversationOverride.prompt, compileScenarioPrompt(expanded).prompt);
    assert.equal(providerAuthorizations, 1);
    await dispatchRetell({ agentId: 'agent_fixture', version: 0, from: '+13055550123' } as never, '+13055550124', 'fixture', phoneScenario(expanded));
    assert.equal((await sessionRoutes.POST(req('/api/caller/sessions', { sessionId: id, scenario: { ...expanded, context: { answers: [{}] } } }))).status, 400);
    assert.equal((await scenarioRoutes.POST(req('/api/caller/scenarios', { requestId: id, scenario: 'x'.repeat(132000) }))).status, 413);
    role = 'student';
    assert.equal((await scenarioRoutes.POST(req('/api/caller/scenarios', body))).status, 403);
    assert.equal((await sessionRoutes.POST(req('/api/caller/sessions', { sessionId: id, scenario: expanded }))).status, 403);
    assert.equal(providerAuthorizations, 1, 'Invalid requests never authorize a voice session');
  } finally { globalThis.fetch = original; names.forEach((n,i) => { if (previous[i] === undefined) delete process.env[n]; else process.env[n] = previous[i]; }); }
});
