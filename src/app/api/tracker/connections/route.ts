import "server-only";
import { requireWorkspaceAdmin } from "@/services/workspace-auth";
import { apiError, IntegrationError } from "@/services/integration.service";
import { trackerConnectionStatus } from "@/services/tracker-connections";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireWorkspaceAdmin(request);
    return Response.json(trackerConnectionStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error instanceof IntegrationError && error.status === 403 ? new IntegrationError(403, "Administrator access is required to view tracker connections.") : error);
  }
}
