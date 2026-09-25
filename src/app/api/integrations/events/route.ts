import { apiError, database, IntegrationError, requireOperator } from "@/services/integration.service";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireOperator(request);
    if (!process.env.GHL_LOCATION_ID) return Response.json({ events: [], configured: false }, { headers: { "Cache-Control": "no-store" } });
    const { data, error } = await database().from("integration_events").select("id,event_id,event_type,contact_id,received_at").eq("location_id", process.env.GHL_LOCATION_ID).order("received_at", { ascending: false }).limit(25);
    if (error) { console.error("Event read failed", { code: error.code }); throw new IntegrationError(503, "The event history is unavailable. Check the database setup."); }
    return Response.json({ events: data, configured: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
