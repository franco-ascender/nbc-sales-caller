export interface CalendarEntry { id: string; title: string; starts_at: string; ends_at: string; join_url: string | null; all_day: boolean; source: 'nbc'|'google' }
export interface CalendarFeed { events: CalendarEntry[]; timezone: string; externalStatus: 'not_connected'|'connected'|'unavailable'; checkedAt: string }
export interface GoogleEvent { id?: string; summary?: string; status?: string; visibility?: string; start?: {dateTime?:string;date?:string}; end?:{dateTime?:string;date?:string}; hangoutLink?:string; conferenceData?:{entryPoints?:{entryPointType?:string;uri?:string}[]} }
export function safeMeetingUrl(value: unknown): string | null { if(typeof value!=='string')return null;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;} }
export function googleCalendarEntry(event: GoogleEvent): CalendarEntry | null {
  if(!event.id||event.status==='cancelled'||event.visibility==='private')return null;
  const start=event.start?.dateTime??event.start?.date, end=event.end?.dateTime??event.end?.date;if(!start||!end||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start))return null;
  return {id:`google:${event.id}`,title:event.summary?.trim().slice(0,250)||'Mentoring session',starts_at:start,ends_at:end,all_day:Boolean(event.start?.date),source:'google',join_url:safeMeetingUrl(event.conferenceData?.entryPoints?.find(e=>e.entryPointType==='video')?.uri??event.hangoutLink)};
}
