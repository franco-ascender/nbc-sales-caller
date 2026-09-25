import "server-only";
import { database, IntegrationError } from "./integration.service";
import { ElevenActionError, elevenRead, elevenWrite } from "./elevenlabs.service";
import { openingDisclosure } from "@/lib/caller-disclosure";
const safeId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(value);
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const BROWSER_TEST_MAX_DURATION_SECONDS = 600;
function agentId(): string { const id = process.env.ELEVENLABS_WEB_AGENT_ID || process.env.ELEVENLABS_AGENT_ID; if (!safeId(id)) throw new IntegrationError(503, "Your browser voice agent is not configured."); return id; }
export async function ensureCallerDisclosure(): Promise<{ message: string; recordVoice: boolean }> {
  const id = agentId(), agent = object(await elevenRead(`/v1/convai/agents/${id}`));
  const privacy = object(object(agent.platform_settings).privacy);
  if (typeof privacy.record_voice !== "boolean") throw new IntegrationError(503, "The agent's recording setting could not be verified. Ask an administrator to review it.");
  const expected = openingDisclosure(privacy.record_voice);
  const currentDuration = object(object(agent.conversation_config).conversation).max_duration_seconds;
  if (object(object(agent.conversation_config).agent).first_message !== expected || currentDuration !== BROWSER_TEST_MAX_DURATION_SECONDS) {
    await elevenWrite(`/v1/convai/agents/${id}`, "PATCH", { conversation_config: { agent: { first_message: expected }, conversation: { max_duration_seconds: BROWSER_TEST_MAX_DURATION_SECONDS } } });
    const verified = object(await elevenRead(`/v1/convai/agents/${id}`));
    if (object(object(verified.conversation_config).agent).first_message !== expected || object(object(verified.conversation_config).conversation).max_duration_seconds !== BROWSER_TEST_MAX_DURATION_SECONDS || object(object(verified.platform_settings).privacy).record_voice !== privacy.record_voice) throw new IntegrationError(503, "The browser test contract could not be verified. No voice test was authorized.");
  }
  return { message: expected, recordVoice: privacy.record_voice };
}
export interface VoiceCapabilities { designAllowed: boolean; cloneAllowed: boolean; plan: string; slotsRemaining?:number|null; cloneReason?:string|null; designReason?:string|null; checkedAt?:string }
export async function voiceCapabilities(): Promise<VoiceCapabilities> {
 const data=object(await elevenRead("/v1/user/subscription")),plan=typeof data.tier==='string'?data.tier:'unknown';
 const slots=typeof data.voice_limit==='number'&&typeof data.voice_slots_used==='number'?Math.max(0,data.voice_limit-data.voice_slots_used):null;
 const editLimit=typeof data.max_voice_add_edits==='number'&&typeof data.voice_add_edit_counter==='number'&&data.max_voice_add_edits>=0&&data.voice_add_edit_counter>=data.max_voice_add_edits;
 const capacity=slots!==0&&!editLimit,cloneAllowed=data.can_use_instant_voice_cloning===true&&capacity,designAllowed=plan!=='unknown'&&capacity;
 const capacityReason=slots===0?'All custom voice slots are in use. Review your voice catalog in the connected account.':editLimit?'The connected account has reached its voice creation/edit allowance.':null;
 return {designAllowed,cloneAllowed,plan,slotsRemaining:slots,cloneReason:capacityReason||(cloneAllowed?null:'Instant voice cloning is disabled in the connected ElevenLabs account. Check its subscription and API key workspace, then refresh here.'),designReason:capacityReason||(designAllowed?null:'The connected voice plan could not be identified.'),checkedAt:new Date().toISOString()};
}

export interface ManagedVoice { id: string; name: string; description: string; previewUrl: string | null; needsVerification?: boolean }
function voiceSummary(value: unknown): ManagedVoice | null {
  const voice = object(value); if (!safeId(voice.voice_id)) return null;
  let previewUrl: string | null = null;
  try { const url = new URL(String(voice.preview_url)); if (url.protocol === "https:" && ["storage.googleapis.com", "api.elevenlabs.io"].includes(url.hostname) && !url.username && !url.password) previewUrl = url.href; } catch { /* Optional preview only. */ }
  return { needsVerification: object(voice.voice_verification).requires_verification === true && object(voice.voice_verification).is_verified !== true, id: voice.voice_id, name: typeof voice.name === "string" ? voice.name.slice(0,160) : "Unnamed voice", description: typeof voice.description === "string" ? voice.description.slice(0,1000) : "", previewUrl };
}
export async function listCallerVoices(cursor?: string): Promise<{ voices: ManagedVoice[]; nextCursor: string | null; currentVoiceId: string | null }> {
  const params = new URLSearchParams({ page_size: "30", include_total_count: "false" }); if (cursor) params.set("next_page_token", cursor);
  const [catalog, config] = await Promise.all([elevenRead(`/v2/voices?${params}`), elevenRead(`/v1/convai/agents/${agentId()}`)]);
  const data = object(catalog), current = object(object(object(config).conversation_config).tts).voice_id;
  if (!Array.isArray(data.voices)) throw new IntegrationError(502, "The voice list could not be read.");
  return { voices: data.voices.map(voiceSummary).filter((voice): voice is ManagedVoice => voice !== null), nextCursor: data.has_more === true && typeof data.next_page_token === "string" ? data.next_page_token : null, currentVoiceId: safeId(current) ? current : null };
}
export async function selectCallerVoice(voiceId: string): Promise<void> {
  if (!safeId(voiceId)) throw new IntegrationError(400, "Choose an available voice.");
  const available = object(await elevenRead(`/v2/voices?${new URLSearchParams({ voice_ids: voiceId, page_size: "1" })}`));
  if (!Array.isArray(available.voices) || !available.voices.some(value => object(value).voice_id === voiceId)) throw new IntegrationError(404, "That voice is not available in this workspace.");
  const voice = object((available.voices as unknown[]).find(value => object(value).voice_id === voiceId));
  if (object(voice.voice_verification).requires_verification === true && object(voice.voice_verification).is_verified !== true) throw new IntegrationError(409, "This voice needs owner verification before it can be used.");
  const id = agentId();
  await elevenWrite(`/v1/convai/agents/${id}`, "PATCH", { conversation_config: { tts: { voice_id: voiceId } } });
  const verified = object(await elevenRead(`/v1/convai/agents/${id}`));
  if (object(object(verified.conversation_config).tts).voice_id !== voiceId) throw new IntegrationError(409, "The agent voice changed during this request. Refresh the voice list.");
}
export async function createCallerVoice(operatorId: string, requestId: string, name: string, description: string): Promise<{ voiceId: string; replayed: boolean }> {
  const db = database();
  const previous=await db.from('caller_voice_jobs').select('name,description,kind,status,voice_id').eq('id',requestId).eq('operator_id',operatorId).maybeSingle();
  if(previous.error)throw new IntegrationError(503,'Voice creation storage is unavailable. No generation was requested.');
  if(previous.data){const job=previous.data;if(job.kind==='clone'||job.name!==name||job.description!==description)throw new IntegrationError(409,'This creation reference cannot be reused for different settings.');if(job.status==='completed'&&safeId(job.voice_id))return{voiceId:job.voice_id,replayed:true};throw new IntegrationError(409,'This voice request is processing or needs administrator review. No second generation was started.');}
  const capability=await voiceCapabilities(); if (!capability.designAllowed) throw new IntegrationError(403, capability.designReason || "Voice design is unavailable in the connected account. No generation was requested.");
  // Reserve before any paid request. Ambiguous failures never issue a second generation.
  const reservation = await db.from("caller_voice_jobs").insert({ id: requestId, operator_id: operatorId, name, description, status: "preparing" });
  if (reservation.error) {
    if (reservation.error.code !== "23505") throw new IntegrationError(503, "Voice creation storage is not ready. No generation was requested.");
    const { data, error } = await db.from("caller_voice_jobs").select("name,description,status,voice_id").eq("id", requestId).eq("operator_id", operatorId).maybeSingle();
    if (error || !data || data.name !== name || data.description !== description) throw new IntegrationError(409, "This creation reference cannot be reused for different settings.");
    if (data.status === "completed" && safeId(data.voice_id)) return { voiceId: data.voice_id, replayed: true };
    throw new IntegrationError(409, "This voice request is processing or needs administrator review. No second generation was started.");
  }
  try {
    const design = object(await elevenWrite("/v1/text-to-voice/design", "POST", { voice_description: description, model_id: "eleven_multilingual_ttv_v2", auto_generate_text: true }));
    const generated = Array.isArray(design.previews) ? object(design.previews[0]).generated_voice_id : null;
    if (!safeId(generated)) throw new Error("invalid design");
    const saved = object(await elevenWrite("/v1/text-to-voice", "POST", { voice_name: name, voice_description: description, generated_voice_id: generated }));
    if (!safeId(saved.voice_id)) throw new Error("invalid voice");
    const result = await db.from("caller_voice_jobs").update({ status: "completed", voice_id: saved.voice_id }).eq("id", requestId).eq("operator_id", operatorId).eq("status", "preparing").select("id").maybeSingle();
    if (result.error || !result.data) throw new Error("unconfirmed save");
    return { voiceId: saved.voice_id, replayed: false };
  } catch (error) {
    await db.from("caller_voice_jobs").update({ status: error instanceof ElevenActionError && error.definite ? "failed" : "uncertain", failure_code: error instanceof ElevenActionError ? error.code : "unconfirmed" }).eq("id", requestId).eq("operator_id", operatorId).eq("status", "preparing");
    if (error instanceof ElevenActionError && error.definite) throw error;
    throw new IntegrationError(502, "Creation was not fully confirmed. Refresh the voice list and review this request before creating another voice. Retrying this reference will not generate again.");
  }
}
