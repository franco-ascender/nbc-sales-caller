// Real bundled SDK + browser microphone/audio worklets; provider and APIs are
// intercepted before navigation. This must never create a paid conversation.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const origin = process.env.TARGET_URL || 'http://127.0.0.1:3137';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const errors = [], worklets = new Set();
let starts = 0, frames = 0, closes = 0, session, socket;
try {
  const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => errors.push(e.message));

  await page.addInitScript(() => {
    const load = AudioWorklet.prototype.addModule;
    AudioWorklet.prototype.addModule = function (...args) {
      (window.__audioLoads ||= []).push(args[0]);
      return window.__failAudioLoad ? Promise.reject(new Error('Audio worklet unavailable')) : load.apply(this, args);
    };
  });
  await page.routeWebSocket(/wss?:\/\//, ws => {
    assert.match(ws.url(), /^wss:\/\/api\.elevenlabs\.io\//); socket = ws;
    ws.onClose(() => { closes++; });
    ws.onMessage(raw => {
      const message = JSON.parse(raw);
      if (message.type === 'conversation_initiation_client_data') ws.send(JSON.stringify({ type: 'conversation_initiation_metadata', conversation_initiation_metadata_event: { conversation_id: session.provider_call_id, agent_output_audio_format: 'pcm_16000', user_input_audio_format: 'pcm_16000' } }));
      if (message.user_audio_chunk) frames++;
    });
  });
  const now = new Date().toISOString(), id = '00000000-0000-4000-8000-000000000001';
  await page.route('**/auth/v1/**', r => r.fulfill({ json: { access_token: 'fixture', refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.test' } } }));
  await page.route('**/api/**', async r => {
    const req = r.request(), p = new URL(req.url()).pathname;
    if (p === '/api/workspace/session') return r.fulfill({ json: { user: { id, name: 'Audio fixture', role: 'admin' } } });
    if (p === '/api/caller/sessions' && req.method() === 'POST') {
      starts++; const body = req.postDataJSON();
      session = { id: body.sessionId, provider_call_id: 'conv_fixture_' + starts, status: 'ready', created_at: now, transcript: [], is_demo: false, provider: 'elevenlabs', channel: 'web' };
      return r.fulfill({ json: { sessionId: session.id, signedUrl: 'wss://api.elevenlabs.io/v1/convai/conversation?fixture=true', conversationId: session.provider_call_id, maxDurationSeconds: 600 } });
    }
    if (/\/sessions\/[^/]+\/sync$/.test(p)) { session = { ...session, status: 'completed', duration_seconds: 2, synced_at: now }; return r.fulfill({ json: { session } }); }
    if (p.endsWith('/sessions') || p.endsWith('/sessions/reconcile')) return r.fulfill({ json: { configured: true, sessions: session ? [session] : [], nextCursor: null, updated: 0, results: [] } });
    if (p.endsWith('/pipeline')) return r.fulfill({ json: { version: id, defaultId: id, buckets: [{ id, name: 'New leads', color: 'slate', outcome: 'active', position: 0, default_key: 'new' }] } });
    if (p.endsWith('/phone-test')) { assert.equal(req.method(), 'GET', 'No real telephone call permitted'); return r.fulfill({ json: { slots: [], pending: false, phoneEngine: 'retell', verification: {} } }); }
    return r.fulfill({ json: { configured: true, sessions: [], scenarios: [], calls: [], assets: [], sources: [], lists: [], leads: [], views: [], view: null, available: false, exists: false } });
  });
  await page.goto(origin + '/caller');
  await page.getByLabel('Email address', { exact: true }).fill('fixture@example.test');
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Enter NBC Sales' }).click();
  await page.getByRole('tab', { name: 'Conversation Lab', exact: true }).click();
  const show = page.getByRole('button', { name: 'Show voice test', exact: true }); if (await show.isVisible()) await show.click();
  const start = page.getByRole('button', { name: 'Start voice test', exact: true });
  const end = page.getByRole('button', { name: 'End voice test', exact: true });
  // Fail the first worklet load, then recover without reloading the app.
  await page.evaluate(() => { window.__failAudioLoad = true; }); await start.click();
  await page.getByRole('alert').filter({ hasText: 'Browser audio could not initialize' }).waitFor();
  await page.evaluate(() => { window.__failAudioLoad = false; });
  for (let i = 0; i < 6; i++) {
    await start.click(); await end.waitFor();
    await page.getByText('Connected', { exact: true }).waitFor();
    const before = frames; await page.waitForTimeout(500); assert.ok(frames > before, 'Real input worklet sends microphone PCM');
    socket.send(JSON.stringify({ type: 'agent_response', agent_response_event: { agent_response: 'Fixture response ' + i } }));
    socket.send(JSON.stringify({ type: 'audio', audio_event: { audio_base_64: Buffer.alloc(3200).toString('base64'), event_id: i + 1 } }));
    await page.getByText('Fixture response ' + i, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
    await page.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
    await end.click(); await start.waitFor(); await page.waitForTimeout(200);
    assert.deepEqual((await page.getByRole('alert').allTextContents()).filter(Boolean), []);
  }
  assert.equal(starts, 7); assert.ok(closes >= 6); for (const path of await page.evaluate(() => window.__audioLoads)) worklets.add(path); assert.equal(worklets.size, 2); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ starts, completedCycles: 6, failedAudioThenRecovered: true, worklets: [...worklets], microphoneFrames: frames, errors, paidCalls: 0 }));
} finally { await browser.close(); }
