import { apiError, IntegrationError, readJson } from "@/services/integration.service";
import { purchaseQuotedNumber, quoteCityNumbers, readCityNumberCoverage, reconcilePhoneNumber, setNumberPurchasePolicy } from "@/services/caller-city-numbers.service";
import { requireWorkspaceAdmin } from "@/services/workspace-auth";
import { isRecord } from "@/lib/integration-validation";

const approverEmail = (): string => (process.env.NBC_NUMBER_APPROVER_EMAIL ?? "anas@nbcsales.io").trim().toLowerCase();

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireWorkspaceAdmin(request);
    return Response.json(await readCityNumberCoverage(user.email === approverEmail()), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireWorkspaceAdmin(request), body = await readJson(request);
    if (!isRecord(body) || typeof body.action !== "string") throw new IntegrationError(400, "Choose a valid number action.");
    if (body.action === "quote") return Response.json(await quoteCityNumbers(body.city, body.region), { headers: { "Cache-Control": "no-store" } });
    if (body.action === "purchase") return Response.json({ number: await purchaseQuotedNumber(user.id, body.quoteId, body.requestId, body.confirmed) }, { headers: { "Cache-Control": "no-store" } });
    if (body.action === "reconcile") {
      if (typeof body.id !== "string") throw new IntegrationError(400, "Choose a valid number record.");
      return Response.json({ number: await reconcilePhoneNumber(body.id) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "set_budget") {
      if (user.email !== approverEmail()) throw new IntegrationError(403, "Only Anas can approve or change the phone-number budget.");
      if (typeof body.approved !== "boolean") throw new IntegrationError(400, "Choose whether number purchasing is approved.");
      await setNumberPurchasePolicy(user.id, body.approved, body.monthlyBudgetCents, body.maximumActiveNumbers);
      return Response.json(await readCityNumberCoverage(true), { headers: { "Cache-Control": "no-store" } });
    }
    throw new IntegrationError(400, "Choose a valid number action.");
  } catch (error) { return apiError(error); }
}
