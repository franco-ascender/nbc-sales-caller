import { nalifyConversation } from './nalify-conversation.mjs';
export function pilotAgentBody(source, pilot) {
  const c = structuredClone(source.conversation_config);
  if (!c || c.agent?.prompt?.llm !== 'gpt-4.1-mini' || c.asr?.user_input_audio_format !== 'ulaw_8000'
    || c.tts?.agent_output_audio_format !== 'ulaw_8000' || !c.tts?.voice_id
    || !pilot.scenario?.brief || pilot.agency !== 'Nalify') throw Error('Telephone source configuration does not match this approved pilot.');
  if ((c.agent.prompt.tools ?? []).some(tool => tool.type !== 'system' || tool.name !== 'end_call')
    || c.agent.prompt.tool_ids?.length || c.agent.prompt.knowledge_base?.length || c.agent.prompt.native_mcp_server_ids?.length) throw Error('Unbudgeted tools or knowledge sources in pilot.');
  c.agent.prompt.prompt = nalifyConversation(pilot.scenario.brief);
  c.agent.first_message = "Hi, this is Nalify's AI assistant. This call may be transcribed. You asked about garage door leads. Is now a good time?";
  c.tts.speed = 0.9;
  c.turn = { ...c.turn, turn_eagerness: 'patient', turn_timeout: 7 };
  c.agent.language = 'en'; c.agent.prompt.max_tokens = 140;
  c.conversation.max_duration_seconds = 600;
  c.conversation.file_input = { enabled: false, max_files_in_memory: 1, max_files_per_conversation: 1 };
  return {
    name: 'NBC — Nalify approved phone pilot 2026-09-25', conversation_config: c,
    platform_settings: {
      auth: { enable_auth: true, allowlist: [], require_origin_header: false },
      call_limits: { agent_concurrency_limit: 1, daily_limit: 2, bursting_enabled: false },
      privacy: { record_voice: false, retention_days: 30, delete_audio: true, delete_transcript_and_pii: false },
    },
  };
}
export function callForm(from, to, twiml) {
  if (![from, to].every(phone => typeof phone === 'string' && /^\+1[2-9]\d{9}$/.test(phone))) throw Error('US pilot numbers required.');
  if (typeof twiml !== 'string' || twiml.length > 4000 || !twiml.includes('<Response>') || !twiml.includes('<Stream ')
    || !twiml.includes('wss://') || /<(Dial|Record|Redirect|Pay|Say)\b/i.test(twiml)) throw Error('Unexpected register-call TwiML.');
  return new URLSearchParams({ From: from, To: to, Twiml: twiml, TimeLimit: '600', Timeout: '25', Record: 'false' });
}
