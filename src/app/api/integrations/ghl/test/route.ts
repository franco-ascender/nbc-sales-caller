import { apiError, checkContact, IntegrationError, readJson, requireOperator } from "@/services/integration.service";
import { isIdentifier, isRecord } from "@/lib/integration-validation";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireOperator(request);
    const body = await readJson(request);
    if (!isRecord(body) || !isIdentifier(body.contactId)) throw new IntegrationError(400, "Enter a valid GoHighLevel contact ID.");
    return Response.json({ contact: await checkContact(body.contactId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
