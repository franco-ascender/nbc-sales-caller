import {after} from 'next/server';
import {apiError,IntegrationError} from '@/services/integration.service';
import {verifyRetellWebhook} from '@/lib/retell-webhook';
import {isRecord} from '@/lib/integration-validation';
import {authorizeBookingTool,availableBookingSlots,bookMeeting,bookingStatus,completeBookingSteps} from '@/services/caller-booking.service';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(request:Request){try{
 const reader=request.body?.getReader();if(!reader)throw new IntegrationError(400,'Missing tool request.');const chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();throw new IntegrationError(413,'Tool request too large.');}chunks.push(value);}}finally{reader.releaseLock();}
 const raw=Buffer.concat(chunks).toString('utf8');if(!verifyRetellWebhook(raw,request.headers.get('x-retell-signature'),process.env.RETELL_API_KEY??''))throw new IntegrationError(401,'Invalid tool signature.');
 let body:unknown;try{body=JSON.parse(raw);}catch{throw new IntegrationError(400,'Invalid tool request.');}if(!isRecord(body)||!['nbc_available_slots','nbc_book_meeting','nbc_booking_status'].includes(String(body.name)))throw new IntegrationError(400,'Unknown booking tool.');
 const call=await authorizeBookingTool(body.call);
 if(body.name==='nbc_available_slots')return Response.json(await availableBookingSlots(call,body.args));
 const result=body.name==='nbc_book_meeting'?await bookMeeting(call,body.args):await bookingStatus(call);
 if(result?.state==='booked')after(()=>completeBookingSteps(call.operation_key));
 return Response.json({booking:result,instruction:'Only a booked receipt confirms the meeting. Notification acceptance is not delivery; do not promise delivery or invent a meeting URL.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return apiError(e);}}
