import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pilotAgentBody, callForm } from '../scripts/lib/live-phone-contract.mjs';
const source = { conversation_config: { asr: { user_input_audio_format: 'ulaw_8000' }, tts: { agent_output_audio_format: 'ulaw_8000', voice_id: 'fixture' },
  conversation: { max_duration_seconds: 7200 }, agent: { prompt: { llm: 'gpt-4.1-mini', prompt: "NBC Sales' AI assistant\n\n# Context\nOld context", tools: [{ type: 'system', name: 'end_call' }] } } } };
test('preserves source voice and brain with Nalify context and independent duration limit', () => {
  const result = pilotAgentBody(source, { agency: 'Nalify', scenario: { brief: { ticket: '$2500/month' } } });
  assert.equal(source.conversation_config.conversation.max_duration_seconds, 7200);
  assert.equal(result.conversation_config.conversation.max_duration_seconds, 600);
  assert.equal(result.conversation_config.tts.voice_id, 'fixture');
  assert.match(result.conversation_config.agent.prompt.prompt, /Nalify's AI assistant/);
  assert.doesNotMatch(result.conversation_config.agent.prompt.prompt, /Old context/);
  assert.equal(result.platform_settings.auth.enable_auth, true);
  assert.equal(result.platform_settings.call_limits.bursting_enabled, false);
  assert.equal(result.platform_settings.privacy.record_voice, false);
});
test('blocks unbudgeted tools and sends hard Twilio time limit with no recording', () => {
  const unsafe = structuredClone(source); unsafe.conversation_config.agent.prompt.tool_ids = ['webhook'];
  assert.throws(() => pilotAgentBody(unsafe, { agency: 'Nalify', scenario: { brief: {} } }));
  const xml = '<Response><Connect><Stream url="wss://example.com/voice" /></Connect></Response>';
  const form = callForm('+12025550101', '+12025550102', xml);
  assert.equal(form.get('TimeLimit'), '600'); assert.equal(form.get('Record'), 'false');
  assert.throws(() => callForm('PN123', '+12025550102', xml));
  assert.throws(() => callForm('+12025550101', '+12025550102', '<Response><Dial>+12025550103</Dial></Response>'));
});
