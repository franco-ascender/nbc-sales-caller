// This command only targets the private, user-supplied test destination. It is not a campaign runner.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { openPilotBudget } from './lib/live-pilot-budget.mjs';
import { pilotAgentBody, callForm } from './lib/live-phone-contract.mjs';

const mode = process.argv[2] ?? '--preflight';
if (!['--prepare', '--preflight', '--start', '--sync', '--stop'].includes(mode) || process.argv.length > 3) throw Error('Use --prepare, --preflight, --start, --sync or --stop.');
// Latest user instruction: paid tests must be initiated by the user in the portal.
if (mode === '--start') throw Error('CLI dialing disabled. The user must start tests from the portal.');
const e = parseEnv(readFileSync('.env.local', 'utf8'));
const pilot = JSON.parse(readFileSync('config/caller-pilot.local.json', 'utf8'));
const statePath = 'config/telephone-pilot.local.json';
const op = 'caller-1:telephone';
const auth = `Basic ${Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
const base = `https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}`;
const directory = 'artifacts/readiness/first-live-tests';
async function request(url, headers, init = {}, text = false) {
  const r = await fetch(url, { ...init, headers: { ...headers, ...init.headers }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!r.ok) {
    const error = await r.json().catch(() => ({}));
    const code = typeof error.code === 'number' ? error.code : error.detail?.status;
    const failure = Error(`Provider HTTP ${r.status}${code ? ` (${code})` : ''}. No automatic retry.`);
    failure.status = r.status;
    throw failure;
  }
  return text ? r.text() : r.json();
}
const el = (route, init, text) => request(`https://api.elevenlabs.io/v1/${route}`, { 'xi-api-key': e.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' }, init, text);
const tw = (route, init) => request(`${base}/${route}`, { Authorization: auth }, init);
const state = () => existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
const save = (value, exclusive = false) => writeFileSync(statePath, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: exclusive ? 'wx' : 'w' });
function artifact(name, value) { mkdirSync(directory, { recursive: true, mode: 0o700 }); writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); }
async function preflight(agentId = e.ELEVENLABS_AGENT_ID) {
  if (!/^\+1[2-9]\d{9}$/.test(pilot.destination) || pilot.agency !== 'Nalify') throw Error('Private pilot destination or agency missing.');
  const [agent, subscription, numbers, account, balance, price] = await Promise.all([
    el(`convai/agents/${agentId}`), el('user/subscription'), tw('IncomingPhoneNumbers.json?PageSize=50'),
    request(`${base}.json`, { Authorization: auth }), tw('Balance.json'),
    request('https://pricing.twilio.com/v2/Voice/Countries/US', { Authorization: auth }),
  ]);
  const owned = numbers.incoming_phone_numbers.filter(n => n.capabilities?.voice && /^\+1/.test(n.phone_number));
  const rates = price.outbound_prefix_prices.filter(row => row.destination_prefixes.some(prefix => pilot.destination.slice(1).startsWith(prefix)));
  if (rates.length === 0 || rates.some(row => !(Number(row.current_price) > 0 && Number(row.current_price) <= .014))) throw Error('Destination tariff exceeds the pilot rate ceiling.');
  if (account.status !== 'active' || account.type !== 'Full' || balance.currency !== 'USD' || Number(balance.balance) < 1
    || owned.length !== 1 || subscription.status !== 'active' || subscription.can_extend_character_limit !== false
    || subscription.character_limit - subscription.character_count < 20000) throw Error('Account, number or included usage does not pass the pilot preflight.');
  pilotAgentBody(agent, pilot); // Checks model, audio format and absence of unbudgeted tools.
  return { agent, from: owned[0].phone_number, subscription,
    report: { checkedAt: new Date().toISOString(), sourceLast4: owned[0].phone_number.slice(-4), destinationLast4: pilot.destination.slice(-4),
      maxSeconds: 600, twilioVoicePerMinuteUsd: Math.max(...rates.map(row => Number(row.current_price))),
      includedCreditsRemaining: subscription.character_limit - subscription.character_count, usageExtensionAvailable: subscription.can_extend_character_limit,
      allocationUsd: 2.50, recording: false } };
}
const budget = openPilotBudget('config/first-live-tests.local.sqlite');
try {
  if (mode === '--prepare') {
    const previous = state();
    if (previous && previous.status !== 'validation_rejected') throw Error('Agent creation already prepared. Inspect its saved state; do not create another agent.');
    const current = await preflight();
    const body = pilotAgentBody(current.agent, pilot);
    const hash = createHash('sha256').update(JSON.stringify(body.conversation_config)).digest('hex');
    save({ status: 'creating', sourceAgentId: e.ELEVENLABS_AGENT_ID, hash, createdAt: new Date().toISOString() }, !previous);
    artifact('phone-source-agent', current.agent);
    let created;
    try { created = await el('convai/agents/create', { method: 'POST', body: JSON.stringify(body) }); }
    catch (error) {
      if (error.status === 422) save({ ...state(), status: 'validation_rejected', httpStatus: 422 });
      throw error;
    }
    if (!/^agent_[a-z0-9]+$/.test(created.agent_id)) throw Error('Unexpected agent creation result.');
    save({ status: 'prepared', sourceAgentId: e.ELEVENLABS_AGENT_ID, agentId: created.agent_id, from: current.from, hash, maxSeconds: 600 });
    const verified = await el(`convai/agents/${created.agent_id}`);
    if (verified.conversation_config?.conversation?.max_duration_seconds !== 600 || !verified.platform_settings?.auth?.enable_auth
      || verified.conversation_config?.agent?.first_message !== body.conversation_config.agent.first_message) throw Error('Pilot agent verification failed.');
    artifact('phone-prepared-agent', verified);
    console.log(JSON.stringify({ prepared: true, ...current.report, originalAgentUnchanged: true }));
  } else if (mode === '--preflight') {
    const data = await preflight(state()?.agentId);
    console.log(JSON.stringify({ prepared: state()?.status === 'prepared', ...data.report }, null, 2));
  } else if (mode === '--start') {
    if (budget.get(op)) throw Error('Call already reserved. Use --sync or --stop; never dispatch again.');
    const setup = state();
    if (setup?.status !== 'prepared') throw Error('Pilot agent is not prepared.');
    const current = await preflight(setup.agentId);
    if (current.from !== setup.from || current.agent.conversation_config.conversation.max_duration_seconds !== 600
      || current.agent.platform_settings.call_limits.bursting_enabled !== false) throw Error('Prepared call configuration changed.');
    artifact('phone-preflight', current.report);
    budget.reserve(op, 'caller-1', 'elevenlabs-twilio', 250);
    let receipt = { agentId: setup.agentId, destinationLast4: pilot.destination.slice(-4), preflight: current.report, phase: 'registering' };
    budget.observe(op, 'running', receipt);
    try {
      const xml = await el('convai/twilio/register-call', { method: 'POST', body: JSON.stringify({ agent_id: setup.agentId, from_number: setup.from, to_number: pilot.destination, direction: 'outbound' }) }, true);
      const form = callForm(setup.from, pilot.destination, xml);
      receipt = { ...receipt, phase: 'dispatching' };
      budget.observe(op, 'running', receipt);
      const call = await tw('Calls.json', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      if (!/^CA[0-9a-f]{32}$/i.test(call.sid)) throw Error('No confirmed Twilio call identity.');
      receipt = { ...receipt, phase: 'dispatched', callSid: call.sid, status: call.status };
      budget.observe(op, 'running', receipt);
      artifact('phone-dispatch', call);
      console.log(JSON.stringify({ dispatched: true, status: call.status, destinationLast4: pilot.destination.slice(-4), maxSeconds: 600, budget: budget.summary() }, null, 2));
    } catch (error) {
      budget.observe(op, 'uncertain', { ...receipt, error: error.message });
      throw error;
    }
  } else {
    const operation = budget.get(op), receipt = operation?.receipt;
    if (!/^CA[0-9a-f]{32}$/i.test(receipt?.callSid ?? '')) throw Error('No confirmed call ID. Reconcile the provider before doing anything else.');
    const call = await tw(`Calls/${receipt.callSid}.json`);
    if (mode === '--stop') {
      if (['queued', 'ringing', 'in-progress'].includes(call.status)) await tw(`Calls/${receipt.callSid}.json`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ Status: call.status === 'in-progress' ? 'completed' : 'canceled' }) });
      console.log(JSON.stringify({ stopRequested: true, priorStatus: call.status }));
    } else {
      artifact('phone-twilio-receipt', call);
      const conversations = await el(`convai/conversations?agent_id=${receipt.agentId}&page_size=10`);
      let conversation = null;
      for (const entry of conversations.conversations ?? []) {
        const detail = await el(`convai/conversations/${entry.conversation_id}`);
        if (detail.metadata?.phone_call?.call_sid === call.sid) { conversation = detail; break; }
      }
      if (conversation) artifact('phone-conversation', conversation);
      const terminal = ['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(call.status);
      const report = { status: call.status, durationSeconds: Number(call.duration ?? 0),
        twilioVoiceUsd: call.price_unit === 'USD' && call.price !== null ? Math.abs(Number(call.price)) : null,
        conversationVerified: Boolean(conversation), conversationStatus: conversation?.status ?? null,
        transcriptTurns: conversation?.transcript?.length ?? 0, elevenLabsCredits: conversation?.metadata?.cost ?? null,
        elevenLabsCharging: conversation?.metadata?.charging ?? null,
        totalUsd: null, costScope: 'Voice price and ElevenLabs credits reported separately. Media-stream fees and credit valuation still require reconciliation; full reservation retained.' };
      budget.observe(op, terminal ? (call.status === 'completed' ? 'completed' : 'failed') : 'running', { ...receipt, report });
      artifact('phone-report', report);
      console.log(JSON.stringify({ report, budget: budget.summary() }, null, 2));
    }
  }
} finally { budget.close(); }
