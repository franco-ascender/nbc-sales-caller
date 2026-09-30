import 'server-only';
import {randomUUID} from 'node:crypto';
import {database,IntegrationError} from './integration.service';
import {CallerGhl,GhlWriteUncertain,appointmentSummary} from './caller-ghl.service';
import {getBookingConnection,getBookingCall,getBooking,updateBooking,receipt,claimStep,saveStep,decryptBookingToken,inviteSignature,type BookingCall,type BookingRow} from './caller-booking-store';
import {parseBookingRequest,blockedChannel,type BookingStep,type BookingReceipt} from '@/lib/caller-booking';
import {PILOT_ROUND} from '@/lib/live-pilot';
import {isRecord} from '@/lib/integration-validation';
const client=(call:BookingCall)=>new CallerGhl(decryptBookingToken(call.owner_id,call.token_ciphertext),call.config.locationId);
export async function authorizeBookingTool(c:unknown):Promise<BookingCall>{
 if(!isRecord(c)||typeof c.call_id!=='string'||c.call_status!=='ongoing')throw new IntegrationError(403,'Only an active, authorized phone call may book.');
 const db=database(),op=await db.from('nbc_pilot_operations').select('key,provider').eq('round_id',PILOT_ROUND).eq('provider->>callId',c.call_id).maybeSingle();
 if(op.error)throw new IntegrationError(503,'Call identity could not be checked.');if(!op.data)throw new IntegrationError(403,'This call is not authorized to book.');
 const [slot,round,binding]=await Promise.all([db.from('nbc_pilot_slots').select('config').eq('round_id',PILOT_ROUND).eq('key',op.data.key).single(),db.from('nbc_pilot_rounds').select('owner_id').eq('id',PILOT_ROUND).single(),getBookingCall(op.data.key)]);
 const config=slot.data?.config;if(slot.error||round.error||!config)throw new IntegrationError(503,'Call identity could not be checked.');
 if(!binding||binding.owner_id!==round.data.owner_id||binding.phone!==c.to_number||op.data.provider.engine!=='retell'||c.agent_id!==config.retell?.agentId||c.agent_version!==config.retell?.version||c.from_number!==config.retell?.from||c.to_number!==config.destination)throw new IntegrationError(403,'Booking identity does not match the saved call.');
 const current=await getBookingConnection(binding.owner_id);if(!current?.config.enabled)throw new IntegrationError(409,'Booking is paused for this account.');
 return binding;
}
export async function availableBookingSlots(call:BookingCall,args:unknown){
 if(!isRecord(args)||typeof args.startTime!=='string'||typeof args.endTime!=='string'||typeof args.timezone!=='string')throw new IntegrationError(400,'Provide a date range and the recipient timezone.');
 try{new Intl.DateTimeFormat('en-US',{timeZone:args.timezone}).format();}catch{throw new IntegrationError(400,'Confirm the recipient timezone.');}
 const config={...call.config,timezone:args.timezone},slots=await client(call).slots(config,Date.parse(args.startTime),Date.parse(args.endTime));
 return {timezone:args.timezone,slots:slots.slice(0,20).map(start=>({startTime:start,localTime:new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeStyle:'short',timeZone:config.timezone}).format(new Date(start))})),instruction:'Offer these slots only. Confirm the date, time, timezone and email before booking.'};
}
export async function bookMeeting(call:BookingCall,input:unknown):Promise<BookingReceipt>{
 let request;try{request=parseBookingRequest(input);}catch(e){throw new IntegrationError(400,e instanceof Error?e.message:'Invalid booking.');}
 const prior=await getBooking(call.operation_key);if(prior){if(JSON.stringify(prior.request)!==JSON.stringify(request))throw new IntegrationError(409,'This call already has a booking attempt. Check its status instead of creating another.');return receipt(prior);}
 const ghl=client(call),t=Date.parse(request.startTime),slots=await ghl.slots(call.config,t,t+60000);
 if(!slots.includes(request.startTime))throw new IntegrationError(409,'That slot is no longer free. Check availability and choose another time.');
 const id=randomUUID(),db=database(),claim=await db.from('caller_bookings').insert({id,operation_key:call.operation_key,owner_id:call.owner_id,request,state:'booking'});
 if(claim.error){if(claim.error.code==='23505'){const existing=await getBooking(call.operation_key);if(existing)return receipt(existing);}throw new IntegrationError(503,'The booking could not be reserved.');}
 try{
  const contact=await ghl.contact(call.phone),contactId=String(contact.id);
  await updateBooking(id,{contact_id:contactId});
  if(contact.dnd===true)throw new IntegrationError(409,'This contact has Do Not Disturb enabled.');
  await ghl.updateContact(contactId,request);
  const event=await ghl.book(call.config,contactId,request,`NBC booking ${id}`);
  await updateBooking(id,{state:'booked',appointment_id:String(event.id),receipt:appointmentSummary(event)});
 }catch(e){await updateBooking(id,{state:'uncertain'});if(e instanceof IntegrationError)throw e;throw new GhlWriteUncertain();}
 const saved=await getBooking(call.operation_key);if(!saved)throw new GhlWriteUncertain();return receipt(saved);
}
export async function bookingStatus(call:BookingCall):Promise<BookingReceipt|null>{
 let row=await getBooking(call.operation_key);if(!row)return null;
 if(['booking','uncertain'].includes(row.state)&&row.contact_id){const e=await client(call).findAppointment(call.config,row.contact_id,row.request.startTime,`NBC booking ${row.id}`);if(e){await updateBooking(row.id,{state:'booked',appointment_id:String(e.id),receipt:appointmentSummary(e)});row=(await getBooking(call.operation_key))!;}}
 const result=await receipt(row);
 for(const kind of ['email','sms'] as const){const step=result.steps[kind];if(step?.state==='accepted'&&step.providerId){const state=await client(call).messageStatus(step.providerId);await saveStep(row.id,kind,{...step,state});result.steps[kind]={...step,state};}}
 return result;
}
function invitationLink(row:BookingRow):string {
 const origin=process.env.CALLER_WEBHOOK_ORIGIN;if(!origin||!/^https:\/\//.test(origin))throw new IntegrationError(503,'Public invitation delivery is not configured.');
 const expires=String(Math.max(Date.now()+7*86400000,Date.parse(row.request.startTime)+86400000));
 return `${origin}/api/caller/booking/${row.id}/invite?expires=${expires}&signature=${inviteSignature(row.id,expires)}`;
}
export async function completeBookingSteps(operation:string):Promise<void>{
 const call=await getBookingCall(operation),row=await getBooking(operation);if(!call||!row||row.state!=='booked'||!row.contact_id||!row.appointment_id)return;
 const connection=await getBookingConnection(call.owner_id);if(!connection?.config.enabled)return;
 const ghl=client(call),c=call.config;
 for(const kind of ['tags','opportunity','email','sms'] as BookingStep[]){
  if(!await claimStep(row.id,kind))continue;
  try{
   if(kind==='tags'){if(c.tags.length)await ghl.tags(row.contact_id,c.tags);await saveStep(row.id,kind,{state:c.tags.length?'accepted':'skipped',costMicrousd:null});continue;}
   if(kind==='opportunity'){const providerId=await ghl.opportunity(c,row.contact_id);await saveStep(row.id,kind,{state:'accepted',providerId,costMicrousd:null});continue;}
   const channel=kind==='email'?'Email':'SMS',enabled=kind==='email'?c.sendEmail:c.sendSms&&row.request.smsConsent;
   if(!enabled){await saveStep(row.id,kind,{state:'skipped',reason:'Channel disabled or recipient did not consent.',costMicrousd:null});continue;}
   const contact=await ghl.getContact(row.contact_id);
   if(blockedChannel(contact,channel)||contact.phone!==call.phone||(kind==='email'&&String(contact.email).toLowerCase()!==row.request.email)){await saveStep(row.id,kind,{state:'skipped',reason:'Contact preferences or recipient details changed.',costMicrousd:null});continue;}
   // Re-read the booked event: never send a cancellation's old link or invented meeting URL.
   const e=await ghl.appointment(row.appointment_id,c,row.contact_id,row.request.startTime),summary=appointmentSummary(e);
   const when=new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeStyle:'short',timeZone:row.request.timezone}).format(new Date(row.request.startTime));
   const message=`Your meeting with ${c.businessName} is confirmed for ${when} (${row.request.timezone}).${summary.meetingUrl?` Join: ${summary.meetingUrl}`:' The team will provide the meeting location.'}${kind==='sms'?' Reply STOP to opt out.':''}`;
   const providerId=await ghl.send(c,row.contact_id,row.appointment_id,channel,message,kind==='email'?invitationLink(row):undefined);
   await saveStep(row.id,kind,{state:'accepted',providerId,costMicrousd:null});
  }catch(e){await saveStep(row.id,kind,{state:e instanceof GhlWriteUncertain?'uncertain':'failed',reason:e instanceof IntegrationError?e.message:'Action could not be confirmed.',costMicrousd:null});}
 }
}
