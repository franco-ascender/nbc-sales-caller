import { parseAnalysisReview, validSessionId } from "@/lib/caller-validation";
import { reviewSessionAnalysis } from "@/services/caller.service";
import { apiError, IntegrationError, readJson } from "@/services/integration.service";
import { requireCallerUser } from "@/services/workspace-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const operator = await requireCallerUser(request), { id } = await context.params;
    if (!validSessionId(id)) throw new IntegrationError(400, "A valid session ID is required.");
    let review; try { review = parseAnalysisReview(await readJson(request)); } catch { throw new IntegrationError(400, "Choose valid review values and keep notes under 500 characters."); }
    return Response.json({ session: await reviewSessionAnalysis(operator, id, review) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
