import { recordCallerUsage } from './account-usage';
import { BROWSER_TEST_MAX_DURATION_SECONDS, ensureCallerDisclosure } from "./caller-voices.service";
import "server-only";
import { database, IntegrationError } from "./integration.service";
import type { CallSession, ReconcilePage, ReconcileResult, SessionPage } from "@/lib/caller-types";
import { createVoiceAuthorization, elevenRead } from "./elevenlabs.service";
import { normalizeConversation } from "@/lib/caller-validation";
import { encodeSessionCursor, sessionCursorFilter } from "@/lib/caller-pagination";
import type { SessionPageOptions } from "@/lib/caller-pagination";
import { retainFinalResult } from "@/lib/caller-insights";
import { compileScenarioPrompt } from "@/lib/caller-knowledge";
import type { ConversationScenario } from "@/lib/caller-knowledge";
import { RECORDING_NOTICE, TRANSCRIPT_NOTICE } from "@/lib/caller-disclosure";
import { voiceUsage } from "@/lib/usage";

export const sessionFields = "is_demo,lead_id,id,provider,provider_call_id,channel,status,scenario_title,scenario_type,created_at,started_at,ended_at,duration_seconds,cost_microusd,cost_scope,transcript,summary,post_call_analysis,analysis_review,failure_code,synced_at";

function webAgentId(): string {
  const agent = process.env.ELEVENLABS_WEB_AGENT_ID || process.env.ELEVENLABS_AGENT_ID;
  if (!agent) throw new IntegrationError(503, "Connect the private ElevenLabs browser agent before starting a conversation.");
  return agent;
}

export async function listSessionPage(operatorId: string, options: SessionPageOptions, pendingOnly = false, demo = false): Promise<SessionPage> {
  let query = database().from("call_sessions").select(sessionFields).eq("operator_id", operatorId).eq("is_demo", demo)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(options.limit + 1);
  if (pendingOnly) query = query.in("status", ["preparing", "ready", "active", "processing", "expired"]);
  if (options.cursor) query = query.or(sessionCursorFilter(options.cursor));
  const { data, error } = await query;
  if (error) throw new IntegrationError(503, "Call history is unavailable. Try refreshing it again.");
  const rows = data as CallSession[];
  const sessions = rows.slice(0, options.limit);
  return { sessions, nextCursor: rows.length > options.limit ? encodeSessionCursor(sessions[sessions.length - 1]) : null };
}

export async function listSessions(operatorId: string): Promise<CallSession[]> {
  return (await listSessionPage(operatorId, { limit: 30, cursor: null })).sessions;
}

export async function ownedSession(operatorId: string, id: string): Promise<CallSession & { provider_agent_id: string }> {
  const { data, error } = await database().from("call_sessions").select(`${sessionFields},provider_agent_id`).eq("id", id).eq("operator_id", operatorId).eq("is_demo", false).maybeSingle();
  if (error) throw new IntegrationError(503, "The test session could not be loaded.");
  if (!data) throw new IntegrationError(404, "That test session was not found in your workspace.");
  return data as CallSession & { provider_agent_id: string };
}

export async function startWebSession(operatorId: string, id: string, scenario?: ConversationScenario): Promise<{ sessionId: string; signedUrl: string; conversationId: string; maxDurationSeconds: number; conversationOverride?: { prompt: string; firstMessage: string } }> {
  if (!process.env.ELEVENLABS_API_KEY) throw new IntegrationError(503, "Connect the private ElevenLabs test agent before starting a conversation.");
  const agent = webAgentId();
  const disclosure = await ensureCallerDisclosure();
  const db = database();
  const { error: cleanupError } = await db.from("call_sessions").update({ status: "expired", failure_code: "session_timeout" }).eq("operator_id", operatorId).eq("is_demo", false).in("status", ["preparing", "ready", "active"]).lt("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
  if (cleanupError) throw new IntegrationError(503, "The caller database is not ready.");
  // A browser can fail after it received a signed URL. Ask the provider about
  // the one open session before rejecting the next Start: a failed handshake
  // becomes final immediately instead of holding the unique active-session row
  // for ten minutes.
  const open = await db.from("call_sessions").select("id").eq("operator_id", operatorId).eq("is_demo", false).in("status", ["preparing", "ready", "active"]).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (open.error) throw new IntegrationError(503, "The caller database is not ready.");
  if (open.data?.id) {
    try { await syncSession(operatorId, open.data.id); }
    catch { /* A provider outage must keep the existing session protected. */ }
  }
  const { count, error: countError } = await db.from("call_sessions").select("id", { count: "exact", head: true }).eq("operator_id", operatorId).eq("is_demo", false).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if (countError) throw new IntegrationError(503, "The test limit could not be checked.");
  if ((count ?? 0) >= 20) throw new IntegrationError(429, "The workspace has reached its 20 test starts in 24 hours.");
  const { error } = await db.from("call_sessions").insert({
    id,
    operator_id: operatorId,
    provider: "elevenlabs",
    provider_agent_id: agent,
    channel: "web",
    status: "preparing",
    scenario_title: scenario?.title ?? null,
    scenario_type: scenario?.conversationType ?? null,
    scenario_brief: scenario ?? null,
  });
  if (error) throw new IntegrationError(error.code === "23505" ? 409 : 503, error.code === "23505" ? "A test session is already open or this start was already used. Refresh its result before starting another." : "The test session could not be reserved.");
  try {
    const authorization = await createVoiceAuthorization(agent);
    const { data, error: saveError } = await db.from("call_sessions").update({ status: "ready", provider_call_id: authorization.conversationId }).eq("id", id).eq("operator_id", operatorId).eq("status", "preparing").select("id").single();
    if (saveError || !data) throw new IntegrationError(503, "The voice session could not be saved. No conversation was started.");
    const compiled = scenario ? compileScenarioPrompt(scenario) : null;
    const notice = disclosure.recordVoice ? RECORDING_NOTICE : TRANSCRIPT_NOTICE;
    return {
      sessionId: id,
      ...authorization,
      maxDurationSeconds: BROWSER_TEST_MAX_DURATION_SECONDS,
      ...(compiled ? { conversationOverride: { prompt: compiled.prompt, firstMessage: `${notice} ${compiled.firstMessage}` } } : {}),
    };
  } catch (caught) {
    await db.from("call_sessions").update({ status: "failed", failure_code: "authorization_failed" }).eq("id", id).eq("operator_id", operatorId).eq("status", "preparing");
    throw caught;
  }
}

function publicSession(session: CallSession & { provider_agent_id: string }): CallSession {
  const { provider_agent_id: _agent, ...result } = session;
  return result;
}

// Compare-and-set protects text as well as states across simultaneous sync/reconcile requests.
async function saveResult(operatorId: string, initial: CallSession, patch: Partial<CallSession>): Promise<CallSession> {
  let current = initial;
  for (let attempt = 0; attempt < 3; attempt++) {
    const merged = retainFinalResult(current, { ...current, ...patch });
    if (merged === current) return current;
    const { status, started_at, ended_at, duration_seconds, cost_microusd, cost_scope, transcript, summary, post_call_analysis, failure_code } = merged;
    let query = database().from("call_sessions").update({ status, started_at, ended_at, duration_seconds, cost_microusd: cost_microusd ?? null, cost_scope: cost_scope ?? "unknown", transcript, summary, post_call_analysis: post_call_analysis ?? null, failure_code, synced_at: new Date(Math.max(Date.now(), current.synced_at ? Date.parse(current.synced_at) + 1 : 0)).toISOString() })
      .eq("id", current.id).eq("operator_id", operatorId).eq("status", current.status);
    query = current.synced_at ? query.eq("synced_at", current.synced_at) : query.is("synced_at", null);
    const { data, error } = await query.select(sessionFields).maybeSingle();
    if (error) throw new IntegrationError(503, "The conversation result could not be saved. Refresh it again shortly.");
    if (data) return data as CallSession;
    current = publicSession(await ownedSession(operatorId, current.id));
  }
  throw new IntegrationError(503, "This result is being updated. Refresh it again shortly.");
}

export async function syncSession(operatorId: string, id: string): Promise<CallSession> {
  const owned = await ownedSession(operatorId, id);
  const session = publicSession(owned);
  if (["completed", "failed"].includes(session.status)) return session;
  const expired = Date.now() - Date.parse(session.created_at) > 10 * 60_000;
  if (!session.provider_call_id) return expired ? saveResult(operatorId, session, { status: "expired", failure_code: "session_timeout" }) : session;
  if (session.provider !== "elevenlabs") throw new IntegrationError(503, "Recovery is not configured for this session.");
  let payload: unknown;
  try { payload = await elevenRead(`/v1/convai/conversations/${encodeURIComponent(session.provider_call_id)}`); }
  catch (error) {
    if (error instanceof IntegrationError && error.status === 404) {
      return expired ? saveResult(operatorId, session, { status: "expired", failure_code: "never_connected" }) : session;
    }
    throw error;
  }
  let result;
  try { result = normalizeConversation(payload, { agentId: owned.provider_agent_id, conversationId: session.provider_call_id }); }
  catch { throw new IntegrationError(502, "The provider result could not be verified for this test session."); }
  const usage=voiceUsage(payload);
  if (['completed','failed'].includes(result.status)) await recordCallerUsage(operatorId,id,payload,session.created_at);
  return saveResult(operatorId, session, {...result,cost_microusd:usage.costMicrousd,cost_scope:usage.costScope});
}

export async function reconcileSessions(operatorId: string, options: SessionPageOptions): Promise<ReconcilePage> {
  if (options.limit > 5) throw new IntegrationError(400, "Recover at most five sessions at a time.");
  const page = await listSessionPage(operatorId, options, true);
  const results = await Promise.all(page.sessions.map(async (row): Promise<ReconcileResult> => {
    try {
      const session = await syncSession(operatorId, row.id);
      const outcome = session.status === "completed" || session.status === "failed" || session.status === "expired" ? session.status : "pending";
      return { sessionId: row.id, outcome, session };
    } catch {
      return { sessionId: row.id, outcome: "retry", error: "This session could not be recovered. Refresh its result to retry." };
    }
  }));
  return { results, nextCursor: page.nextCursor };
}

export async function reviewSessionAnalysis(operatorId: string, id: string, review: { primary_objection: string; customer_issue_category: string; next_step: string; note: string }): Promise<CallSession> {
  const current = await ownedSession(operatorId, id);
  if (current.is_demo || !["completed", "failed"].includes(current.status) || !current.post_call_analysis) throw new IntegrationError(409, "A completed enriched conversation is required before review.");
  const analysis_review = { ...review, reviewed_at: new Date().toISOString() };
  const { data, error } = await database().from("call_sessions").update({ analysis_review }).eq("id", id).eq("operator_id", operatorId).eq("is_demo", false).select(sessionFields).maybeSingle();
  if (error || !data) throw new IntegrationError(503, "The analysis review could not be saved. Try again.");
  return data as CallSession;
}
