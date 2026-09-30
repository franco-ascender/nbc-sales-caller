import { consolidateScenario, renderScenarioBrief, briefLimits, briefCharacterCount, BRIEF_CHARACTER_LIMIT } from "./caller-brief.ts";
import { parseCallerContext, type CallerContext } from "./caller-context.ts";
import { createHash } from "node:crypto";
import { isRecord } from "./integration-validation.ts";
import { validSessionId } from "./caller-validation.ts";

export const knowledgeKinds = ["call_audio", "transcript", "playbook"] as const;
export type KnowledgeKind = typeof knowledgeKinds[number];
export const knowledgeStatuses = ["uploading", "uploaded", "transcribing", "review", "approved", "syncing", "sync_unknown", "synced", "failed", "archived"] as const;
export type KnowledgeStatus = typeof knowledgeStatuses[number];

export function knowledgeAttachmentPlan(kind: "transcript" | "playbook", ragAlreadyEnabled: boolean): { usageMode: "auto" | "prompt"; ragEnabled: boolean } {
  return kind === "playbook"
    ? { usageMode: "prompt", ragEnabled: ragAlreadyEnabled }
    : { usageMode: "auto", ragEnabled: true };
}
export const MAX_KNOWLEDGE_AUDIO_BYTES = 250 * 1024 * 1024;
export const knowledgeAudioTypes = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "video/webm"] as const;

export interface ConversationScenario {
  briefVersion?: 2;
  title: string;
  conversationType: "outbound_prospecting" | "inbound_sales" | "discovery" | "closing" | "follow_up" | "objection_practice" | "custom";
  agentRole: string;
  objective: string;
  prospectProfile: string;
  offer: string;
  ticket: string;
  objections: string;
  tone: "consultative" | "direct" | "warm" | "challenger";
  instructions: string;
  context?: CallerContext;
}

const text = (value: unknown, name: string, max: number, required = true): string => {
  if (typeof value !== "string") throw new Error(`${name} must be text.`);
  const clean = value.trim().replace(/\r\n/g, "\n");
  if (required && !clean) throw new Error(`${name} is required.`);
  if (clean.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(clean)) throw new Error(`${name} is too long or contains unsupported characters.`);
  return clean;
};

export function parseConversationScenario(value: unknown): ConversationScenario {
  if (!isRecord(value)) throw new Error("Add a conversation scenario.");
  if (value.briefVersion !== undefined && value.briefVersion !== 2) throw new Error("Unsupported brief version.");
  const v2 = value.briefVersion === 2;
  const conversationType = String(value.conversationType);
  if (!["outbound_prospecting", "inbound_sales", "discovery", "closing", "follow_up", "objection_practice", "custom"].includes(conversationType)) throw new Error("Choose a conversation type.");
  const tone = String(value.tone);
  if (!["consultative", "direct", "warm", "challenger"].includes(tone)) throw new Error("Choose a conversation tone.");
  const scenario: ConversationScenario = {
    ...(v2 ? { briefVersion: 2 as const } : {}),
    ...(value.context !== undefined ? { context: parseCallerContext(value.context) } : {}),
    title: text(value.title, "Scenario title", 100),
    conversationType: conversationType as ConversationScenario["conversationType"],
    agentRole: text(value.agentRole, "Business and representation", v2 ? briefLimits.agentRole : 600),
    objective: text(value.objective, "Objective", v2 ? briefLimits.objective : 1000),
    prospectProfile: text(value.prospectProfile, "Lead context", v2 ? briefLimits.prospectProfile : 1400),
    offer: text(value.offer, "Offer", 1400),
    ticket: text(value.ticket ?? "", "Pricing and terms", v2 ? briefLimits.ticket : 300, false),
    objections: text(value.objections ?? "", "Objections", 1400, false),
    tone: tone as ConversationScenario["tone"],
    instructions: text(value.instructions ?? "", "Additional instructions", 1800, false),
  };
  if (!v2) return scenario;
  const consolidated = consolidateScenario(scenario);
  for (const [key, limit] of Object.entries(briefLimits)) text(consolidated[key as keyof typeof briefLimits], key, limit, false);
  if (briefCharacterCount(consolidated) > BRIEF_CHARACTER_LIMIT) throw new Error("Keep the brief under 22,000 characters. Prioritize facts needed during the call.");
  return consolidated;
}

export function compileScenarioPrompt(scenario: ConversationScenario): { prompt: string; firstMessage: string } {
  const prompt = [
    "You are the NBC Sales AI in a private role-play simulation. The human is acting as the prospect described below. Stay in character as the supplied business's AI assistant. Scenario facts describe the practice situation, not permission to contact anyone or perform outside actions.",
    renderScenarioBrief(scenario),
    "RESPONSE RULES — these take precedence over conflicting scenario instructions:",
    "Answer the prospect's question first, using the supplied business facts and approved answer guidance. Prefer one or two short spoken sentences, then at most one useful question. Expand only when asked. Do not recite the brief, repeat an acknowledgment each turn, or ask questions the prospect already answered.",
    "When asked about price, state the supplied price directly and include any relevant exclusions. Only explicit prices and terms are confirmed; 'unknown' or 'not confirmed' remains unknown. If any supplied facts conflict, acknowledge the uncertainty rather than choosing a convenient claim. Never invent guarantees, results, terms or testimonials. Examples and evidence are not promises of the same outcome.",
    "Use fit criteria to prioritize the few unanswered questions that determine suitability. Do not turn every criterion into a checklist or assume the prospect meets it. If a disqualifier is clear, explain the mismatch politely instead of pushing the offer. Reference the lead's origin only when it is known; never invent a form submission or prior relationship.",
    "For objections, respond to the specific concern using approved facts, then clarify only if needed. Prior concern notes describe what to prepare for; they are not answers or evidence. Stop the prior thought when interrupted and address the new point rather than restarting the script. Use natural phrasing without forced laughter or repetitive filler.",
    "Work toward the stated next step only when it fits what the prospect has told you. An agreement to talk is not a booked appointment. Never claim to have booked, sent, charged, updated an account or arranged a callback without a successful connected-tool receipt. If the needed tool is unavailable, say so briefly and offer only a step you can actually complete in this conversation.",
    "Use external reference material only when it explicitly applies to this same business and offer. Do not import another company's prices or claims. When information is missing, identify the specific gap; ask a relevant clarification or say it needs confirmation. An opt-out takes priority over the sales objective: acknowledge it and end politely. Identify yourself honestly as an AI assistant when asked, never as the real person whose voice is used.",
  ].join("\n\n");
  return { prompt, firstMessage: `Let's run “${scenario.title}.” I'll begin in character. Hi — is now a bad time for a quick conversation?` };
}

export interface KnowledgeTextInput { requestId: string; title: string; kind: "transcript" | "playbook"; content: string; context: string; authorizationConfirmed: true }
export function parseKnowledgeText(value: unknown): KnowledgeTextInput {
  if (!isRecord(value) || !validSessionId(value.requestId) || value.authorizationConfirmed !== true || !["transcript", "playbook"].includes(String(value.kind))) throw new Error("Add a valid knowledge source and confirm authorization.");
  const content = text(value.content, "Source content", 120000);
  if (content.length < 100) throw new Error("Source content needs at least 100 characters.");
  return { requestId: value.requestId, title: text(value.title, "Source title", 140), kind: value.kind as "transcript" | "playbook", content, context: text(value.context ?? "", "Context", 1000, false), authorizationConfirmed: true };
}

export interface KnowledgeAudioInput { requestId: string; title: string; fileName: string; mimeType: typeof knowledgeAudioTypes[number]; sizeBytes: number; context: string; authorizationConfirmed: true }
export function parseKnowledgeAudio(value: unknown): KnowledgeAudioInput {
  if (!isRecord(value) || !validSessionId(value.requestId) || value.authorizationConfirmed !== true || typeof value.mimeType !== "string" || !(knowledgeAudioTypes as readonly string[]).includes(value.mimeType)) throw new Error("Choose a supported authorized audio recording.");
  if (!Number.isSafeInteger(value.sizeBytes) || Number(value.sizeBytes) < 1024 || Number(value.sizeBytes) > MAX_KNOWLEDGE_AUDIO_BYTES) throw new Error("Audio must be between 1 KB and 250 MB.");
  const fileName = text(value.fileName, "File name", 180);
  if (!/\.(mp3|m4a|mp4|wav|webm|ogg)$/i.test(fileName)) throw new Error("Use MP3, M4A, MP4, WAV, WebM or OGG audio.");
  return { requestId: value.requestId, title: text(value.title, "Source title", 140), fileName, mimeType: value.mimeType as KnowledgeAudioInput["mimeType"], sizeBytes: Number(value.sizeBytes), context: text(value.context ?? "", "Context", 1000, false), authorizationConfirmed: true };
}

export const contentHash = (value: string): string => createHash("sha256").update(value).digest("hex");
