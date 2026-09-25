import "server-only";
import { createHash } from "node:crypto";
import { parseElevenLabsPostCallEvent, validElevenLabsWebhook } from "@/lib/caller-telephony-validation";
import { normalizeConversation } from "@/lib/caller-validation";
import { voiceUsage } from "@/lib/usage";
import { database, IntegrationError } from "./integration.service";

const MAX_WEBHOOK_BYTES = 4 * 1024 * 1024;

async function rawBody(request: Request): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BYTES) throw new IntegrationError(413, "Post-call event too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new IntegrationError(400, "Missing post-call event.");
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    bytes += part.value.length;
    if (bytes > MAX_WEBHOOK_BYTES) { await reader.cancel(); throw new IntegrationError(413, "Post-call event too large."); }
    chunks.push(part.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function processElevenLabsPostCall(request: Request): Promise<{ received: true; duplicate: boolean; matched: boolean }> {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  const phoneAgent = process.env.ELEVENLABS_AGENT_ID, webAgent = process.env.ELEVENLABS_WEB_AGENT_ID;
  if (!secret || !phoneAgent || !webAgent) throw new IntegrationError(503, "Post-call processing is not configured.");
  const body = await rawBody(request);
  if (!validElevenLabsWebhook(request.headers.get("elevenlabs-signature"), body, secret)) throw new IntegrationError(401, "Invalid post-call signature.");
  let payload: unknown; try { payload = JSON.parse(body); } catch { throw new IntegrationError(400, "Invalid post-call event."); }
  let event; try { event = parseElevenLabsPostCallEvent(payload, new Set([phoneAgent, webAgent])); } catch { throw new IntegrationError(400, "Invalid post-call event."); }
  let result; try { result = normalizeConversation(event.data, { agentId: event.agentId, conversationId: event.conversationId }); } catch { throw new IntegrationError(400, "Invalid post-call conversation."); }
  if (!["completed", "failed"].includes(result.status)) throw new IntegrationError(400, "Post-call result is not final.");
  const usage = voiceUsage(event.data);
  const receipt = createHash("sha256").update(body).digest("hex");
  const { data, error } = await database().rpc("caller_apply_elevenlabs_postcall", {
    p_receipt: receipt,
    p_event_at: new Date(event.eventTimestamp * 1000).toISOString(),
    p_call: event.conversationId,
    p_agent: event.agentId,
    p_status: result.status,
    p_started: result.started_at,
    p_ended: result.ended_at,
    p_duration: result.duration_seconds,
    p_transcript: result.transcript,
    p_summary: result.summary,
    p_analysis: result.post_call_analysis,
    p_failure: result.failure_code,
    p_cost: usage.costMicrousd,
    p_cost_scope: usage.costScope,
  });
  if (error) { console.error("Post-call persistence failed", { code: error.code }); throw new IntegrationError(503, "The post-call result could not be stored. Retry the same event."); }
  const outcome = data && typeof data === "object" ? data as Record<string, unknown> : {};
  return { received: true, duplicate: outcome.duplicate === true, matched: outcome.matched === true };
}
