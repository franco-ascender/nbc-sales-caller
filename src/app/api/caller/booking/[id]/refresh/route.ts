import {after} from 'next/server';
import {requireWorkspaceAdmin} from '@/services/workspace-auth';
import {database,apiError,IntegrationError} from '@/services/integration.service';
import {getBookingCall} from '@/services/caller-booking-store';
import {bookingStatus,completeBookingSteps} from '@/services/caller-booking.service';
export const maxDuration=60;
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{const user=await requireWorkspaceAdmin(request),{id}=await context.params;const r=await database().from('caller_bookings').select('operation_key').eq('id',id).eq('owner_id',user.id).single();if(r.error||!r.data)throw new IntegrationError(404,'Booking not found.');const call=await getBookingCall(r.data.operation_key);if(!call||call.owner_id!==user.id)throw new IntegrationError(403,'Booking not found.');const result=await bookingStatus(call);if(result?.state==='booked')after(()=>completeBookingSteps(call.operation_key));return Response.json(result,{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
