import "server-only";
import { database, IntegrationError } from "./integration.service";
import { contentHash, knowledgeAttachmentPlan } from "@/lib/caller-knowledge";
import type { ConversationScenario, KnowledgeAudioInput, KnowledgeTextInput } from "@/lib/caller-knowledge";
import { audioFileType } from "@/lib/caller-audio";
import { ElevenActionError, elevenRead, elevenWrite } from "./elevenlabs.service";

const BUCKET = "caller-knowledge";
const sourceFields = "id,title,kind,status,context,file_name,mime_type,size_bytes,transcript,retain_audio,created_at,updated_at,approved_at,failure_code";

export interface KnowledgeSourceSummary {
  id: string; title: string; kind: "call_audio" | "transcript" | "playbook"; status: string; context: string;
  fileName: string | null; mimeType: string | null; sizeBytes: number | null; hasTranscript: boolean; retainAudio: boolean;
  createdAt: string; updatedAt: string; approvedAt: string | null; failureCode: string | null;
}

function summary(row: Record<string, unknown>): KnowledgeSourceSummary {
  return { id: String(row.id), title: String(row.title), kind: row.kind as KnowledgeSourceSummary["kind"], status: String(row.status), context: String(row.context ?? ""), fileName: typeof row.file_name === "string" ? row.file_name : null, mimeType: typeof row.mime_type === "string" ? row.mime_type : null, sizeBytes: typeof row.size_bytes === "number" ? row.size_bytes : null, hasTranscript: typeof row.transcript === "string" && row.transcript.length > 0, retainAudio: row.retain_audio === true, createdAt: String(row.created_at), updatedAt: String(row.updated_at), approvedAt: typeof row.approved_at === "string" ? row.approved_at : null, failureCode: typeof row.failure_code === "string" ? row.failure_code : null };
}

function missing(error: { code?: string } | null): boolean { return Boolean(error && ["42P01", "PGRST205"].includes(error.code ?? "")); }

export async function listKnowledgeSources(): Promise<{ configured: boolean; sources: KnowledgeSourceSummary[] }> {
  const result = await database().from("caller_knowledge_sources").select(sourceFields).order("created_at", { ascending: false }).limit(100);
  if (missing(result.error)) return { configured: false, sources: [] };
  if (result.error) throw new IntegrationError(503, "Knowledge Library could not be loaded.");
  return { configured: true, sources: (result.data as Record<string, unknown>[]).map(summary) };
}

export async function createTextKnowledge(owner: string, input: KnowledgeTextInput): Promise<KnowledgeSourceSummary> {
  const db = database(), hash = contentHash(JSON.stringify({ title: input.title, kind: input.kind, content: input.content, context: input.context }));
  const existing = await db.from("caller_knowledge_sources").select(`${sourceFields},content_hash`).eq("created_by", owner).eq("request_id", input.requestId).maybeSingle();
  if (existing.error && !missing(existing.error)) throw new IntegrationError(503, "Knowledge storage is unavailable.");
  if (existing.data) {
    if (existing.data.content_hash !== hash) throw new IntegrationError(409, "This knowledge request was already used with different content.");
    return summary(existing.data as Record<string, unknown>);
  }
  const inserted = await db.from("caller_knowledge_sources").insert({ id: input.requestId, request_id: input.requestId, created_by: owner, title: input.title, kind: input.kind, status: "review", context: input.context, authorization_confirmed: true, transcript: input.content, content_hash: hash }).select(sourceFields).single();
  if (inserted.error || !inserted.data) throw new IntegrationError(inserted.error?.code === "23505" ? 409 : 503, inserted.error?.code === "23505" ? "This knowledge request already exists. Refresh the library." : "The knowledge source could not be saved.");
  return summary(inserted.data as Record<string, unknown>);
}

function extension(fileName: string): string { return fileName.toLowerCase().match(/\.(mp3|m4a|mp4|wav|webm|ogg)$/)?.[1] ?? "audio"; }

export async function reserveAudioKnowledge(owner: string, input: KnowledgeAudioInput): Promise<{ source: KnowledgeSourceSummary; signedUrl: string }> {
  const db = database(), hash = contentHash(JSON.stringify({ title: input.title, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, context: input.context }));
  const existing = await db.from("caller_knowledge_sources").select(`${sourceFields},content_hash,storage_path`).eq("created_by", owner).eq("request_id", input.requestId).maybeSingle();
  if (existing.error && !missing(existing.error)) throw new IntegrationError(503, "Knowledge storage is unavailable.");
  let source = existing.data;
  if (source && source.content_hash !== hash) throw new IntegrationError(409, "This audio request was already used with a different file.");
  if (source && source.status !== "uploading") throw new IntegrationError(409, "This audio source was already uploaded. Refresh the library before adding another file.");
  const path = source?.storage_path || `${owner}/${input.requestId}/source.${extension(input.fileName)}`;
  if (!source) {
    const inserted = await db.from("caller_knowledge_sources").insert({ id: input.requestId, request_id: input.requestId, created_by: owner, title: input.title, kind: "call_audio", status: "uploading", context: input.context, authorization_confirmed: true, storage_path: path, file_name: input.fileName, mime_type: input.mimeType, size_bytes: input.sizeBytes, content_hash: hash }).select(`${sourceFields},content_hash,storage_path`).single();
    if (inserted.error || !inserted.data) throw new IntegrationError(inserted.error?.code === "23505" ? 409 : 503, inserted.error?.code === "23505" ? "This audio request already exists. Refresh the library." : "The audio upload could not be reserved.");
    source = inserted.data;
  }
  const bucket = await db.storage.getBucket(BUCKET);
  if (bucket.error || !bucket.data || bucket.data.public) throw new IntegrationError(503, "Private knowledge storage has not been configured.");
  const signed = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data) throw new IntegrationError(503, "A private upload link could not be created. Retry this same source.");
  return { source: summary(source as Record<string, unknown>), signedUrl: signed.data.signedUrl };
}

export async function finalizeAudioKnowledge(owner: string, id: string): Promise<KnowledgeSourceSummary> {
  const db = database();
  const found = await db.from("caller_knowledge_sources").select(`${sourceFields},storage_path`).eq("id", id).eq("created_by", owner).eq("kind", "call_audio").maybeSingle();
  if (found.error) throw new IntegrationError(503, "The audio source could not be checked.");
  if (!found.data) throw new IntegrationError(404, "That audio source was not found.");
  if (found.data.status !== "uploading") return summary(found.data as Record<string, unknown>);
  const path = String(found.data.storage_path), slash = path.lastIndexOf("/"), folder = path.slice(0, slash), file = path.slice(slash + 1);
  const listed = await db.storage.from(BUCKET).list(folder, { search: file, limit: 2 });
  if (listed.error) throw new IntegrationError(503, "The private audio upload could not be verified.");
  const object = listed.data.find(item => item.name === file);
  const uploadedSize = Number(object?.metadata?.size ?? object?.metadata?.contentLength ?? 0);
  if (!object || !Number.isFinite(uploadedSize) || uploadedSize !== Number(found.data.size_bytes)) throw new IntegrationError(409, "The uploaded audio is incomplete. Retry the same upload before finalizing it.");
  const signed = await db.storage.from(BUCKET).createSignedUrl(path, 60);
  if (signed.error || !signed.data?.signedUrl) throw new IntegrationError(503, "The uploaded audio could not be inspected safely.");
  let signature: ReturnType<typeof audioFileType> = null;
  try {
    const response = await fetch(signed.data.signedUrl, { headers: { Range: "bytes=0-15" }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (response.status !== 206 || !/^bytes 0-15\//i.test(response.headers.get("content-range") ?? "")) throw new Error("range unavailable");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== 16) throw new Error("invalid range");
    signature = audioFileType(bytes);
  } catch { throw new IntegrationError(503, "The uploaded audio could not be inspected safely."); }
  const mime = String(found.data.mime_type);
  const matching = (signature === "mp3" && mime === "audio/mpeg") || (signature === "mp4" && mime === "audio/mp4") || (signature === "wav" && ["audio/wav", "audio/x-wav"].includes(mime)) || (signature === "webm" && ["audio/webm", "video/webm"].includes(mime)) || (signature === "ogg" && mime === "audio/ogg");
  if (!matching) {
    await db.storage.from(BUCKET).remove([path]);
    await db.from("caller_knowledge_sources").update({ status: "failed", failure_code: "unsupported_audio" }).eq("id", id).eq("created_by", owner).eq("status", "uploading");
    throw new IntegrationError(400, "The uploaded file does not contain the supported audio format it declares.");
  }
  const updated = await db.from("caller_knowledge_sources").update({ status: "uploaded", failure_code: null }).eq("id", id).eq("created_by", owner).eq("status", "uploading").select(sourceFields).maybeSingle();
  if (updated.error || !updated.data) throw new IntegrationError(409, "The audio source changed while it was being verified. Refresh the library.");
  return summary(updated.data as Record<string, unknown>);
}

export interface SavedScenario { id: string; title: string; conversationType: ConversationScenario["conversationType"]; brief: ConversationScenario; createdAt: string }
export async function listScenarios(owner: string): Promise<{ configured: boolean; scenarios: SavedScenario[] }> {
  const result = await database().from("caller_conversation_scenarios").select("id,title,conversation_type,brief,created_at").eq("created_by", owner).is("archived_at", null).order("created_at", { ascending: false }).limit(50);
  if (missing(result.error)) return { configured: false, scenarios: [] };
  if (result.error) throw new IntegrationError(503, "Conversation scenarios could not be loaded.");
  return { configured: true, scenarios: result.data.map(row => ({ id: row.id, title: row.title, conversationType: row.conversation_type, brief: row.brief, createdAt: row.created_at })) as SavedScenario[] };
}

export async function saveScenario(owner: string, requestId: string, scenario: ConversationScenario): Promise<SavedScenario> {
  const db = database(), existing = await db.from("caller_conversation_scenarios").select("id,title,conversation_type,brief,created_at").eq("created_by", owner).eq("request_id", requestId).maybeSingle();
  if (existing.error && !missing(existing.error)) throw new IntegrationError(503, "Conversation scenarios could not be saved.");
  if (existing.data) {
    if (contentHash(JSON.stringify(existing.data.brief)) !== contentHash(JSON.stringify(scenario))) throw new IntegrationError(409, "This scenario request was already used with different content.");
    return { id: existing.data.id, title: existing.data.title, conversationType: existing.data.conversation_type, brief: existing.data.brief, createdAt: existing.data.created_at } as SavedScenario;
  }
  const inserted = await db.from("caller_conversation_scenarios").insert({ id: requestId, request_id: requestId, created_by: owner, title: scenario.title, conversation_type: scenario.conversationType, brief: scenario }).select("id,title,conversation_type,brief,created_at").single();
  if (inserted.error || !inserted.data) throw new IntegrationError(inserted.error?.code === "23505" ? 409 : 503, inserted.error?.code === "23505" ? "This scenario request already exists. Refresh the list." : "The scenario could not be saved.");
  return { id: inserted.data.id, title: inserted.data.title, conversationType: inserted.data.conversation_type, brief: inserted.data.brief, createdAt: inserted.data.created_at } as SavedScenario;
}

const valueObject = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const safeProviderId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(value);
function browserAgentId(): string {
  const value = process.env.ELEVENLABS_WEB_AGENT_ID || process.env.ELEVENLABS_AGENT_ID;
  if (!safeProviderId(value)) throw new IntegrationError(503, "The private browser agent is not configured.");
  return value;
}

interface KnowledgeLocator { type: "text" | "file" | "url" | "folder"; name: string; id: string; usage_mode?: "auto" | "prompt" }
function knowledgeLocators(agent: unknown): KnowledgeLocator[] {
  const list = valueObject(valueObject(valueObject(agent).conversation_config).agent).prompt;
  const knowledge = valueObject(list).knowledge_base;
  if (!Array.isArray(knowledge)) return [];
  return knowledge.flatMap(item => {
    const row = valueObject(item);
    if (!safeProviderId(row.id) || typeof row.name !== "string" || !["text", "file", "url", "folder"].includes(String(row.type))) return [];
    return [{ id: row.id, name: row.name.slice(0, 140), type: row.type as KnowledgeLocator["type"], usage_mode: row.usage_mode === "prompt" ? "prompt" : "auto" }];
  });
}

export async function syncKnowledgeSource(approver: string, id: string): Promise<KnowledgeSourceSummary> {
  const db = database();
  let found = await db.from("caller_knowledge_sources").select(`${sourceFields},provider_document_id`).eq("id", id).maybeSingle();
  if (found.error) throw new IntegrationError(503, "The knowledge source could not be checked.");
  if (!found.data) throw new IntegrationError(404, "That knowledge source was not found.");
  let source = found.data;
  if (source.kind === "call_audio" || typeof source.transcript !== "string" || source.transcript.trim().length < 100) throw new IntegrationError(409, "A reviewed transcript or playbook is required before syncing this source.");
  if (source.status === "synced") return summary(source as Record<string, unknown>);
  if (source.status === "syncing") throw new IntegrationError(409, "This source is already syncing. Refresh the library before trying another action.");

  const agentId = browserAgentId();
  let providerId = safeProviderId(source.provider_document_id) ? source.provider_document_id : null;
  if (source.status === "sync_unknown") {
    if (!providerId) throw new IntegrationError(409, "The provider may have created this document without returning its ID. Review the provider knowledge base before retrying so a duplicate is not created.");
    const current = await elevenRead(`/v1/convai/agents/${agentId}`);
    if (knowledgeLocators(current).some(item => item.id === providerId)) {
      const reconciled = await db.from("caller_knowledge_sources").update({ status: "synced", failure_code: null }).eq("id", id).eq("status", "sync_unknown").select(sourceFields).maybeSingle();
      if (reconciled.error || !reconciled.data) throw new IntegrationError(409, "The source changed while its provider state was reconciled. Refresh the library.");
      return summary(reconciled.data as Record<string, unknown>);
    }
  }
  if (!["review", "approved", "failed", "sync_unknown"].includes(source.status)) throw new IntegrationError(409, "This source is not ready for approval and sync.");

  const reserved = await db.from("caller_knowledge_sources").update({ status: "syncing", approved_by: approver, approved_at: source.approved_at || new Date().toISOString(), failure_code: null }).eq("id", id).eq("status", source.status).select(`${sourceFields},provider_document_id`).maybeSingle();
  if (reserved.error || !reserved.data) throw new IntegrationError(409, "The source changed before sync started. Refresh the library.");
  source = reserved.data;

  if (!providerId) {
    try {
      const created = valueObject(await elevenWrite("/v1/convai/knowledge-base/text", "POST", { name: source.title, text: source.transcript }));
      if (!safeProviderId(created.id)) throw new IntegrationError(502, "The provider returned an incomplete knowledge document confirmation.");
      providerId = created.id;
      const recorded = await db.from("caller_knowledge_sources").update({ provider_document_id: providerId }).eq("id", id).eq("status", "syncing").is("provider_document_id", null).select("id").maybeSingle();
      if (recorded.error || !recorded.data) throw new IntegrationError(502, "The provider document was created but its local reference could not be confirmed. Review the provider knowledge base before retrying.");
    } catch (error) {
      const definite = error instanceof ElevenActionError && error.definite;
      await db.from("caller_knowledge_sources").update({ status: definite ? "approved" : "sync_unknown", failure_code: definite ? error.code : "document_create_unknown" }).eq("id", id).eq("status", "syncing");
      if (definite) throw error;
      throw new IntegrationError(502, "Knowledge creation was not fully confirmed. Refresh and review the provider knowledge base before retrying; the app will not create a second document automatically.");
    }
  }

  try {
    const current = await elevenRead(`/v1/convai/agents/${agentId}`);
    const existing = knowledgeLocators(current);
    const currentRag = valueObject(valueObject(valueObject(valueObject(current).conversation_config).agent).prompt).rag;
    const plan = knowledgeAttachmentPlan(source.kind === "playbook" ? "playbook" : "transcript", valueObject(currentRag).enabled === true);
    const locator = { type: "text" as const, name: String(source.title).slice(0, 140), id: providerId, usage_mode: plan.usageMode };
    const next = existing.some(item => item.id === providerId) ? existing.map(item => item.id === providerId ? locator : item) : [...existing, locator];
    await elevenWrite(`/v1/convai/agents/${agentId}`, "PATCH", { conversation_config: { agent: { prompt: { knowledge_base: next, rag: { ...valueObject(currentRag), enabled: plan.ragEnabled } } } } });
    const verified = await elevenRead(`/v1/convai/agents/${agentId}`);
    const verifiedPrompt = valueObject(valueObject(valueObject(valueObject(verified).conversation_config).agent).prompt);
    if (!knowledgeLocators(verified).some(item => item.id === providerId && item.usage_mode === plan.usageMode) || valueObject(verifiedPrompt.rag).enabled !== plan.ragEnabled) throw new IntegrationError(502, "The provider did not confirm the knowledge attachment.");
    const synced = await db.from("caller_knowledge_sources").update({ status: "synced", failure_code: null }).eq("id", id).eq("status", "syncing").eq("provider_document_id", providerId).select(sourceFields).maybeSingle();
    if (synced.error || !synced.data) throw new IntegrationError(409, "Knowledge was attached, but the local source changed. Refresh the library to reconcile it.");
    return summary(synced.data as Record<string, unknown>);
  } catch (error) {
    const current = await elevenRead(`/v1/convai/agents/${agentId}`).catch(() => null);
    const attached = current ? knowledgeLocators(current).some(item => item.id === providerId) : false;
    await db.from("caller_knowledge_sources").update({ status: attached ? "synced" : "sync_unknown", failure_code: attached ? null : "agent_attach_unknown" }).eq("id", id).eq("status", "syncing");
    if (attached) {
      const reconciled = await db.from("caller_knowledge_sources").select(sourceFields).eq("id", id).single();
      if (!reconciled.error && reconciled.data) return summary(reconciled.data as Record<string, unknown>);
    }
    throw error instanceof IntegrationError ? error : new IntegrationError(502, "The provider did not fully confirm the knowledge attachment. Refresh the library before retrying.");
  }
}
