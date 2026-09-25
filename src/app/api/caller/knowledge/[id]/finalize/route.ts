import { requireWorkspaceAdmin } from "@/services/workspace-auth";
import { apiError, IntegrationError } from "@/services/integration.service";
import { finalizeAudioKnowledge } from "@/services/caller-knowledge.service";
import { validSessionId } from "@/lib/caller-validation";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context): Promise<Response> { try { const user = await requireWorkspaceAdmin(request), { id } = await context.params; if (!validSessionId(id)) throw new IntegrationError(400, "Choose a valid audio source."); return Response.json({ source: await finalizeAudioKnowledge(user.id, id) }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return apiError(error); } }
