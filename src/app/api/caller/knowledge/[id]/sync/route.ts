import { requireWorkspaceAdmin } from "@/services/workspace-auth";
import { apiError, IntegrationError } from "@/services/integration.service";
import { syncKnowledgeSource } from "@/services/caller-knowledge.service";
import { validSessionId } from "@/lib/caller-validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const user = await requireWorkspaceAdmin(request);
    const { id } = await context.params;
    if (!validSessionId(id)) throw new IntegrationError(400, "Choose a valid knowledge source.");
    return Response.json({ source: await syncKnowledgeSource(user.id, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
