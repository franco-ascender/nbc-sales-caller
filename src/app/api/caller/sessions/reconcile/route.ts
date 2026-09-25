import { requireCallerUser } from "@/services/workspace-auth";
import { apiError, IntegrationError, readJson } from "@/services/integration.service";
import { reconcileSessions } from "@/services/caller.service";
import { parseSessionPage } from "@/lib/caller-pagination";
import { isRecord } from "@/lib/integration-validation";

export async function POST(request: Request): Promise<Response> {
  try {
    const operator = await requireCallerUser(request);
    const body = await readJson(request);
    if (!isRecord(body) || Object.keys(body).some(key => !["cursor", "limit"].includes(key)) || ("limit" in body && typeof body.limit !== "number") || ("cursor" in body && typeof body.cursor !== "string")) throw new IntegrationError(400, "Use a cursor and a limit of up to five sessions.");
    let options;
    try { options = parseSessionPage(body.cursor, body.limit, 5); }
    catch (error) { throw new IntegrationError(400, error instanceof Error ? error.message : "Invalid recovery page."); }
    return Response.json(await reconcileSessions(operator, options), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
