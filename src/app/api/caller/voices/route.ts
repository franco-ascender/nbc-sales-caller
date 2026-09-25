import { apiError, IntegrationError, readJson } from "@/services/integration.service";
import { requireWorkspaceAdmin } from "@/services/workspace-auth";
import { createCallerVoice, listCallerVoices, selectCallerVoice } from "@/services/caller-voices.service";
import { validSessionId } from "@/lib/caller-validation";
import { isRecord } from "@/lib/integration-validation";
const noStore = { headers: { "Cache-Control": "no-store" } };
export async function GET(request: Request): Promise<Response> {
  try {
    await requireWorkspaceAdmin(request);
    const query = new URL(request.url).searchParams, cursor = query.get("cursor");
    if ([...query.keys()].some(key => key !== "cursor") || query.getAll("cursor").length > 1 || cursor !== null && (!cursor.length || cursor.length > 2048 || /[\x00-\x1f]/.test(cursor))) throw new IntegrationError(400, "Use the next cursor supplied by the voice list.");
    return Response.json(await listCallerVoices(cursor || undefined), noStore);
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request): Promise<Response> {
  try { await requireWorkspaceAdmin(request); const body = await readJson(request); if (!isRecord(body) || typeof body.voiceId !== "string") throw new IntegrationError(400, "Choose an available voice."); await selectCallerVoice(body.voiceId); return Response.json({ voiceId: body.voiceId }, noStore); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireWorkspaceAdmin(request), body = await readJson(request);
    if (!isRecord(body) || !validSessionId(body.requestId) || typeof body.name !== "string" || !body.name.trim() || body.name.length > 80 || typeof body.description !== "string" || body.description.trim().length < 20 || body.description.length > 1000 || body.acceptServiceUsage !== true || /[\x00-\x1f]/.test(body.name)) throw new IntegrationError(400, "Provide a name, an original voice description (20–1,000 characters) and confirm service usage.");
    return Response.json(await createCallerVoice(user.id, body.requestId, body.name.trim(), body.description.trim()), noStore);
  } catch (error) { return apiError(error); }
}
