import type { CallRecord } from "../components/dashboard/Dashboard.types.ts";

export function summarize(calls: CallRecord[]): { total: number; answered: number; booked: number; bookingRate: number; responseMs: number | null; minutes: number } {
  const answered = calls.filter(call => call.outcome !== "No answer");
  const booked = calls.filter(call => call.outcome === "Booked").length;
  const timings = answered.flatMap(call => call.responseMs === null ? [] : [call.responseMs]);
  return {
    total: calls.length, answered: answered.length, booked,
    bookingRate: answered.length ? booked / answered.length * 100 : 0,
    responseMs: timings.length ? Math.round(timings.reduce((sum, value) => sum + value, 0) / timings.length) : null,
    minutes: Math.round(calls.reduce((sum, call) => sum + call.duration, 0) / 60),
  };
}

export function csvCell(value: string): string {
  const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function durationLabel(seconds: number): string {
  return seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "—";
}
