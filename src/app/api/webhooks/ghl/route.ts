import { apiError, database, IntegrationError, readJson, requireWebhookSecret } from "@/services/integration.service";
import { parseWorkflowEvent } from "@/lib/integration-validation";

export async function POST(request: Request): Promise<Response> {
  try {
    requireWebhookSecret(request);
    const event = parseWorkflowEvent(await readJson(request), process.env.GHL_LOCATION_ID ?? "");
    if (!event) throw new IntegrationError(400, "Invalid event or test workspace.");
    const { error } = await database().from("integration_events").insert({ event_id: event.eventId, location_id: event.locationId, contact_id: event.contactId, event_type: event.type });
    if (error?.code === "23505") return Response.json({ received: true, duplicate: true });
    if (error) { console.error("Event persistence failed", { code: error.code }); throw new IntegrationError(503, "The event could not be stored. Retry with the same event ID."); }
    return Response.json({ received: true, duplicate: false }, { status: 201 });
  } catch (error) { return apiError(error); }
}
