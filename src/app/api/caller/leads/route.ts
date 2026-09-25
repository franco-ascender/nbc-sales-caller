import { apiError, IntegrationError } from "@/services/integration.service";
import { requireCallerUser, requireWorkspaceAdmin } from "@/services/workspace-auth";
import { importCallerLeads, readCallerJson, readCallerLeads, updateCallerLead } from "@/services/caller-crm.service";
import { leadStages, validateLead } from "@/lib/caller-crm";
import type { LeadStage } from "@/lib/caller-crm";
import { validSessionId } from "@/lib/caller-validation";
import { validCursorDate } from "@/lib/caller-pagination";
import { isRecord } from "@/lib/integration-validation";
const reply = (body: unknown): Response => Response.json(body, { headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request): Promise<Response> { try { const owner = await requireCallerUser(request); const demo = new URL(request.url).searchParams.get("demo") === "true"; if (demo) await requireWorkspaceAdmin(request); return reply(await readCallerLeads(owner, demo)); } catch (error) { return apiError(error); } }
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireCallerUser(request); const body = await readCallerJson(request);
    if (!isRecord(body) || !validSessionId(body.requestId) || !Array.isArray(body.leads) || body.leads.length < 1 || body.leads.length > 500) throw new IntegrationError(400, "Import between 1 and 500 leads with a valid request ID.");
    let leads;
    try { leads = body.leads.map(validateLead); } catch (error) { throw new IntegrationError(400, error instanceof Error ? error.message : "Check the imported leads."); }
    return reply(await importCallerLeads(user, body.requestId, leads));
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request): Promise<Response> {
  try {
    const user = await requireCallerUser(request); const body = await readCallerJson(request, 8192);
    if (!isRecord(body) || !validSessionId(body.id) || !leadStages.includes(body.stage as LeadStage) || typeof body.notes !== "string" || body.notes.length > 4000 || !validCursorDate(body.updatedAt)) throw new IntegrationError(400, "Choose a valid lead stage and notes up to 4,000 characters.");
    if (body.demo !== undefined && typeof body.demo !== "boolean") throw new IntegrationError(400, "Choose a valid workspace mode.");
    if (body.demo === true) await requireWorkspaceAdmin(request);
    return reply({ lead: await updateCallerLead(user, body.id, body.stage as LeadStage, body.notes, body.updatedAt, body.demo === true) });
  } catch (error) { return apiError(error); }
}
