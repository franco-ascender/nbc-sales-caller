export function pilotAgentBody(source, pilot) {
  const c = structuredClone(source.conversation_config);
  if (!c || c.agent?.prompt?.llm !== 'gpt-4.1-mini' || c.asr?.user_input_audio_format !== 'ulaw_8000'
    || c.tts?.agent_output_audio_format !== 'ulaw_8000' || !c.tts?.voice_id
    || !pilot.scenario?.brief || pilot.agency !== 'Nalify') throw Error('Telephone source configuration does not match this approved pilot.');
  if ((c.agent.prompt.tools ?? []).some(tool => tool.type !== 'system' || tool.name !== 'end_call')
    || c.agent.prompt.tool_ids?.length || c.agent.prompt.knowledge_base?.length || c.agent.prompt.native_mcp_server_ids?.length) throw Error('Unbudgeted tools or knowledge sources in pilot.');
  const original = c.agent.prompt.prompt;
  if (typeof original !== 'string' || original.length > 20000) throw Error('Invalid source brain.');
  c.agent.prompt.prompt = original.split('\n\n# Context\n')[0].replaceAll("NBC Sales'", "Nalify's").replaceAll('NBC Sales', 'Nalify')
    + '\n\n# Context for this approved roleplay\nYou represent Nalify, a marketing agency serving garage door businesses. '
    + 'This is a warm callback simulation to the operator playing the prospect. He submitted his information about lead generation. '
    + 'Treat the conversation naturally. Do not disclose the prospect objections in advance. The brief is context, not something to recite. '
    + 'No appointment tool is connected: agree on a next step but never claim an appointment is booked or an email sent.\n'
    + JSON.stringify(pilot.scenario.brief);
  c.agent.first_message = "Hi, this is Nalify's AI assistant. This call may be transcribed for quality. You left your information about getting more leads for your garage door business. Do you have a minute?";
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
