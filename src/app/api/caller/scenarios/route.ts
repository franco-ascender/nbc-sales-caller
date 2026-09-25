import { requireWorkspaceAdmin } from "@/services/workspace-auth";
import { apiError, IntegrationError } from "@/services/integration.service";
import { readCallerJson } from "@/services/caller-crm.service";
import { listScenarios, saveScenario } from "@/services/caller-knowledge.service";
import { parseConversationScenario } from "@/lib/caller-knowledge";
import { isRecord } from "@/lib/integration-validation";
import { validSessionId } from "@/lib/caller-validation";
export async function GET(request: Request): Promise<Response> { try { const user = await requireWorkspaceAdmin(request); return Response.json(await listScenarios(user.id), { headers: { "Cache-Control": "no-store" } }); } catch (error) { return apiError(error); } }
export async function POST(request: Request): Promise<Response> { try { const user = await requireWorkspaceAdmin(request), body = await readCallerJson(request, 16_384); if (!isRecord(body) || !validSessionId(body.requestId)) throw new IntegrationError(400, "Use a valid scenario request."); let scenario; try { scenario = parseConversationScenario(body.scenario); } catch (error) { throw new IntegrationError(400, error instanceof Error ? error.message : "Use a valid conversation scenario."); } return Response.json({ scenario: await saveScenario(user.id, body.requestId, scenario) }, { status: 201, headers: { "Cache-Control": "no-store" } }); } catch (error) { return apiError(error); } }
