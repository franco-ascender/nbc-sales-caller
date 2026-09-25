export type View = "Overview" | "Caller" | "Calls" | "Leads" | "Appointments" | "Agent" | "Integrations";
export type Outcome = "Booked" | "Qualified" | "Follow-up" | "No answer" | "Transferred";
export type Period = "7" | "14" | "30";

export interface CallRecord {
  id: string;
  contactId: string;
  name: string;
  company: string;
  initials: string;
  phone: string;
  email: string;
  date: string;
  duration: number;
  responseMs: number | null;
  outcome: Outcome;
  source: "Website form" | "Facebook lead ad" | "Referral";
  appointment: string | null;
  summary: string;
}

export interface IntegrationStatus {
  ghl: boolean;
  auth: boolean;
  storage: boolean;
  webhook: boolean;
}

export interface IntegrationEvent {
  id: string;
  event_id: string;
  event_type: string;
  contact_id: string;
  received_at: string;
}

export interface ContactCheck {
  id: string;
  name: string;
  checkedAt: string;
}
