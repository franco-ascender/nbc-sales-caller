import { apiError } from "@/services/integration.service";
import { requireWorkspaceUser } from "@/services/workspace-auth";
export async function GET(request: Request): Promise<Response> {
  try { return Response.json({ user: await requireWorkspaceUser(request) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}
