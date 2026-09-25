import type { Member, MemberRole } from "./member-types.ts";
export class MemberError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function canManageStudent(actor: Member, student: Member): boolean {
  return actor.status === "active" && student.status === "active" && (actor.id === student.id || actor.role === "admin" || (actor.role === "coach" && student.role === "student" && student.coach_id === actor.id));
}
export function memberRole(value: unknown): MemberRole {
  if (value !== "admin" && value !== "coach" && value !== "student") throw new MemberError(400, "Choose a valid member role.");
  return value;
}
export function memberText(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new MemberError(400, `Check ${label}.`);
  return value.trim();
}
export function memberId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new MemberError(400, "Choose a valid member or item.");
  return value;
}
export function memberTimezone(value: unknown): string {
  const zone = memberText(value, "time zone", 80);
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); } catch { throw new MemberError(400, "Choose a valid time zone."); }
  return zone;
}
export function memberMeetingUrl(value: unknown): string {
  const text = memberText(value, "meeting link", 2000);
  try { const url = new URL(text); if (url.protocol === "https:" && !url.username && !url.password) return url.href; } catch { /* Safe error below. */ }
  throw new MemberError(400, "Use an HTTPS meeting link without embedded credentials.");
}
export function memberEventTimes(start: unknown, end: unknown): { starts_at: string; ends_at: string } {
  const from = Date.parse(memberText(start, "start time", 40));
  const to = Date.parse(memberText(end, "end time", 40));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 86400000) throw new MemberError(400, "End time must follow start time, within one day.");
  return { starts_at: new Date(from).toISOString(), ends_at: new Date(to).toISOString() };
}
export function memberCredits(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 1000000) throw new MemberError(400, "Credits must be a whole number between 1 and 1,000,000.");
  return value;
}
