export type MemberRole = "admin" | "coach" | "student";
export type MemberSection = "journey" | "calendar" | "chat" | "tickets" | "credits";
export interface MemberSummary { completed: boolean; available: number }
export interface Member { id: string; display_name: string; role: MemberRole; status: "active" | "suspended"; coach_id: string | null }
export interface MemberOnboarding { business: string; timezone: string; goal: string; questions: string; completed_at: string | null }
export interface MemberEvent { id: string; title: string; starts_at: string; ends_at: string; join_url: string; student_id: string | null }
export interface MemberMessage { id: string; author_id: string; body: string; created_at: string }
export interface MemberTicket { id: string; member_id: string; title: string; body: string; status: "open" | "resolved"; created_at: string }
export interface MemberCreditEntry { id: string; amount: number; reason: string; created_at: string }
export interface MemberWorkspaceData {
  member: Member;
  subject: Member;
  people: Member[];
  onboarding: MemberOnboarding | null;
  events: MemberEvent[];
  messages: MemberMessage[];
  tickets: MemberTicket[];
  credits: { available: number; reserved: number; entries: MemberCreditEntry[] };
  nextMessages: string | null;
}
