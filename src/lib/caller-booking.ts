export interface BookingConfig {
  businessName: string; locationId: string; calendarId: string; timezone: string;
  pipelineId: string; stageId: string; tags: string[];
  emailFrom: string; smsFrom: string; sendEmail: boolean; sendSms: boolean;
  enabled: boolean;
}
export interface BookingRequest { timezone: string; startTime: string; name: string; email: string; confirmed: true; smsConsent: boolean }
export type BookingStep = 'tags' | 'opportunity' | 'email' | 'sms';
export type StepState = 'pending' | 'running' | 'accepted' | 'delivered' | 'skipped' | 'failed' | 'uncertain';
export interface StepReceipt { state: StepState; providerId?: string; reason?: string; costMicrousd: number | null }
export interface BookingReceipt { id: string; state: 'booking'|'booked'|'unavailable'|'uncertain'; appointmentId?: string; startTime?: string; endTime?: string; meetingUrl?: string; steps: Partial<Record<BookingStep, StepReceipt>> }
export const emptyBookingConfig = (): BookingConfig => ({businessName:'NBC Sales',locationId:'',calendarId:'',timezone:'America/New_York',pipelineId:'',stageId:'',tags:[],emailFrom:'',smsFrom:'',sendEmail:true,sendSms:true,enabled:false});
const record = (v: unknown): v is Record<string,unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
function text(v:unknown,max:number):string { if(typeof v!=='string'||v.length>max||/[\x00-\x1f\x7f]/.test(v))throw new Error('Use valid booking settings.');return v.trim(); }
export const bookingId = (v:unknown):string => {const s=text(v,100);if(!/^[a-zA-Z0-9_-]+$/.test(s))throw new Error('Choose a valid calendar or pipeline.');return s;};
export const emailAddress = (v:unknown):string => {const s=text(v,254).toLowerCase();if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s))throw new Error('Confirm a valid email address.');return s;};
export function bookingTimezone(v:unknown):string {const s=text(v,100);try{new Intl.DateTimeFormat('en-US',{timeZone:s}).format();}catch{throw new Error('Choose an IANA timezone.');}return s;}
export function parseBookingConfig(v:unknown):BookingConfig {
 if(!record(v))throw new Error('Use valid booking settings.');
 const tags=v.tags;if(!Array.isArray(tags)||tags.length>10)throw new Error('Use up to 10 tags.');
 for(const k of ['enabled','sendEmail','sendSms'])if(typeof v[k]!=='boolean')throw new Error('Choose the notification channels.');
 const smsFrom=text(v.smsFrom,20);if(v.sendSms&&!/^\+[1-9]\d{7,14}$/.test(smsFrom))throw new Error('Choose your connected GHL SMS number in international format.');
 const businessName=text(v.businessName,100);if(!businessName)throw new Error('Enter the business name.');
 return {businessName,locationId:bookingId(v.locationId),calendarId:bookingId(v.calendarId),timezone:bookingTimezone(v.timezone),pipelineId:bookingId(v.pipelineId),stageId:bookingId(v.stageId),tags:[...new Set(tags.map(t=>text(t,60)).filter(Boolean))],emailFrom:v.sendEmail?emailAddress(v.emailFrom):'',smsFrom,sendEmail:v.sendEmail as boolean,sendSms:v.sendSms as boolean,enabled:v.enabled as boolean};
}
export function parseBookingRequest(v:unknown,now=Date.now()):BookingRequest {
 if(!record(v)||v.confirmed!==true||typeof v.smsConsent!=='boolean')throw new Error('Confirm the appointment with the recipient before booking.');
 const startTime=text(v.startTime,40),name=text(v.name,100);
 if(!name||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(startTime)||!Number.isFinite(Date.parse(startTime))||Date.parse(startTime)<=now||Date.parse(startTime)>now+90*86400000)throw new Error('Choose a future slot within 90 days, with a timezone offset.');
 return {timezone:bookingTimezone(v.timezone),startTime:new Date(startTime).toISOString(),name,email:emailAddress(v.email),confirmed:true,smsConsent:v.smsConsent};
}
export function safeMeetingUrl(value:unknown):string|undefined {if(typeof value!=='string')return;try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{/* Not a meeting URL. */}}
export function blockedChannel(contact:Record<string,unknown>,channel:'SMS'|'Email'):boolean {if(contact.dnd===true)return true;const settings=contact.dndSettings;return record(settings)&&record(settings[channel])&&settings[channel].status==='active';}
export function calendarInvite(input:{id:string;title:string;start:string;end:string;url?:string;organizer:string;email:string;createdAt:string}):string {
 const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 const stamp=(s:string)=>new Date(s).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NBC Sales//Caller Booking//EN','METHOD:REQUEST','BEGIN:VEVENT',`UID:${input.id}@nbcsales.io`,`DTSTAMP:${stamp(input.createdAt)}`,`DTSTART:${stamp(input.start)}`,`DTEND:${stamp(input.end)}`,`SUMMARY:${escape(input.title)}`,`ORGANIZER:mailto:${input.organizer}`,`ATTENDEE;RSVP=TRUE:mailto:${input.email}`,'STATUS:CONFIRMED','SEQUENCE:0',...(input.url?[`URL:${escape(input.url)}`,`LOCATION:${escape(input.url)}`]:[]),'END:VEVENT','END:VCALENDAR'];
 // Fold by UTF-8 bytes, preserving full code points (RFC 5545).
 return lines.map(line=>{let out='',width=0;for(const c of line){const bytes=new TextEncoder().encode(c).length;if(width+bytes>74){out+='\r\n ';width=1;}out+=c;width+=bytes;}return out;}).join('\r\n')+'\r\n';
}
export const bookingInstructions = `BOOKING TOOLS — This phone call has explicitly enabled NBC booking. Browser role-play restrictions do not authorize any other external action.
Use nbc_available_slots for real availability. Confirm the person's timezone before offering up to three times. Never invent availability, a link or a reservation.
Before nbc_book_meeting, repeat the selected date, time and timezone, confirm their name and spelled email, and get explicit agreement. Ask whether they want an SMS confirmation; smsConsent must reflect their answer. The phone recipient is already bound by the server; never ask a tool to message another number.
A booked receipt confirms the appointment only. Email and SMS may still be pending or accepted for sending, which is not delivery. Use nbc_booking_status to check. Do not say an invitation was delivered without a delivered receipt. If the outcome is uncertain, explain that confirmation is pending and do not create another booking. Rescheduling/cancellation require the team; these tools do not perform them.`;
