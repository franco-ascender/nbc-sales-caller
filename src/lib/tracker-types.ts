import { isRecord } from "./integration-validation.ts";

export type TrackerProvider = "ghl" | "meta" | "stripe";
export type TrackerConnectionState = "not_configured" | "configured" | "verified" | "blocked";
export type TrackerConnectionStatus = Record<TrackerProvider, TrackerConnectionState>;

// Every provider snapshot uses this shape so a dashboard widget never needs to know
// which connector produced it. Swapping GHL for Meta/Stripe means writing a new
// service that returns this same type, not touching the widget layer.
export interface TrackerRange { startMs: number; endMs: number }
export interface TrackerSnapshot {
  provider: TrackerProvider;
  fetchedAt: string;
  range: TrackerRange;
  appointments: { total: number | null; byStatus: Record<string, number> } | null;
  pipeline: { openCount: number | null; wonCount: number | null; wonValueCents: number | null; currency: "USD" | "unknown" } | null;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// GHL calendar event shape per public API v2 docs (services.leadconnectorhq.com, Version: v3).
// Field names are per documentation, not yet confirmed against a live sandbox response for
// this account; treat this mapper as the single place to correct them once verified.
export interface GhlAppointmentsPayload { events: unknown }
export function mapGhlAppointments(payload: unknown, expectedLocationId: string): TrackerSnapshot["appointments"] {
  if (!isRecord(payload) || !Array.isArray(payload.events)) return null;
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const raw of payload.events) {
    if (!isRecord(raw)) continue;
    if (expectedLocationId && "locationId" in raw && raw.locationId !== expectedLocationId) continue;
    const status = typeof raw.appointmentStatus === "string" && raw.appointmentStatus.length > 0 ? raw.appointmentStatus : "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    total += 1;
  }
  return { total, byStatus };
}

// GHL opportunities search response shape per public API v2 docs. Same verification note as above.
export interface GhlOpportunitiesPayload { opportunities: unknown }
export function mapGhlOpportunities(payload: unknown, expectedLocationId: string): TrackerSnapshot["pipeline"] {
  if (!isRecord(payload) || !Array.isArray(payload.opportunities)) return null;
  let openCount = 0, wonCount = 0, wonValueCents: number | null = 0, sawMonetaryValue = false;
  for (const raw of payload.opportunities) {
    if (!isRecord(raw)) continue;
    if (expectedLocationId && "locationId" in raw && raw.locationId !== expectedLocationId) continue;
    const status = typeof raw.status === "string" ? raw.status : "unknown";
    if (status === "won") {
      wonCount += 1;
      if (isFiniteNumber(raw.monetaryValue) && raw.monetaryValue >= 0) { wonValueCents = (wonValueCents ?? 0) + Math.round(raw.monetaryValue * 100); sawMonetaryValue = true; }
    } else if (status === "open") openCount += 1;
  }
  return { openCount, wonCount, wonValueCents: sawMonetaryValue ? wonValueCents : null, currency: sawMonetaryValue ? "USD" : "unknown" };
}
