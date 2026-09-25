import { requireCallerUser } from "@/services/workspace-auth";
import { apiError, IntegrationError } from "@/services/integration.service";
import { syncSession } from "@/services/caller.service";
import { validSessionId } from "@/lib/caller-validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const operator = await requireCallerUser(request);
    const { id } = await context.params;
    if (!validSessionId(id)) throw new IntegrationError(400, "A valid test session ID is required.");
    return Response.json({ session: await syncSession(operator, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
