export interface WorkflowEvent {
  eventId: string;
  locationId: string;
  contactId: string;
  type: "contact.created" | "contact.updated" | "integration.test";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}

export function parseWorkflowEvent(value: unknown, expectedLocation: string): WorkflowEvent | null {
  if (!isRecord(value) || !expectedLocation || value.locationId !== expectedLocation) return null;
  if (!isIdentifier(value.eventId) || !isIdentifier(value.contactId)) return null;
  if (value.type !== "contact.created" && value.type !== "contact.updated" && value.type !== "integration.test") return null;
  return { eventId: value.eventId, contactId: value.contactId, locationId: expectedLocation, type: value.type };
}
