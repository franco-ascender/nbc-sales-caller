import type { CalendarEntry } from './calendar-feed.ts';

export function calendarDay(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function calendarDate(day: string): Date { return new Date(`${day}T12:00:00Z`); }
export function moveCalendarDay(day: string, offset: number): string {
  const date = calendarDate(day); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10);
}
export function moveCalendarMonth(month: string, offset: number): string {
  const date = calendarDate(month.slice(0, 7) + '-01'); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 10);
}
export function calendarMonthDays(month: string): string[] {
  const first = month.slice(0, 7) + '-01'; const start = moveCalendarDay(first, -calendarDate(first).getUTCDay());
  return Array.from({ length: 42 }, (_, index) => moveCalendarDay(start, index));
}
export function calendarEventsOnDay(events: CalendarEntry[], day: string, timezone: string): CalendarEntry[] {
  return events.filter(event => {
    const start = Date.parse(event.starts_at); const end = Date.parse(event.ends_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
    const first = event.all_day ? event.starts_at.slice(0, 10) : calendarDay(new Date(start), timezone);
    const last = event.all_day ? moveCalendarDay(event.ends_at.slice(0, 10), -1) : calendarDay(new Date(end - 1), timezone);
    return day >= first && day <= last;
  });
}
