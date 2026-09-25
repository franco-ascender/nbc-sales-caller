import "server-only";
import { IntegrationError } from "@/services/integration.service";
import { mapGhlAppointments, mapGhlOpportunities } from "@/lib/tracker-types";
import type { TrackerRange, TrackerSnapshot } from "@/lib/tracker-types";

// Reuses the single-location GHL credential already configured for the webhook/contact-check
// integration (src/services/integration.service.ts). No new secret storage: this is one
// account, server-only, exactly like the existing pattern. Multi-tenant (one GHL connection
// per NBC client) is a separate, later phase that needs its own credential storage design.
export function ghlConfigured(): boolean {
  return Boolean(process.env.GHL_PRIVATE_INTEGRATION_TOKEN && process.env.GHL_LOCATION_ID && process.env.GHL_API_BASE_URL && process.env.GHL_API_VERSION);
}

function ghlBase(): URL {
  const base = new URL(process.env.GHL_API_BASE_URL!);
  if (base.protocol !== "https:" || base.hostname !== "services.leadconnectorhq.com") throw new IntegrationError(503, "The GoHighLevel API address is not valid.");
  return base;
}

async function ghlFetch(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(new URL(path, ghlBase()), {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`, Version: process.env.GHL_API_VERSION!, Accept: "application/json" },
      cache: "no-store", signal: AbortSignal.timeout(10000), redirect: "error",
    });
  } catch { throw new IntegrationError(502, "GoHighLevel could not be reached. Please try again."); }
  if (!response.ok) { console.error("GHL tracker request failed", { path, status: response.status }); throw new IntegrationError(502, "GoHighLevel rejected the tracker request. Check the integration permissions and API version."); }
  return response.json();
}

export async function fetchGhlSnapshot(range: TrackerRange): Promise<TrackerSnapshot> {
  if (!ghlConfigured()) throw new IntegrationError(503, "GoHighLevel has not been configured yet.");
  const locationId = process.env.GHL_LOCATION_ID!;
  // GHL requires at least one of calendarId/userId/groupId on this endpoint; without
  // GHL_CALENDAR_ID configured, appointments stay "no dato" rather than a guessed default.
  const eventsPayload = process.env.GHL_CALENDAR_ID
    ? await ghlFetch(`/calendars/events?locationId=${encodeURIComponent(locationId)}&startTime=${range.startMs}&endTime=${range.endMs}&calendarId=${encodeURIComponent(process.env.GHL_CALENDAR_ID)}`)
    : null;
  const opportunitiesPayload = await ghlFetch(`/opportunities/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId, page: 0, limit: 100 }) });
  return {
    provider: "ghl",
    fetchedAt: new Date().toISOString(),
    range,
    appointments: eventsPayload ? mapGhlAppointments(eventsPayload, locationId) : null,
    pipeline: mapGhlOpportunities(opportunitiesPayload, locationId),
  };
}
