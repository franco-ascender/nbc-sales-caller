import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { isRecord } from "@/lib/integration-validation";
import type { IntegrationStatus } from "@/components/dashboard/Dashboard.types";

export class IntegrationError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function integrationStatus(): IntegrationStatus {
  return {
    ghl: Boolean(process.env.GHL_PRIVATE_INTEGRATION_TOKEN && process.env.GHL_LOCATION_ID && process.env.GHL_API_BASE_URL && process.env.GHL_API_VERSION),
    auth: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.NBC_OPERATOR_EMAIL),
    storage: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
    webhook: Boolean(process.env.GHL_WEBHOOK_SECRET && process.env.GHL_LOCATION_ID),
  };
}

export function database(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new IntegrationError(503, "Event storage has not been configured yet.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireOperator(request: Request): Promise<string> {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new IntegrationError(401, "Sign in to your test workspace to continue.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const allowed = process.env.NBC_OPERATOR_EMAIL?.trim().toLowerCase();
  if (!url || !key || !allowed) throw new IntegrationError(503, "Operator access has not been configured yet.");
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user?.email_confirmed_at || data.user.email?.toLowerCase() !== allowed) throw new IntegrationError(403, "This account does not have access to the test workspace.");
  return data.user.id;
}

export function requireWebhookSecret(request: Request): void {
  const expected = process.env.GHL_WEBHOOK_SECRET;
  if (!expected) throw new IntegrationError(503, "Webhook access has not been configured yet.");
  const actual = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
  const hash = (value: string): Buffer => createHash("sha256").update(value).digest();
  if (!actual || !timingSafeEqual(hash(actual), hash(expected))) throw new IntegrationError(401, "Webhook authentication failed.");
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new IntegrationError(415, "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new IntegrationError(400, "A JSON body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new IntegrationError(413, "Request body is too large."); }
      chunks.push(result.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError(400, "The JSON body could not be read.");
  } finally { reader.releaseLock(); }
}

export async function checkContact(contactId: string): Promise<{ id: string; name: string; checkedAt: string }> {
  const status = integrationStatus();
  if (!status.ghl) throw new IntegrationError(503, "GoHighLevel has not been configured yet.");
  const base = new URL(process.env.GHL_API_BASE_URL!);
  if (base.protocol !== "https:" || base.hostname !== "services.leadconnectorhq.com") throw new IntegrationError(503, "The GoHighLevel API address is not valid.");
  let response: Response;
  try {
    response = await fetch(new URL(`/contacts/${encodeURIComponent(contactId)}`, base), { headers: { Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`, Version: process.env.GHL_API_VERSION!, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000), redirect: "error" });
  } catch { throw new IntegrationError(502, "GoHighLevel could not be reached. Please try again."); }
  if (!response.ok) {
    console.error("GHL contact check failed", { status: response.status });
    throw new IntegrationError(response.status === 404 ? 404 : 502, response.status === 404 ? "That contact was not found in GoHighLevel." : "GoHighLevel rejected the request. Check the integration permissions and API version.");
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.contact) || payload.contact.locationId !== process.env.GHL_LOCATION_ID || payload.contact.id !== contactId) throw new IntegrationError(403, "The contact could not be verified in the configured test workspace.");
  const contact = payload.contact;
  const name = typeof contact.name === "string" ? contact.name : [contact.firstName, contact.lastName].filter(value => typeof value === "string").join(" ");
  return { id: contactId, name: name || "Test contact", checkedAt: new Date().toISOString() };
}

export function apiError(error: unknown): Response {
  if (error instanceof IntegrationError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  console.error("Integration request failed", { type: error instanceof Error ? error.name : "unknown" });
  return Response.json({ error: "The integration request could not be completed. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
