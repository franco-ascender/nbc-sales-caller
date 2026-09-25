import "server-only";
import { database, IntegrationError } from "./integration.service";
import type { CallerLead, LeadInput, LeadStage } from "@/lib/caller-crm";
const fields = "bucket_id,do_not_call,latest_activity_at,latest_activity_preview,is_demo,id,name,phone,email,company,source,stage,notes,created_at,updated_at";
export async function readCallerLeads(owner: string, demo = false): Promise<{ leads: CallerLead[]; configured: boolean; hasMore: boolean }> {
  const { data, error, count } = await database().from("caller_leads").select(fields, { count: "exact" }).eq("operator_id", owner).eq("is_demo", demo).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1001);
  if (error && ["42P01", "PGRST205"].includes(error.code)) return { leads: [], configured: false, hasMore: false };
  if (error) throw new IntegrationError(503, "Your pipeline could not load. Try refreshing it.");
  const leads = data as CallerLead[];
  return { leads: leads.slice(0, 1000), hasMore: (count ?? leads.length) > 1000, configured: true };
}
export async function importCallerLeads(owner: string, requestId: string, leads: LeadInput[]): Promise<{ imported: number; duplicates: number; replayed: boolean }> {
  const { data, error } = await database().rpc("caller_import_leads", { p_operator: owner, p_request: requestId, p_leads: leads });
  if (error) throw new IntegrationError(error.message.includes("import_conflict") ? 409 : 503, error.message.includes("import_conflict") ? "This import request was already used for different leads. Choose the file again." : "Leads could not be saved. Keep this page open and retry the same import.");
  return data;
}
export async function updateCallerLead(owner: string, id: string, stage: LeadStage, notes: string, updatedAt: string, demo = false): Promise<CallerLead> {
  const { data, error } = await database().from("caller_leads").update({ stage, notes, updated_at: new Date(Math.max(Date.now(), Date.parse(updatedAt) + 1)).toISOString() }).eq("operator_id", owner).eq("id", id).eq("is_demo", demo).eq("updated_at", updatedAt).select(fields).maybeSingle();
  if (error) throw new IntegrationError(503, "This lead could not be saved. Try again.");
  if (!data) {
    const current = await database().from("caller_leads").select("id").eq("operator_id", owner).eq("id", id).eq("is_demo", demo).maybeSingle();
    if (current.error) throw new IntegrationError(503, "This lead could not be checked. Try again.");
    throw new IntegrationError(current.data ? 409 : 404, current.data ? "This lead changed elsewhere. Refresh your pipeline before saving again." : "That lead was not found in your pipeline.");
  }
  return data as CallerLead;
}
export async function readCallerJson(request: Request, maxBytes = 512 * 1024): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new IntegrationError(415, "Use application/json.");
  const reader = request.body?.getReader(); if (!reader) throw new IntegrationError(400, "A request body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const result = await reader.read(); if (result.done) break; size += result.value.length; if (size > maxBytes) { await reader.cancel(); throw new IntegrationError(413, `Use a request smaller than ${Math.floor(maxBytes / 1024)} KB.`); } chunks.push(result.value); } }
  finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new IntegrationError(400, "Use a valid JSON request."); }
}
