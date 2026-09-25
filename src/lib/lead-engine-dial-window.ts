import zipFile from '../data/lead-engine-zip-timezones.json' with { type: 'json' };
import { resolveTimeZone } from './lead-engine-timezone.ts';

// Phase 0 task 6: time zone from ZIP (GeoNames, free) with the state/city/area-code resolver as fallback,
// and the dial window 08:00 to 20:00 in the RECIPIENT's local time. A row without a zone is held back,
// never delivered: a guessed zone is how someone gets a cold call at 6am.

export const DIAL_WINDOW = { start: '08:00', end: '20:00' } as const;
const START_MINUTES = 8 * 60, END_MINUTES = 20 * 60;

interface ZipTable { prefix: Record<string, string>; zip: Record<string, string> }
const table = zipFile as unknown as ZipTable;

export function zip5(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const match = /^\s*(\d{5})(?:-?\d{4})?\s*$/.exec(String(value));
  return match ? match[1] : null;
}

export function timeZoneForZip(value: unknown): string | null {
  const zip = zip5(value);
  if (!zip) return null;
  return table.zip[zip] ?? table.prefix[zip.slice(0, 3)] ?? null;
}

export interface ZoneInput { zip?: unknown; state?: string | null; city?: string | null; phone10?: string | null }

// ZIP first (finest grain), then the existing state/city/area-code resolver.
export function resolveZone(input: ZoneInput): string | null {
  return timeZoneForZip(input.zip) ?? resolveTimeZone({ state: input.state ?? '', city: input.city ?? undefined, phone10: input.phone10 ?? undefined });
}

export function localMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? NaN), minute = Number(parts.find(part => part.type === 'minute')?.value ?? NaN);
  if (Number.isNaN(hour) || Number.isNaN(minute)) throw new RangeError(`Unreadable local time for ${timeZone}`);
  return hour * 60 + minute;
}

export function withinDialWindow(at: Date, timeZone: string): boolean {
  const minutes = localMinutes(at, timeZone);
  return minutes >= START_MINUTES && minutes < END_MINUTES;
}

export interface DialStatus { timeZone: string; localTime: string; open: boolean; opensInMinutes: number }

// What a caller sees next to a row: local time now and whether the window is open. When closed, how long
// until 08:00 local so a sheet can be sorted by "callable soonest".
export function dialStatus(timeZone: string, now: Date = new Date()): DialStatus {
  const minutes = localMinutes(now, timeZone);
  const open = minutes >= START_MINUTES && minutes < END_MINUTES;
  const opensInMinutes = open ? 0 : minutes < START_MINUTES ? START_MINUTES - minutes : 24 * 60 - minutes + START_MINUTES;
  const localTime = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return { timeZone, localTime, open, opensInMinutes };
}

export interface HoldBackResult<T> { deliverable: T[]; held: Array<{ row: T; reason: 'time_zone_unresolved' }> }

// Rows with no resolvable zone are held with a reason instead of being dropped silently or shipped blind.
export function holdBackWithoutZone<T>(rows: T[], zoneOf: (row: T) => string | null): HoldBackResult<T> {
  const deliverable: T[] = [], held: HoldBackResult<T>['held'] = [];
  for (const row of rows) {
    if (zoneOf(row)) deliverable.push(row); else held.push({ row, reason: 'time_zone_unresolved' });
  }
  return { deliverable, held };
}
