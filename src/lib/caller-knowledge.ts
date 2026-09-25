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
  const conversationType = String(value.conversationType);
  if (!["outbound_prospecting", "inbound_sales", "discovery", "closing", "follow_up", "objection_practice", "custom"].includes(conversationType)) throw new Error("Choose a conversation type.");
  const tone = String(value.tone);
  if (!["consultative", "direct", "warm", "challenger"].includes(tone)) throw new Error("Choose a conversation tone.");
  return {
    title: text(value.title, "Scenario title", 100),
    conversationType: conversationType as ConversationScenario["conversationType"],
    agentRole: text(value.agentRole, "Agent role", 600),
    objective: text(value.objective, "Objective", 1000),
    prospectProfile: text(value.prospectProfile, "Prospect profile", 1400),
    offer: text(value.offer, "Offer", 1400),
    ticket: text(value.ticket ?? "", "Ticket", 300, false),
    objections: text(value.objections ?? "", "Objections", 1400, false),
    tone: tone as ConversationScenario["tone"],
    instructions: text(value.instructions ?? "", "Additional instructions", 1800, false),
  };
}

export function compileScenarioPrompt(scenario: ConversationScenario): { prompt: string; firstMessage: string } {
  const type = scenario.conversationType.replaceAll("_", " ");
  const prompt = [
    "You are the NBC Sales AI in a private role-play simulation. The human is acting as the prospect described below.",
    "Treat the scenario as fictional practice. Do not claim to place orders, charge money, access accounts, or perform actions outside this conversation.",
    `Conversation type: ${type}.`,
    `Your role: ${scenario.agentRole}`,
    `Primary objective: ${scenario.objective}`,
    `Prospect profile and situation: ${scenario.prospectProfile}`,
    `Offer and solution: ${scenario.offer}`,
    scenario.ticket ? `Ticket or commercial range: ${scenario.ticket}` : "",
    scenario.objections ? `Likely objections or tensions to uncover naturally: ${scenario.objections}` : "",
    `Tone: ${scenario.tone}. Ask concise questions, listen to the answer, and adapt instead of reciting a script.`,
    "Use approved NBC knowledge when relevant. If a fact is absent, ask a clarifying question instead of inventing it.",
    scenario.instructions ? `Additional simulation instructions: ${scenario.instructions}` : "",
  ].filter(Boolean).join("\n\n");
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
