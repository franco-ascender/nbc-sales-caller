import { requireCallerUser, requireWorkspaceAdmin, requireWorkspaceUser } from "@/services/workspace-auth";
import { apiError, IntegrationError, readJson } from "@/services/integration.service";
import { listSessionPage, startWebSession } from "@/services/caller.service";
import { validSessionId } from "@/lib/caller-validation";
import { parseSessionPage } from "@/lib/caller-pagination";
import { isRecord } from "@/lib/integration-validation";
import { parseConversationScenario } from "@/lib/caller-knowledge";

export async function GET(request: Request): Promise<Response> {
  try {
    const operator = await requireCallerUser(request);
    const params = new URL(request.url).searchParams;
    const demo = params.get("demo") === "true";
    if (demo) await requireWorkspaceAdmin(request);
    let options;
    try {
      if (params.getAll("cursor").length > 1 || params.getAll("limit").length > 1) throw new Error("Use one cursor and one limit.");
      options = parseSessionPage(params.get("cursor"), params.get("limit"));
    } catch (error) { throw new IntegrationError(400, error instanceof Error ? error.message : "Invalid history page."); }
    return Response.json({ ...await listSessionPage(operator, options, false, demo), configured: Boolean((process.env.ELEVENLABS_WEB_AGENT_ID || process.env.ELEVENLABS_AGENT_ID) && process.env.ELEVENLABS_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireWorkspaceUser(request);
    const body = await readJson(request);
    if (!isRecord(body) || !validSessionId(body.sessionId)) throw new IntegrationError(400, "A valid test session ID is required.");
    let scenario;
    if (body.scenario !== undefined) {
      if (user.role !== "admin") throw new IntegrationError(403, "Administrator access is required to run custom scenarios.");
      try { scenario = parseConversationScenario(body.scenario); }
      catch (error) { throw new IntegrationError(400, error instanceof Error ? error.message : "Use a valid conversation scenario."); }
    }
    return Response.json(await startWebSession(user.id, body.sessionId, scenario), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
