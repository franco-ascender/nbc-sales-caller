import { createHmac, timingSafeEqual } from "node:crypto";

function equal(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function validPhoneNumber(value: unknown): value is string {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}

export function validTwilioWebhook(signature: string | null, expectedUrl: string, fields: Readonly<Record<string, string>>, authToken: string): boolean {
  if (!signature || !authToken) return false;
  let url: URL;
  try { url = new URL(expectedUrl); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const body = Object.entries(fields).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}${value}`).join("");
  const expected = createHmac("sha1", authToken).update(`${url.href}${body}`).digest("base64");
  return equal(Buffer.from(signature), Buffer.from(expected));
}

export function validElevenLabsWebhook(signature: string | null, body: string, secret: string, now = Date.now()): boolean {
  if (!signature || !secret || !body) return false;
  const parts = signature.split(",").map(part => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key, value]) => key === "v0" && /^[a-f0-9]{64}$/i.test(value ?? "")).map(([, value]) => value!);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(now - seconds * 1000) > 300_000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  return signatures.some(value => equal(Buffer.from(value, "hex"), expected));
}

export interface ElevenLabsPostCallEvent {
  type: "post_call_transcription";
  eventTimestamp: number;
  data: Record<string, unknown>;
  agentId: string;
  conversationId: string;
}

export function parseElevenLabsPostCallEvent(value: unknown, allowedAgents: ReadonlySet<string>): ElevenLabsPostCallEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid post-call event");
  const event = value as Record<string, unknown>;
  // Keep conversion to a Postgres/JavaScript timestamp safe even for a signed but malformed provider event.
  if (event.type !== "post_call_transcription" || typeof event.event_timestamp !== "number" || !Number.isSafeInteger(event.event_timestamp) || event.event_timestamp <= 0 || event.event_timestamp > 253_402_300_799) throw new Error("Invalid post-call event");
  if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) throw new Error("Invalid post-call data");
  const data = event.data as Record<string, unknown>, agentId = data.agent_id, conversationId = data.conversation_id;
  if (typeof agentId !== "string" || !allowedAgents.has(agentId) || typeof conversationId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(conversationId)) throw new Error("Unknown post-call conversation");
  return { type: event.type, eventTimestamp: event.event_timestamp, data, agentId, conversationId };
}

export function validTwilioStatus(value: unknown): value is "queued" | "ringing" | "in-progress" | "completed" | "busy" | "failed" | "no-answer" | "canceled" {
  return typeof value === "string" && ["queued", "ringing", "in-progress", "completed", "busy", "failed", "no-answer", "canceled"].includes(value);
}
